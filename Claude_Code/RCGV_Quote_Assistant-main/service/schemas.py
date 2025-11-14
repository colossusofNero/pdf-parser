# service/schemas.py
# Pydantic v2-compatible schemas for the quote service

from __future__ import annotations
from typing import Optional, Literal, Dict, List
from datetime import date
from decimal import Decimal
from pydantic import BaseModel, Field, field_validator, condecimal, model_validator

PropertyType = Literal[
    "Multi-Family", "Residential/LTR", "Short-Term Rental",
    "Office", "Retail", "Industrial", "Warehouse",
    "Hotel", "Medical", "Restaurant", "Mixed-Use", "Other"
]

RushType = Literal["No Rush", "4W $500", "2W $1000"]

AssetClassification = Literal["QIP", "5_year", "7_year", "15_year", "27_5_year", "39_year"]


class CapexItem(BaseModel):
    """
    Individual CapEx item with its own placed-in-service date and optional classification
    """
    description: Optional[str] = None
    amount: condecimal(gt=0) = Field(..., description="CapEx amount (must be positive)")
    placed_in_service_date: date = Field(..., description="Date when CapEx was placed in service")
    classification: Optional[AssetClassification] = Field(
        default=None,
        description="Optional asset class override (e.g., 'QIP' for Qualified Improvement Property)"
    )

    @field_validator("amount")
    @classmethod
    def _validate_amount(cls, v):
        if v <= 0:
            raise ValueError("CapEx amount must be positive")
        return v


class QuoteInputs(BaseModel):
    # Required for compute
    purchase_price: float
    zip_code: int
    land_value: float                     # percent if known_land_value=False, dollars if True
    known_land_value: bool = False

    # Optional business fields (kept for future use/validation)
    property_type: Optional[PropertyType] = None
    sqft_building: Optional[float] = None
    acres_land: Optional[float] = None
    floors: Optional[int] = None
    multi_properties: Optional[int] = Field(default=None, alias="multiple_properties")
    purchase_date: Optional[date] = None
    tax_year: Optional[int] = None
    tax_deadline: Optional[str] = None
    pad_deferred_growth: Optional[float] = None  # PAD (Prior Accumulated Depreciation) for 1031 exchanges
    is_1031: Optional[Literal["Yes", "No"]] = "No"
    capex: Optional[Literal["Yes", "No"]] = "No"
    capex_amount: Optional[float] = 0
    capex_date: Optional[date] = None
    price_override: Optional[float] = None
    rush: RushType = "No Rush"
    premium: Literal["Yes", "No"] = "No"
    referral: Literal["Yes", "No"] = "No"
    bonus_override: Optional[int] = Field(default=None, ge=0, le=100,
                                          description="Override bonus depreciation rate (0-100%). If provided, supersedes automatic detection.")

    # Phase 3: CapEx timing, ADS, QIP
    capex_items: Optional[List[CapexItem]] = Field(
        default=None,
        description="List of individual CapEx items with their own placed-in-service dates. If provided, supersedes legacy capex_amount."
    )
    use_ads: Optional[bool] = Field(
        default=False,
        description="Use Alternative Depreciation System (ADS): longer lives, no bonus, straight-line. Residential=30yr, Nonresidential=40yr."
    )

    @field_validator("zip_code")
    @classmethod
    def _zip_range(cls, v: int) -> int:
        if not (0 <= v <= 99999):
            raise ValueError("zip_code must be between 00000 and 99999")
        return v

    @field_validator("bonus_override")
    @classmethod
    def _bonus_range(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and not (0 <= v <= 100):
            raise ValueError("bonus_override must be between 0 and 100")
        return v

    @model_validator(mode='after')
    def _validate_ads_bonus_conflict(self):
        """ADS election disallows bonus depreciation"""
        if self.use_ads and self.bonus_override is not None:
            raise ValueError("use_ads=true disallows bonus_override. ADS uses straight-line with no bonus depreciation.")
        return self


class QuoteResult(BaseModel):
    base_quote: float
    final_quote: float
    parts: Dict


class PaymentPlan(BaseModel):
    originally_quoted: float
    rush_fee: float
    pay_upfront: float
    pay_50_50: float
    pay_over_time_amount: float
    pay_over_time_note: str = "Up to 36 months"


class ScheduleRow(BaseModel):
    year: int
    cost_seg_est: float
    std_dep: float
    trad_cost_seg: float
    bonus_dep: float


class QuoteDoc(BaseModel):
    # header
    company: str = "Valued Client"
    property_label: str = "Multi-Family Property"
    property_address: str
    purchase_price: float
    capex_amount: float
    building_value: float
    land_value: float
    purchase_date: str
    sqft_building: Optional[float] = None
    acres_land: Optional[float] = None
    due_date_label: str
    rcg_contact_name: str = "Scott Roelofs"
    rcg_contact_office: str = "331.248.7245"
    rcg_contact_cell: str = "480.276.5626"
    rcg_contact_email: str = "info@rcgvaluation.com"
    rcg_contact_site: str = "rcgvaluation.com"
    rcg_address: str = "6929 N Hayden Rd Suite C4-494, Scottsdale, AZ 85250"

    # pricing panel
    payments: PaymentPlan

    # table
    schedule: List[ScheduleRow]

    # totals footer (right under table)
    total_cost_seg_est: float
    total_std_dep: float
    total_trad_cost_seg: float