# quote_calc.py - CLOUD-READY VERSION (No Excel formulas needed)
from __future__ import annotations

import math
from typing import Dict, Tuple, Optional, List
from decimal import Decimal, ROUND_HALF_UP
from datetime import datetime
import pandas as pd
from openpyxl import load_workbook


class QuoteCalculator:
    """
    Cloud-ready version that calculates depreciation schedules in Python.
    No Excel COM automation needed - works on Linux/Windows/Mac.
    """

    EXCEL_INPUT_CELLS = {
        'purchase_price': 'B3',
        'zip_code': 'D3',
        'sqft_building': 'F3',
        'acres_land': 'H3',
        'property_type': 'J3',
        'floors': 'L3',
        'multiple_properties': 'N3',
        'purchase_date': 'P3',
        'tax_year': 'R3',
        'year_built': 'P7',
        'tax_deadline': 'R7',
        'owner': 'B25',
        'address': 'B28',
    }

    # Property type to depreciation period mapping
    DEPRECIATION_PERIODS = {
        "Multi-Family": 27.5,
        "Residential/LTR": 27.5,
        "Short-Term Rental": 39,  # Short-term rentals are commercial (39yr)
        "Office": 39,
        "Retail": 39,
        "Industrial": 39,
        "Warehouse": 39,
        "Hotel": 39,
        "Medical": 39,
        "Restaurant": 39,
        "Mixed-Use": 39,
        "Other": 39,
    }

    def __init__(self, xlsx_path: str):
        self.xlsx_path = xlsx_path
        self.vlt = pd.read_excel(xlsx_path, sheet_name="VLOOKUP Tables", header=None)
        self._load_tables()
        
        self.premium_uplift: float = 0.05
        self.referral_pct: float = 0.00

    def _find_pair(self, header_left: str, header_right: str) -> int:
        for c in range(self.vlt.shape[1] - 1):
            if self.vlt.iat[2, c] == header_left and self.vlt.iat[2, c + 1] == header_right:
                return c
        raise ValueError(f"Header pair {header_left} / {header_right} not found")

    def _load_tables(self) -> None:
        cb_col = self._find_pair("Cost Basis", "Cost Basis Factor")
        zip_col = self._find_pair("Zip Code", "Zip Code Factor")

        self.cost_basis_tbl = self.vlt.iloc[3:15, [cb_col, cb_col + 1]].dropna()
        self.cost_basis_tbl.columns = ["threshold", "factor"]

        self.zip_tbl = self.vlt.iloc[3:15, [zip_col, zip_col + 1]].dropna()
        self.zip_tbl.columns = ["zip_floor", "factor"]

        self._rush_map: Dict[str, float] = {"No Rush": 0.0}
        try:
            rush_c = None
            for c in range(self.vlt.shape[1] - 1):
                if self.vlt.iat[2, c] == "Rush Fee":
                    rush_c = c
                    break
            if rush_c is not None:
                for r in range(3, self.vlt.shape[0]):
                    label = self.vlt.iat[r, rush_c]
                    amount = self.vlt.iat[r, rush_c + 2] if rush_c + 2 < self.vlt.shape[1] else None
                    if isinstance(label, str) and isinstance(amount, (int, float)):
                        self._rush_map[label.strip()] = float(amount)
        except Exception:
            pass

    @staticmethod
    def _ladder_lookup(x: float, table: pd.DataFrame) -> float:
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
        if known_land_value:
            return float(land_value or 0.0)
        v = float(land_value or 0.0)
        pct = v / 100.0 if v > 1.0 else v
        return purchase_price * pct

    def nat_log_quote(
        self,
        purchase_price: float,
        land_value: float,
        known_land_value: bool,
        zip_code: int,
        base_rate: float = 2235.0,
    ) -> Tuple[float, Dict]:
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
        base, parts = self.nat_log_quote(purchase_price, land_value, known_land_value, zip_code)
        adjustments = 0.0

        rush_fee = float(self._rush_map.get(rush_label, 0.0))
        adjustments += rush_fee

        premium_pct = self.premium_uplift if str(premium).strip().lower().startswith("y") else 0.0
        adjustments += base * premium_pct

        referral_pct = self.referral_pct if str(referral).strip().lower().startswith("y") else 0.0
        adjustments += base * referral_pct

        if isinstance(price_override, (int, float)) and price_override > 0:
            final_fee = float(price_override)
        else:
            final_fee = base + adjustments

        parts.update({
            "rush_fee": rush_fee,
            "premium_uplift_pct": premium_pct,
            "referral_pct": referral_pct,
            "override": float(price_override or 0.0),
        })
        return round(final_fee, 2), parts

    # ✅ CLOUD-READY: Calculate depreciation schedule in Python
    def calculate_depreciation_schedule(self, inputs: Dict) -> List[Dict]:
        """
        Calculate depreciation schedule based on property type.
        This replaces Excel formula calculations.
        """
        # Get property type and determine depreciation period
        property_type = inputs.get("property_type", "Multi-Family")
        dep_years = self.DEPRECIATION_PERIODS.get(property_type, 27.5)
        
        # Calculate building value
        pp = float(inputs.get("purchase_price", 0))
        if inputs.get("known_land_value"):
            land_amt = float(inputs.get("land_value", 0))
        else:
            v = float(inputs.get("land_value", 0))
            pct = v / 100.0 if v > 1.0 else v
            land_amt = pp * pct
        
        capex = float(inputs.get("capex_amount", 0)) if inputs.get("capex") == "Yes" else 0
        building_value = pp - land_amt + capex
        
        print(f"📊 Calculating depreciation schedule:")
        print(f"   Property Type: {property_type}")
        print(f"   Depreciation Period: {dep_years} years")
        print(f"   Building Value: ${building_value:,.2f}")
        
        # Standard straight-line depreciation
        annual_std_dep = building_value / dep_years
        
        # Cost segregation assumptions (simplified)
        # These percentages would ideally come from your Excel model
        # Adjust these based on your actual cost seg methodology
        
        # Typical cost seg breakout:
        # - 5-year property: ~15% (land improvements, equipment)
        # - 15-year property: ~10% (site improvements)
        # - 27.5/39-year: remainder
        
        five_year_portion = building_value * 0.15   # 15% to 5-year
        fifteen_year_portion = building_value * 0.10  # 10% to 15-year
        building_portion = building_value * 0.75      # 75% to building life
        
        # Calculate bonus depreciation (100% first year for 5 & 15 year property)
        bonus_first_year = five_year_portion + fifteen_year_portion
        
        schedule = []
        num_years = int(dep_years) + 1  # +1 for partial year
        
        for year in range(1, num_years + 1):
            # Standard depreciation (straight line over building life)
            std_dep = annual_std_dep if year <= dep_years else 0
            
            # Traditional cost seg (without bonus)
            if year <= 5:
                # 5-year property using 200% declining balance
                trad_5yr = five_year_portion * 0.20
            elif year == 6:
                trad_5yr = five_year_portion * 0.20 * 0.5  # half year
            else:
                trad_5yr = 0
            
            if year <= 15:
                # 15-year property using 150% declining balance
                trad_15yr = fifteen_year_portion * 0.10
            elif year == 16:
                trad_15yr = fifteen_year_portion * 0.10 * 0.5  # half year
            else:
                trad_15yr = 0
            
            trad_bldg = building_portion / dep_years if year <= dep_years else 0
            trad_cost_seg = trad_5yr + trad_15yr + trad_bldg
            
            # Bonus depreciation (front-loads the 5 & 15 year property)
            if year == 1:
                bonus_dep = bonus_first_year + trad_bldg
            else:
                # Remaining years just have building depreciation
                bonus_dep = trad_bldg
            
            schedule.append({
                "year": year,
                "cost_seg_est": round(trad_cost_seg, 2),
                "std_dep": round(std_dep, 2),
                "trad_cost_seg": round(trad_cost_seg, 2),
                "bonus_dep": round(bonus_dep, 2),
            })
        
        print(f"   Generated {len(schedule)} years of depreciation")
        print(f"   Year 1 bonus depreciation: ${schedule[0]['bonus_dep']:,.2f}")
        
        return schedule

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
        Cloud-ready version - calculates everything in Python.
        No Excel COM automation needed.
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

        # ✅ Calculate depreciation schedule in Python (no Excel needed)
        schedule = self.calculate_depreciation_schedule(inputs)
        
        # Calculate totals
        total_std_dep = sum(r["std_dep"] for r in schedule)
        total_trad_cost_seg = sum(r["trad_cost_seg"] for r in schedule)
        total_cost_seg_est = sum(r["cost_seg_est"] for r in schedule)

        return {
            "rounding_version": "decimal_v1",
            "company": inputs.get("owner") or "Valued Client",
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
            "total_cost_seg_est": float(q2(total_cost_seg_est)),
            "total_std_dep": float(q2(total_std_dep)),
            "total_trad_cost_seg": float(q2(total_trad_cost_seg)),
        }


