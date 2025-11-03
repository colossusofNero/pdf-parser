# quote_calc.py
from __future__ import annotations

import math
from typing import Dict, Tuple, Optional, List
import pandas as pd


class QuoteCalculator:
    """
    Reads the VLOOKUP tables from the provided workbook and exposes:

      - nat_log_quote(): base quote from cost-basis & zip factors
      - final_quote(): base quote with optional adjustments (rush, referral, premium, overrides)
      - build_quote_doc(): assemble a PDF-ready payload (header + payments + schedule table)

    Expected workbook structure:
      Sheet "VLOOKUP Tables" contains:
        - ["Cost Basis", "Cost Basis Factor"] (row 2 header)
        - ["Zip Code", "Zip Code Factor"]    (row 2 header)
        - (optional) a "Rush Fee" column with labels and a numeric amount 2 cols to the right

    Notes:
      Base/Nat-Log quote: 2235 * cost_basis_factor * zip_factor
      Premium uplift default: 5%
      Referral uplift default: 0%
    """

    def __init__(self, xlsx_path: str):
        self.xlsx_path = xlsx_path
        self.vlt = pd.read_excel(xlsx_path, sheet_name="VLOOKUP Tables", header=None)
        self._load_tables()

        # Tunable business knobs:
        self.premium_uplift: float = 0.05   # 5% uplift when Premium == "Yes"
        self.referral_pct: float = 0.00     # 0% uplift when Referral == "Yes"

    # ---------- table loading ----------

    def _find_pair(self, header_left: str, header_right: str) -> int:
        """Find the starting column index in row-2 where [header_left, header_right] appear."""
        for c in range(self.vlt.shape[1] - 1):
            if self.vlt.iat[2, c] == header_left and self.vlt.iat[2, c + 1] == header_right:
                return c
        raise ValueError(f"Header pair {header_left} / {header_right} not found in 'VLOOKUP Tables'")

    def _load_tables(self) -> None:
        cb_col = self._find_pair("Cost Basis", "Cost Basis Factor")
        zip_col = self._find_pair("Zip Code", "Zip Code Factor")

        self.cost_basis_tbl = self.vlt.iloc[3:15, [cb_col, cb_col + 1]].dropna()
        self.cost_basis_tbl.columns = ["threshold", "factor"]

        self.zip_tbl = self.vlt.iloc[3:15, [zip_col, zip_col + 1]].dropna()
        self.zip_tbl.columns = ["zip_floor", "factor"]

        # Optional Rush fee mapping
        self._rush_map: Dict[str, float] = {"No Rush": 0.0}
        try:
            rush_c = None
            for c in range(self.vlt.shape[1] - 1):
                if self.vlt.iat[2, c] == "Rush Fee":
                    rush_c = c
                    break
            if rush_c is not None:
                # Heuristic: label at rush_c, amount two columns to the right (rush_c+2).
                for r in range(3, self.vlt.shape[0]):
                    label = self.vlt.iat[r, rush_c]
                    amount = self.vlt.iat[r, rush_c + 2] if rush_c + 2 < self.vlt.shape[1] else None
                    if isinstance(label, str) and isinstance(amount, (int, float)):
                        self._rush_map[label.strip()] = float(amount)
        except Exception:
            # Keep default "No Rush": 0
            pass

    # ---------- lookups & math ----------

    @staticmethod
    def _ladder_lookup(x: float, table: pd.DataFrame) -> float:
        """
        Return the factor whose threshold is the last value <= x.
        `table` must have first column as threshold and second as factor.
        """
        rows = table.sort_values(table.columns[0])
        val = float(rows.iloc[0, 1])
        for _, r in rows.iterrows():
            if x >= float(r.iloc[0]):
                val = float(r.iloc[1])
            else:
                break
        return val

    @staticmethod
    def _coerce_land_amount(purchase_price: float, land_value: float, known_land_value: bool) -> float:
        """
        If known_land_value is False -> land_value is a PERCENT.
          Accepts both 10 (meaning 10%) and 0.10 (meaning 10%).
        If known_land_value is True  -> land_value is a DOLLAR amount.
        """
        if known_land_value:
            return float(land_value or 0.0)

        # percent path
        v = float(land_value or 0.0)
        pct = v / 100.0 if v > 1.0 else v  # 10 -> 0.10 ; 0.10 stays 0.10
        return purchase_price * pct

    def nat_log_quote(
        self,
        purchase_price: float,
        land_value: float,
        known_land_value: bool,
        zip_code: int,
        base_rate: float = 2235.0,
    ) -> Tuple[float, Dict]:
        """
        Compute base (Nat-Log style) quote.
        """
        land_amt = self._coerce_land_amount(purchase_price, land_value, known_land_value)
        cost_basis = purchase_price - land_amt
        cb_factor = self._ladder_lookup(cost_basis, self.cost_basis_tbl)
        zip_factor = self._ladder_lookup(int(zip_code), self.zip_tbl)
        quote = base_rate * cb_factor * zip_factor
        return quote, {
            "base_rate": base_rate,
            "cost_basis": cost_basis,
            "cb_factor": cb_factor,
            "zip_factor": zip_factor,
        }

    def final_quote(
        self,
        *,
        purchase_price: float,
        land_value: float,
        known_land_value: bool,
        zip_code: int,
        rush_label: str = "No Rush",
        premium: str = "No",
        referral: str = "No",
        price_override: Optional[float] = None,
    ) -> Tuple[float, Dict]:
        """
        Final fee = base quote + rush flat fee + premium/referral uplifts (unless overridden).
        """
        base, parts = self.nat_log_quote(purchase_price, land_value, known_land_value, zip_code)
        adjustments = 0.0

        # Rush (flat)
        rush_fee = float(self._rush_map.get(rush_label, 0.0))
        adjustments += rush_fee

        # Premium uplift
        premium_pct = self.premium_uplift if str(premium).strip().lower().startswith("y") else 0.0
        adjustments += base * premium_pct

        # Referral uplift
        referral_pct = self.referral_pct if str(referral).strip().lower().startswith("y") else 0.0
        adjustments += base * referral_pct

        # Optional override
        if isinstance(price_override, (int, float)) and price_override > 0:
            final_fee = float(price_override)
        else:
            final_fee = base + adjustments

        parts.update(
            {
                "rush_fee": rush_fee,
                "premium_uplift_pct": premium_pct,
                "referral_pct": referral_pct,
                "override": float(price_override or 0.0),
            }
        )
        return round(final_fee, 2), parts

    # ---------- document helpers ----------

    def _payment_block(self, original: float, rush_fee: float = 0.0) -> Dict:
        upfront = round(original * 0.909, 2)
        half = round(original / 2.0, 2)
        over_time = round(original / 4.0, 2)
        return {
            "originally_quoted": round(original, 2),
            "rush_fee": round(rush_fee, 2),
            "pay_upfront": upfront,
            "pay_50_50": half,
            "pay_over_time_amount": over_time,
            "pay_over_time_note": "Up to 36 months",
        }

    def _find_schedule_table(self) -> pd.DataFrame:
        """Extract depreciation schedule from YbyY data sheet."""
        try:
            xl = pd.ExcelFile(self.xlsx_path)
            
            # Try to find "YbyY data" sheet first (most likely location)
            sheet_name = None
            for name in xl.sheet_names:
                if "ybyy" in name.lower() or "ybyydata" in name.lower().replace(" ", ""):
                    sheet_name = name
                    break
            
            if not sheet_name:
                # Fallback to checking multiple sheets
                sheet_name = xl.sheet_names[0] if xl.sheet_names else None
            
            if not sheet_name:
                return pd.DataFrame(columns=["year", "cost_seg_est", "std_dep", "trad_cost_seg", "bonus_dep"])
            
            # Read the sheet
            df = pd.read_excel(self.xlsx_path, sheet_name=sheet_name, header=None)
            
            # Look for the row with "Year", "Std", "Trad", "Bonus" headers (around row 3, columns 113-116)
            for row_idx in range(min(10, len(df))):
                row = df.iloc[row_idx].astype(str).str.strip().str.lower()
                
                # Find the "Year" column
                year_cols = [i for i, val in enumerate(row) if val == "year"]
                
                for year_col in year_cols:
                    # Check if Std, Trad, Bonus are nearby
                    if year_col + 3 < len(row):
                        next_cols = row.iloc[year_col:year_col+4].tolist()
                        if "std" in next_cols and "trad" in next_cols and "bonus" in next_cols:
                            # Found it! Extract the data
                            std_col = year_col + next_cols.index("std")
                            trad_col = year_col + next_cols.index("trad")
                            bonus_col = year_col + next_cols.index("bonus")
                            
                            # Extract data starting from the next row
                            data_rows = []
                            for data_idx in range(row_idx + 1, len(df)):
                                year_val = df.iloc[data_idx, year_col]
                                
                                # Stop if we hit non-numeric year
                                try:
                                    year_num = int(float(year_val))
                                    if year_num < 2000 or year_num > 2100:
                                        break
                                except (ValueError, TypeError):
                                    break
                                
                                std_val = df.iloc[data_idx, std_col]
                                trad_val = df.iloc[data_idx, trad_col]
                                bonus_val = df.iloc[data_idx, bonus_col]
                                
                                data_rows.append({
                                    "year": year_num,
                                    "cost_seg_est": float(trad_val) if pd.notna(trad_val) else 0.0,
                                    "std_dep": float(std_val) if pd.notna(std_val) else 0.0,
                                    "trad_cost_seg": float(trad_val) if pd.notna(trad_val) else 0.0,
                                    "bonus_dep": float(bonus_val) if pd.notna(bonus_val) else 0.0,
                                })
                            
                            if data_rows:
                                return pd.DataFrame(data_rows)
            
        except Exception as e:
            print(f"Error reading schedule: {e}")
        
        # Return empty DataFrame if nothing found
        return pd.DataFrame(columns=["year", "cost_seg_est", "std_dep", "trad_cost_seg", "bonus_dep"])
    
    def build_quote_doc(self, inputs: Dict, final_quote_amount: float, rush_fee: float = 0.0) -> Dict:
        """
        Returns a dict for the frontend PDF-like renderer (header + payments + schedule).
        Uses safe defaults so required strings are always present.
        """
        addr = inputs.get("address") or "123 Main St, Yourtown, US, 85260"
        due_label = f"{(inputs.get('tax_deadline') or 'October')} {(inputs.get('tax_year') or '2025')}"
        
        # FIX: Convert purchase_date to string
        purchase = inputs.get("purchase_date") or "03/15/2024"
        if hasattr(purchase, 'isoformat'):  # If it's a date object
            purchase = purchase.isoformat()  # Convert to string format YYYY-MM-DD
        else:
            purchase = str(purchase)  # Otherwise just convert to string
        
        sqft = inputs.get("sqft_building") or None
        acres = inputs.get("acres_land") or None

        # Purchase price and land/building split
        pp = float(inputs["purchase_price"])
        if inputs.get("known_land_value"):
            # land_value is a DOLLAR amount
            land_amt = float(inputs.get("land_value") or 0.0)
        else:
            # land_value is a PERCENT; accept 10 or 0.10
            v = float(inputs.get("land_value") or 0.0)
            pct = v / 100.0 if v > 1.0 else v
            land_amt = round(pp * pct, 2)

        bldg_v = round(pp - land_amt + float(inputs.get("capex_amount") or 0.0), 2)

        # Payment panel from final quote
        payments = self._payment_block(final_quote_amount, rush_fee=rush_fee)

        # Try to scrape depreciation schedule from the workbook
        sched_df = self._find_schedule_table()
        schedule = [
            {
                "year": int(r.year),
                "cost_seg_est": round(float(getattr(r, "cost_seg_est", 0.0) or 0.0), 2),
                "std_dep": round(float(getattr(r, "std_dep", 0.0) or 0.0), 2),
                "trad_cost_seg": round(float(getattr(r, "trad_cost_seg", 0.0) or 0.0), 2),
                "bonus_dep": round(float(getattr(r, "bonus_dep", 0.0) or 0.0), 2),
            }
            for r in sched_df.itertuples()
        ]

        totals = {
            "total_cost_seg_est": round(sum(r["cost_seg_est"] for r in schedule), 2),
            "total_std_dep": round(sum(r["std_dep"] for r in schedule), 2),
            "total_trad_cost_seg": round(sum(r["trad_cost_seg"] for r in schedule), 2),
        }

        return {
            "company": inputs.get("prospect_name") or "Valued Client",
            "property_label": inputs.get("property_type") or "Multi-Family",
            "property_address": addr,
            "purchase_price": pp,
            "capex_amount": float(inputs.get("capex_amount") or 0.0),
            "building_value": bldg_v,
            "land_value": round(land_amt, 2),
            "purchase_date": purchase,
            "sqft_building": sqft,
            "acres_land": acres,
            "due_date_label": due_label,
            "payments": payments,
            "schedule": schedule,
            **totals,
        }


# ---------- quick manual test ----------
if __name__ == "__main__":
    PATH = "Base Pricing27.1_Pro_SMART_RCGV.xlsx"
    calc = QuoteCalculator(PATH)

    q, parts = calc.nat_log_quote(
        purchase_price=2_550_000,
        land_value=10,           # percent unless known_land_value=True
        known_land_value=False,
        zip_code=85260,
    )
    print("Nat Log Quote:", q, parts)

    final, breakdown = calc.final_quote(
        purchase_price=2_550_000,
        land_value=10,
        known_land_value=False,
        zip_code=85260,
        rush_label="No Rush",
        premium="No",
        referral="No",
        price_override=None,
    )
    print("Final Quote:", final, breakdown)