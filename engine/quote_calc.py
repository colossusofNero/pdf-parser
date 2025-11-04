# quote_calc.py
from __future__ import annotations

import math
from typing import Dict, Tuple, Optional, List
from decimal import Decimal, ROUND_HALF_UP
import pandas as pd
from openpyxl import load_workbook


class QuoteCalculator:
    """
    Reads the VLOOKUP tables from the provided workbook and exposes:

      - nat_log_quote(): base quote from cost-basis & zip factors
      - final_quote(): base quote with optional adjustments (rush, referral, premium, overrides)
      - build_quote_doc(): assemble a PDF-ready payload (header + payments + schedule table)
    """

    def __init__(self, xlsx_path: str):
        self.xlsx_path = xlsx_path

        # For VLOOKUP tables, pandas is fine (no formulas relied on)
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
        If known_land_value is False -> land_value is a PERCENT (10 or 0.10).
        If known_land_value is True  -> land_value is a DOLLAR amount.
        """
        if known_land_value:
            return float(land_value or 0.0)

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

    # ---------- helpers for reading computed values ----------

    def _sheet_to_df(self, sheet_name: str) -> pd.DataFrame:
        """
        Load a sheet with computed values (data_only=True) and return a DataFrame of raw cells.
        Avoids pandas returning formula strings like ='Printable Quote'!G7.
        """
        try:
            wb = load_workbook(self.xlsx_path, data_only=True)
            if sheet_name not in wb.sheetnames:
                return pd.DataFrame()
            ws = wb[sheet_name]
            data = []
            max_row = ws.max_row
            max_col = ws.max_column
            for r in ws.iter_rows(min_row=1, max_row=max_row, min_col=1, max_col=max_col, values_only=True):
                data.append(list(r))
            return pd.DataFrame(data)
        except Exception:
            return pd.DataFrame()

    @staticmethod
    def _to_num(v) -> float:
        """Best-effort numeric coerce; accepts None, '', strings with commas/$."""
        if v is None:
            return 0.0
        if isinstance(v, (int, float)):
            return float(v)
        s = str(v).strip().replace(",", "").replace("$", "")
        try:
            return float(s)
        except ValueError:
            return 0.0

    # ---------- schedule readers ----------

    def _read_printable_quote_by_cells(self) -> pd.DataFrame:
        """
        Preferred fast path: read computed values directly from fixed cells on 'Printable Quote'.
        Year: F7.., Std: G7.., Trad: H7.., Bonus: I7..
        Accepts calendar years (1900–2100) OR 1..200. Stops when Year is blank/non-numeric.
        """
        try:
            wb = load_workbook(self.xlsx_path, data_only=True)
            if "Printable Quote" not in wb.sheetnames:
                return pd.DataFrame(columns=["year", "cost_seg_est", "std_dep", "trad_cost_seg", "bonus_dep"])
            ws = wb["Printable Quote"]

            def to_num(v):
                if v is None:
                    return 0.0
                if isinstance(v, (int, float)):
                    return float(v)
                s = str(v).strip().replace(",", "").replace("$", "")
                try:
                    return float(s)
                except Exception:
                    return 0.0

            rows = []
            r = 7  # first value row (Year in F7, Std in G7, Trad in H7, Bonus in I7)
            while True:
                y = ws[f"F{r}"].value
                if y is None:
                    break
                try:
                    y_num = int(float(y))
                except Exception:
                    break

                # Accept either Year 1..200 OR calendar years 1900..2100
                if not ((1 <= y_num <= 200) or (1900 <= y_num <= 2100)):
                    break

                std   = to_num(ws[f"G{r}"].value)
                trad  = to_num(ws[f"H{r}"].value)
                bonus = to_num(ws[f"I{r}"].value)

                rows.append({
                    "year": y_num,
                    "cost_seg_est": trad,
                    "std_dep": std,
                    "trad_cost_seg": trad,
                    "bonus_dep": bonus,
                })
                r += 1

            # ✅ NEW: Read totals from Excel cells instead of calculating
            # Assuming totals are in row 49 (adjust if different)
            total_std_dep = to_num(ws["G49"].value)
            total_trad = to_num(ws["H49"].value)
            total_bonus = to_num(ws["I49"].value)
            
            df = pd.DataFrame(rows)
            # Store totals as metadata on the DataFrame
            df.attrs['total_std_dep'] = total_std_dep
            df.attrs['total_trad_cost_seg'] = total_trad
            df.attrs['total_bonus_dep'] = total_bonus
            
            return df
        except Exception:
            return pd.DataFrame(columns=["year", "cost_seg_est", "std_dep", "trad_cost_seg", "bonus_dep"])

    def _read_printable_quote_schedule(self) -> pd.DataFrame:
        """
        Header-scan reader for 'Printable Quote'.

        Matches these headers (case-insensitive, any order):
          - 'Cost Seg Est'
          - 'Std. Dep'
          - 'Trad. Cost Seg'
          - 'Bonus Dep'

        If a 'Year' header isn't present, infer the Year column as the column
        immediately to the LEFT of the first matched header (works with F/G/H/I layout).

        Accepts calendar years (1900–2100) OR 1..200.
        """
        df = self._sheet_to_df("Printable Quote")
        if df is None or df.empty:
            return pd.DataFrame(columns=["year", "cost_seg_est", "std_dep", "trad_cost_seg", "bonus_dep"])

        def norm_row(series):
            return series.astype(str).str.strip().str.lower()

        needles = {
            "cost": ["cost seg est", "costseg est", "cost seg estimate"],
            "std":  ["std. dep", "std dep", "standard depreciation"],
            "trad": ["trad. cost seg", "traditional cost seg", "trad cost seg"],
            "bonus": ["bonus dep", "bonus depreciation"],
        }

        header_row_idx = None
        cols = {"year": None, "cost": None, "std": None, "trad": None, "bonus": None}

        # find a row that contains std/trad/bonus (cost optional)
        max_scan_rows = min(100, len(df))
        for r in range(max_scan_rows):
            row = norm_row(df.iloc[r])
            found = {"cost": None, "std": None, "trad": None, "bonus": None}
            for key, options in needles.items():
                for i, cell in enumerate(row):
                    if cell in options:
                        found[key] = i
                        break

            if all(found[k] is not None for k in ("std", "trad", "bonus")):
                header_row_idx = r
                cols.update(found)

                # explicit 'Year' header?
                year_candidates = [i for i, cell in enumerate(row) if cell == "year"]
                if year_candidates:
                    cols["year"] = year_candidates[0]
                else:
                    # infer year: one column left of the leftmost matched header
                    leftmost = min(v for v in found.values() if v is not None)
                    cols["year"] = (leftmost - 1) if leftmost > 0 else None
                break

        if header_row_idx is None or cols["year"] is None:
            return pd.DataFrame(columns=["year", "cost_seg_est", "std_dep", "trad_cost_seg", "bonus_dep"])

        out_rows = []
        r = header_row_idx + 1

        def n(v) -> float:
            return self._to_num(v)

        while r < len(df):
            y = df.iat[r, cols["year"]]
            try:
                y_num = int(float(y))
            except (TypeError, ValueError):
                break

            # Accept 1..200 OR calendar years 1900..2100
            if not ((1 <= y_num <= 200) or (1900 <= y_num <= 2100)):
                break

            std_val   = n(df.iat[r, cols["std"]])
            trad_val  = n(df.iat[r, cols["trad"]])
            bonus_val = n(df.iat[r, cols["bonus"]])

            if cols["cost"] is not None:
                cost_val = n(df.iat[r, cols["cost"]])
            else:
                cost_val = trad_val

            out_rows.append({
                "year": y_num,
                "cost_seg_est": cost_val,
                "std_dep": std_val,
                "trad_cost_seg": trad_val,
                "bonus_dep": bonus_val,
            })
            r += 1

        return pd.DataFrame(out_rows)

    def _find_schedule_table(self) -> pd.DataFrame:
        """
        Returns the depreciation schedule as a DataFrame with columns:
          year, cost_seg_est, std_dep, trad_cost_seg, bonus_dep

        Order of attempts:
        0) Printable Quote by fixed cells (best match for your workbook)
        1) Printable Quote by header scan (fallback)
        2) Legacy YbyY scan (last resort)
        """
        # 0) Preferred: direct cell read from Printable Quote
        direct = self._read_printable_quote_by_cells()
        if not direct.empty:
            return direct

        # 1) Header-scan Printable Quote
        pq = self._read_printable_quote_schedule()
        if not pq.empty:
            return pq

        # 2) Fallback: legacy YbyY scan using computed values
        df = self._sheet_to_df("YbyY data")
        if df is None or df.empty:
            return pd.DataFrame(columns=["year", "cost_seg_est", "std_dep", "trad_cost_seg", "bonus_dep"])

        # Look for a row with something like: Year | Std | Trad | Bonus (case-insensitive)
        for row_idx in range(min(100, len(df))):
            row = df.iloc[row_idx].astype(str).str.strip().str.lower()

            year_cols = [i for i, val in enumerate(row) if val == "year"]
            for year_col in year_cols:
                window = row.iloc[year_col: year_col + 8].tolist()
                tokens = ["std", "trad", "bonus"]
                if all(any(tok == c for c in window) for tok in tokens):
                    def find_rel(tok: str) -> Optional[int]:
                        for offset, cell in enumerate(window):
                            if cell == tok:
                                return year_col + offset
                        return None

                    std_col = find_rel("std")
                    trad_col = find_rel("trad")
                    bonus_col = find_rel("bonus")
                    if std_col is None or trad_col is None or bonus_col is None:
                        continue

                    data_rows = []
                    for data_idx in range(row_idx + 1, len(df)):
                        y = df.iloc[data_idx, year_col]
                        try:
                            y_num = int(float(y))
                        except (TypeError, ValueError):
                            break
                        # accept either 1..200 or calendar years 1900..2100
                        if not ((1 <= y_num <= 200) or (1900 <= y_num <= 2100)):
                            break

                        std_val = self._to_num(df.iloc[data_idx, std_col])
                        trad_val = self._to_num(df.iloc[data_idx, trad_col])
                        bonus_val = self._to_num(df.iloc[data_idx, bonus_col])

                        data_rows.append({
                            "year": y_num,
                            "cost_seg_est": trad_val,
                            "std_dep": std_val,
                            "trad_cost_seg": trad_val,
                            "bonus_dep": bonus_val,
                        })

                    if data_rows:
                        return pd.DataFrame(data_rows)

        # Last resort: empty
        return pd.DataFrame(columns=["year", "cost_seg_est", "std_dep", "trad_cost_seg", "bonus_dep"])

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

    def build_quote_doc(self, inputs: Dict, final_quote_amount: float, rush_fee: float = 0.0) -> Dict:
        """
        Returns a dict for the frontend PDF-like renderer (header + payments + schedule).
        Deterministic cents rounding via Decimal to prevent float drift.
        """
        def q2(x) -> Decimal:
            return Decimal(str(x or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        addr = inputs.get("address") or "123 Main St, Yourtown, US, 85260"
        due_label = f"{(inputs.get('tax_deadline') or 'October')} {(inputs.get('tax_year') or '2025')}"

        purchase = inputs.get("purchase_date") or "03/15/2024"
        if hasattr(purchase, "isoformat"):
            purchase = purchase.isoformat()
        else:
            purchase = str(purchase)

        pp = float(inputs["purchase_price"])
        if inputs.get("known_land_value"):
            land_amt = float(inputs.get("land_value") or 0.0)
        else:
            v = float(inputs.get("land_value") or 0.0)
            pct = v / 100.0 if v > 1.0 else v
            land_amt = pp * pct
        bldg_v = pp - land_amt + float(inputs.get("capex_amount") or 0.0)

        payments = self._payment_block(final_quote_amount, rush_fee=rush_fee)

        # Build schedule and quantize each cell to cents
        sched_df = self._find_schedule_table()
        schedule = []
        for r in sched_df.itertuples():
            schedule.append({
                "year": int(getattr(r, "year")),
                "cost_seg_est": float(q2(getattr(r, "cost_seg_est", 0.0))),
                "std_dep":       float(q2(getattr(r, "std_dep",       0.0))),
                "trad_cost_seg": float(q2(getattr(r, "trad_cost_seg", 0.0))),
                "bonus_dep":     float(q2(getattr(r, "bonus_dep",     0.0))),
            })

        # Read totals from Excel
        wb = load_workbook(self.xlsx_path, data_only=True)
        ws = wb["Printable Quote"]
        
        g49_val = ws["G49"].value
        h49_val = ws["H49"].value
        i49_val = ws["I49"].value
        
        total_std_dep = float(q2(self._to_num(g49_val)))
        total_trad_cost_seg = float(q2(self._to_num(h49_val)))
        total_cost_seg_est = float(q2(self._to_num(i49_val if i49_val is not None else h49_val)))

        return {
            "rounding_version": "decimal_v1",
            "company": inputs.get("prospect_name") or "Valued Client",
            "property_label": inputs.get("property_type") or "Multi-Family",
            "property_address": inputs.get("address") or "123 Main St, Yourtown, US, 85260",
            "purchase_price": float(q2(pp)),
            "capex_amount": float(q2(inputs.get("capex_amount") or 0.0)),
            "building_value": float(q2(bldg_v)),
            "land_value": float(q2(land_amt)),
            "purchase_date": purchase,
            "sqft_building": inputs.get("sqft_building") or None,
            "acres_land": inputs.get("acres_land") or None,
            "due_date_label": due_label,
            "payments": payments,
            "schedule": schedule,
            "total_cost_seg_est": total_cost_seg_est,
            "total_std_dep": total_std_dep,
            "total_trad_cost_seg": total_trad_cost_seg,
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