if __name__ == "__main__":
    PATH = "Base Pricing27.1_Pro_SMART_RCGV.xlsx"
    calc = QuoteCalculator(PATH)

    # Test with Office property (39-year)
    test_inputs = {
        "purchase_price": 1_000_000,
        "land_value": 10,
        "known_land_value": False,
        "zip_code": 85260,
        "property_type": "Office",
        "sqft_building": 38000,
        "acres_land": 2.0,
        "floors": 2,
        "multiple_properties": 1,
        "purchase_date": "2025-06-15",
        "tax_year": 2025,
        "tax_deadline": "October",
        "owner": "RCG Holdings LLC",
        "address": "12345 N 84th St, Scottsdale, AZ 85260",
        "capex": "No",
        "capex_amount": 0,
    }

    print("\n=== Testing Office Property (39-year) ===")
    final, breakdown = calc.final_quote(
        purchase_price=test_inputs["purchase_price"],
        land_value=test_inputs["land_value"],
        known_land_value=test_inputs["known_land_value"],
        zip_code=test_inputs["zip_code"],
        rush_label="No Rush",
        premium="No",
        referral="No",
        price_override=None,
    )
    print(f"\nFinal Quote: ${final:,.2f}")
    
    doc = calc.build_quote_doc(test_inputs, final, rush_fee=breakdown.get("rush_fee", 0))
    print(f"\nSchedule: {len(doc['schedule'])} years")
    print(f"Year 1 Bonus: ${doc['schedule'][0]['bonus_dep']:,.2f}")
    print(f"Year 1 Standard: ${doc['schedule'][0]['std_dep']:,.2f}")
    
    # Test Multi-Family (27.5-year)
    test_inputs["property_type"] = "Multi-Family"
    print("\n\n=== Testing Multi-Family (27.5-year) ===")
    doc2 = calc.build_quote_doc(test_inputs, final, rush_fee=0)
    print(f"Schedule: {len(doc2['schedule'])} years")
    print(f"Year 1 Bonus: ${doc2['schedule'][0]['bonus_dep']:,.2f}")
    