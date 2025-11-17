from __future__ import annotations

import os, json
from typing import Dict, Any, List
from datetime import datetime, timedelta
from decimal import Decimal, ROUND_HALF_UP
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import logging
import time

# -------- NEW PYTHON CALCULATOR (No Excel needed!) --------
from .calculator_adapter import compute_with_new_calculator
from .schemas import QuoteInputs, QuoteResult

# -------- COST SEGREGATION ENGINE --------
import sys
from pathlib import Path
# Add cost_seg directory to path
cost_seg_path = Path(__file__).parent.parent / 'cost_seg'
sys.path.insert(0, str(cost_seg_path))
from cost_seg_calculator import CostSegregationCalculator

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def round_to_pennies(value: float) -> float:
    """
    Deterministically round to pennies (2 decimal places)
    Uses Decimal for exact rounding, preventing floating-point drift
    """
    if value is None:
        return 0.0
    return float(Decimal(str(value)).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP))


def round_dict_to_pennies(d: Dict[str, Any]) -> Dict[str, Any]:
    """Round all numeric values in a dict to pennies"""
    result = {}
    for key, value in d.items():
        if isinstance(value, (int, float)):
            result[key] = round_to_pennies(value)
        elif isinstance(value, dict):
            result[key] = round_dict_to_pennies(value)
        else:
            result[key] = value
    return result


# -------- App setup --------
app = FastAPI(
    title="RCGV Cost Segregation Quote API",
    version="2.1.0",
    description="""
    **RCGV Valuation Cost Segregation Quote & Depreciation Engine**

    This API provides:
    - Cost segregation study pricing (`/quote/compute`)
    - Detailed depreciation schedules with 481(a) analysis (`/quote/document`)
    - Support for CapEx items with individual placed-in-service dates
    - ADS (Alternative Depreciation System) election
    - QIP (Qualified Improvement Property) classification

    ## Key Features

    - **481(a) Catch-Up Calculation**: Automatically calculates depreciation catch-up
    - **Bonus Depreciation**: Automatic detection by acquisition year, with override support
    - **CapEx Pools**: Individual depreciation for each capital expenditure
    - **ADS Election**: Longer lives (30/40yr), no bonus, straight-line depreciation
    - **QIP Support**: Qualified Improvement Property mapped to 15-year with bonus eligibility

    ## Phases

    - ✅ Phase 1: Frontend Wiring & UX
    - ✅ Phase 2: Engine/API Guardrails
    - ✅ Phase 3: CapEx Timing, ADS Election, QIP
    - ✅ Phase 4: CI/CD, OpenAPI, Observability
    """,
    contact={
        "name": "RCG Valuation",
        "url": "https://rcgvaluation.com",
        "email": "info@rcgvaluation.com"
    },
    license_info={
        "name": "Proprietary",
    }
)

# -------- CORS Configuration (CRITICAL for frontend) --------
# Environment-based CORS: Strict in production, permissive in dev
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")
IS_PRODUCTION = ENVIRONMENT == "production"

if IS_PRODUCTION:
    # Production: Strict CORS - only allow specific domains
    allowed_origins = [
        "https://rcgv-quote-assistant-f49ytx12k-rcg-valuation.vercel.app",
        "https://rcgv-quote-assistant.vercel.app",  # Production domain
        # Add additional production domains as needed
    ]
    logger.info("🔒 CORS: Production mode - Strict origins")
else:
    # Development: Allow localhost and wildcard for testing
    allowed_origins = [
        "*",  # Allow all in development
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
    ]
    logger.info("🔓 CORS: Development mode - Permissive origins")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# In-memory draft (swap to Supabase later)
CURRENT_DRAFT: Dict[str, Any] = {}

# -------- Quote API --------
@app.post("/quote/set_inputs")
def set_inputs(payload: Dict[str, Any]):
    global CURRENT_DRAFT
    CURRENT_DRAFT.update(payload or {})
    try:
        QuoteInputs(**CURRENT_DRAFT)  # optional validation
    except Exception:
        pass
    return {"ok": True, "draft": CURRENT_DRAFT}

@app.get("/quote/get_inputs")
def get_inputs():
    return {"draft": CURRENT_DRAFT}

@app.post(
    "/quote/compute",
    response_model=QuoteResult,
    summary="Compute Cost Segregation Quote",
    description="""
    Calculate pricing for a cost segregation study.

    **Fast endpoint** (~50ms) - Returns pricing only, no depreciation schedules.

    Use `/quote/document` for full depreciation analysis.
    """,
    response_description="Quote pricing with base and final amounts"
)
def compute_quote(
    inp: QuoteInputs = Body(
        ...,
        examples={
            "basic_multifamily": {
                "summary": "Basic Multi-Family Property",
                "description": "Simple multi-family property with percentage land value",
                "value": {
                    "purchase_price": 2550000,
                    "zip_code": 85250,
                    "land_value": 10,
                    "known_land_value": False,
                    "property_type": "Multi-Family",
                    "sqft_building": 25000,
                    "acres_land": 2.5,
                    "floors": 3
                }
            },
            "with_rush_fee": {
                "summary": "Property with Rush Fee",
                "description": "Commercial property with 2-week rush delivery",
                "value": {
                    "purchase_price": 5000000,
                    "zip_code": 10001,
                    "land_value": 1000000,
                    "known_land_value": True,
                    "property_type": "Office",
                    "rush": "2W $1000"
                }
            },
            "with_capex": {
                "summary": "Property with CapEx",
                "description": "Property with capital expenditures",
                "value": {
                    "purchase_price": 3000000,
                    "zip_code": 60601,
                    "land_value": 15,
                    "known_land_value": False,
                    "property_type": "Retail",
                    "capex": "Yes",
                    "capex_amount": 150000
                }
            }
        }
    )
):
    """
    PRIMARY ENDPOINT - Uses Python calculator (no Excel dependency)

    Returns pricing estimate (~50ms) without depreciation calculations.
    """
    start_time = time.time()

    base, final, breakdown = compute_with_new_calculator(inp)

    duration_ms = (time.time() - start_time) * 1000
    logger.info(f"route=/quote/compute duration_ms={duration_ms:.2f} price_base={base} price_final={final}")

    return QuoteResult(base_quote=base, final_quote=final, parts=breakdown)

def validate_quote_inputs(inp: QuoteInputs) -> None:
    """
    Strict input validation with helpful error messages
    Raises HTTPException with 400 status on validation failure
    """
    # Validate land value consistency
    if inp.known_land_value:
        # If known_land_value=true, should be dollar amount (>= property value * 0.01 typically)
        if inp.land_value > inp.purchase_price:
            raise HTTPException(
                status_code=400,
                detail=f"Land value (${inp.land_value:,.2f}) cannot exceed purchase price (${inp.purchase_price:,.2f})"
            )
        if inp.land_value < 0:
            raise HTTPException(status_code=400, detail="Land value cannot be negative")
    else:
        # If known_land_value=false, should be a percentage (0-1 or 0-100)
        # First check if it looks like they entered a dollar amount when they meant percent
        # Use threshold of 1000 to distinguish between invalid percentage and likely dollar amount
        if inp.land_value >= 1000 and inp.land_value < inp.purchase_price * 0.5:
            raise HTTPException(
                status_code=400,
                detail=f"Land value looks like a dollar amount (${inp.land_value:,.2f}) but known_land_value=false. "
                       "Set known_land_value=true for dollar amounts."
            )
        # Then validate percentage range
        if inp.land_value < 0 or inp.land_value > 100:
            raise HTTPException(
                status_code=400,
                detail=f"Land value percentage must be between 0-100 (got {inp.land_value})"
            )

    # Validate property size fields
    if inp.sqft_building and inp.sqft_building < 0:
        raise HTTPException(status_code=400, detail="Building square footage cannot be negative")
    if inp.sqft_building and inp.sqft_building > 10_000_000:
        raise HTTPException(
            status_code=400,
            detail=f"Building square footage ({inp.sqft_building:,.0f}) seems unusually large. Please verify."
        )

    if inp.acres_land and inp.acres_land < 0:
        raise HTTPException(status_code=400, detail="Land acreage cannot be negative")
    if inp.acres_land and inp.acres_land > 10_000:
        raise HTTPException(
            status_code=400,
            detail=f"Land acreage ({inp.acres_land:,.1f}) seems unusually large. Please verify."
        )

    # Validate purchase price
    if inp.purchase_price <= 0:
        raise HTTPException(status_code=400, detail="Purchase price must be greater than zero")
    if inp.purchase_price > 1_000_000_000:
        raise HTTPException(
            status_code=400,
            detail=f"Purchase price (${inp.purchase_price:,.2f}) exceeds $1B. Please verify."
        )

    # Validate CapEx
    if inp.capex == "Yes":
        if not inp.capex_amount or inp.capex_amount <= 0:
            raise HTTPException(
                status_code=400,
                detail="CapEx amount is required and must be greater than zero when capex='Yes'"
            )

    # Validate 1031 exchange
    if inp.is_1031 == "Yes":
        if not inp.pad_deferred_growth or inp.pad_deferred_growth <= 0:
            raise HTTPException(
                status_code=400,
                detail="PAD/deferred growth is required and must be greater than zero for 1031 exchanges"
            )


@app.post(
    "/quote/document",
    summary="Generate Full Depreciation Document",
    description="""
    Generate complete quote document with depreciation schedules and 481(a) analysis.

    **Slower endpoint** (~200ms) - Includes full depreciation calculations.

    Returns:
    - Pricing information
    - Payment plans
    - 10-year depreciation schedule
    - **depreciation_481a**: Detailed catch-up and current year breakdown
    - **notes**: Diagnostic information (CapEx count, ADS status, QIP count, etc.)

    ## Features

    - **481(a) Catch-Up**: Automatic calculation of prior-year depreciation
    - **Bonus Depreciation**: Auto-detected by acquisition year, overridable
    - **CapEx Pools**: Support for multiple CapEx items with individual PIS dates
    - **ADS Election**: Alternative Depreciation System (longer lives, no bonus)
    - **QIP Classification**: Qualified Improvement Property (15-year, bonus-eligible)
    """,
    response_description="Complete quote document with depreciation analysis"
)
def quote_document(
    inp: QuoteInputs = Body(
        ...,
        examples={
            "baseline_100_bonus": {
                "summary": "Baseline (100% Bonus)",
                "description": "Property acquired in 2019 with 100% bonus depreciation, CSS in 2021",
                "value": {
                    "purchase_price": 2550000,
                    "zip_code": 85250,
                    "land_value": 10,
                    "known_land_value": False,
                    "property_type": "Multi-Family",
                    "purchase_date": "2019-06-15",
                    "tax_year": 2021,
                    "sqft_building": 25000,
                    "acres_land": 2.5
                }
            },
            "bonus_override_60": {
                "summary": "Bonus Override (60%)",
                "description": "Property with forced 60% bonus depreciation rate",
                "value": {
                    "purchase_price": 2000000,
                    "zip_code": 85250,
                    "land_value": 10,
                    "known_land_value": False,
                    "property_type": "Multi-Family",
                    "purchase_date": "2024-06-15",
                    "tax_year": 2024,
                    "bonus_override": 60
                }
            },
            "with_capex_items_qip": {
                "summary": "CapEx Items with QIP",
                "description": "Property with multiple CapEx items including Qualified Improvement Property",
                "value": {
                    "purchase_price": 2550000,
                    "zip_code": 85250,
                    "land_value": 10,
                    "known_land_value": False,
                    "property_type": "Multi-Family",
                    "purchase_date": "2019-06-15",
                    "tax_year": 2021,
                    "capex_items": [
                        {
                            "description": "HVAC Upgrade",
                            "amount": 50000,
                            "placed_in_service_date": "2020-03-01",
                            "classification": "5_year"
                        },
                        {
                            "description": "Interior Improvements",
                            "amount": 100000,
                            "placed_in_service_date": "2020-06-15",
                            "classification": "QIP"
                        }
                    ]
                }
            },
            "ads_election": {
                "summary": "ADS Election",
                "description": "Property using Alternative Depreciation System (longer lives, no bonus, straight-line)",
                "value": {
                    "purchase_price": 2000000,
                    "zip_code": 85250,
                    "land_value": 10,
                    "known_land_value": False,
                    "property_type": "Multi-Family",
                    "purchase_date": "2024-06-15",
                    "tax_year": 2024,
                    "use_ads": True
                }
            }
        }
    )
):
    """
    Generate a complete quote document with payment schedule.

    Uses REAL depreciation engine with 481(a) catch-up logic.
    """
    start_time = time.time()

    # Strict input validation
    validate_quote_inputs(inp)

    # Calculate quote using new calculator
    base, final, breakdown = compute_with_new_calculator(inp)

    # Calculate land value in dollars
    if inp.known_land_value:
        land_value_dollars = inp.land_value
    else:
        pct = inp.land_value / 100.0 if inp.land_value > 1.0 else inp.land_value
        land_value_dollars = inp.purchase_price * pct

    building_value = inp.purchase_price - land_value_dollars + (inp.capex_amount or 0)

    # Payment options
    rush_fee = breakdown.get('rush_fee', 0.0)
    pay_upfront = round(final * 0.91, 2)  # 9% discount
    pay_50_50 = round(final / 2.0, 2)
    pay_over_time = round(final / 4.0, 2)

    # ========== REAL DEPRECIATION ENGINE ==========
    # Determine property type for cost seg engine
    # Only Multi-Family and Residential/LTR are true residential (27.5yr)
    # Short-Term Rentals are commercial property (39yr)
    property_type_map = {
        "Multi-Family": "multi-family",
        "Residential/LTR": "multi-family",
    }
    css_property_type = property_type_map.get(inp.property_type, "commercial")

    # Parse dates
    acquisition_date = inp.purchase_date or datetime.now().date()
    if isinstance(acquisition_date, str):
        acquisition_date = datetime.strptime(acquisition_date, "%Y-%m-%d").date()

    # CSS date is the tax filing year
    css_year = inp.tax_year or datetime.now().year
    css_date = datetime(css_year, 12, 31)

    # Calculate PAD and deferred gain for 1031 exchanges
    pad = 0
    deferred_gain = 0
    if inp.is_1031 == "Yes" and inp.pad_deferred_growth:
        pad = float(inp.pad_deferred_growth)

    # Prepare CapEx items if provided
    capex_items_list = None
    if inp.capex_items:
        capex_items_list = [
            {
                'amount': float(item.amount),
                'placed_in_service_date': item.placed_in_service_date,
                'classification': item.classification,
                'description': item.description
            }
            for item in inp.capex_items
        ]
        logger.info(f"Processing {len(capex_items_list)} CapEx items")

    # Initialize Cost Segregation Calculator
    try:
        calc = CostSegregationCalculator(
            purchase_price=inp.purchase_price,
            land_value=land_value_dollars,
            capex=inp.capex_amount or 0,
            pad=pad,
            deferred_gain=deferred_gain,
            acquisition_date=acquisition_date,
            css_date=css_date,
            property_type=css_property_type,
            year_built=inp.year_built or acquisition_date.year,  # Use provided year_built or acquisition year
            capex_items=capex_items_list,
            use_ads=inp.use_ads or False,
            bonus_override=inp.bonus_override
        )

        # Log key calculation parameters
        logger.info(f"=== Cost Seg Calculation ===")
        logger.info(f"Purchase Price: ${inp.purchase_price:,.2f}")
        logger.info(f"Land Value: ${land_value_dollars:,.2f}")
        logger.info(f"Building Value: ${building_value:,.2f}")
        logger.info(f"Bonus Rate Detected: {calc.bonus_rate}%")
        logger.info(f"Acquisition Date: {acquisition_date}")
        logger.info(f"CSS Tax Year: {css_year}")
        logger.info(f"Years Elapsed: {css_date.year - acquisition_date.year}")
        logger.info(f"Property Type: {css_property_type}")

        # Calculate 481(a) adjustment
        adjustment_481a = calc.calculate_481a_adjustment()

        logger.info(f"481(a) Catch-Up: ${adjustment_481a['catch_up_adjustment']:,.2f}")
        logger.info(f"Current Year Depreciation: ${adjustment_481a['current_year_total']:,.2f}")
        logger.info(f"Total First-Year Benefit: ${adjustment_481a['total_current_year_benefit']:,.2f}")

        # Generate depreciation schedules - ENGINE-BACKED (no stubs)
        # Uses engine's calculate_current_year_depreciation + CapEx/ADS/QIP logic
        # Use full depreciation period: Need extra year for mid-month/mid-quarter convention
        # 29 years for 27.5yr (accounts for mid-month convention in first/last year)
        # 41 years for 39yr (accounts for mid-month convention in first/last year)
        if css_property_type == "multi-family":
            schedule_years = 29  # 27.5-year residential + convention
        else:
            schedule_years = 41  # 39-year commercial + convention

        # Generate TWO schedules:
        # 1. WITH bonus depreciation (for bonus_dep column)
        full_schedule_with_bonus = calc.generate_depreciation_schedule(years=schedule_years)

        # 2. WITHOUT bonus depreciation (for trad_cost_seg column) - traditional cost seg
        calc_no_bonus = CostSegregationCalculator(
            purchase_price=inp.purchase_price,
            land_value=land_value_dollars,
            capex=inp.capex_amount or 0,
            pad=pad,
            deferred_gain=deferred_gain,
            acquisition_date=acquisition_date,
            css_date=css_date,
            property_type=css_property_type,
            year_built=inp.year_built or acquisition_date.year,
            capex_items=capex_items_list,
            use_ads=inp.use_ads or False,
            bonus_override=0  # NO BONUS for traditional cost seg
        )
        full_schedule_no_bonus = calc_no_bonus.generate_depreciation_schedule(years=schedule_years)

        # Build schedule in format expected by frontend
        schedule = []
        for idx, year_data_bonus in enumerate(full_schedule_with_bonus):
            year_num = year_data_bonus['year']
            year_data_no_bonus = full_schedule_no_bonus[idx]

            # Bonus depreciation schedule (WITH bonus)
            bonus_dep = year_data_bonus['depreciation_total']

            # Traditional cost seg schedule (WITHOUT bonus)
            trad_cost_seg = year_data_no_bonus['depreciation_total']

            # Standard straight-line depreciation (annual increment)
            # For year 1: total through year 1
            # For year N: total through year N minus total through year N-1
            if year_num == 1:
                std_dep = calc.calculate_standard_depreciation(1)
            else:
                std_dep = (calc.calculate_standard_depreciation(year_num) -
                          calc.calculate_standard_depreciation(year_num - 1))

            # Cost seg estimate is the bonus schedule (what they actually get)
            cost_seg_est = bonus_dep

            schedule.append({
                "year": year_num,
                "cost_seg_est": round_to_pennies(cost_seg_est),
                "std_dep": round_to_pennies(std_dep),
                "trad_cost_seg": round_to_pennies(trad_cost_seg),
                "bonus_dep": round_to_pennies(bonus_dep)
            })

        # Calculate totals from schedule (single source of truth)
        total_cost_seg = sum(s["cost_seg_est"] for s in schedule)
        total_std_dep = sum(s["std_dep"] for s in schedule)
        total_trad = sum(s["trad_cost_seg"] for s in schedule)

        logger.info(f"Schedule Generated: {len(schedule)} years (engine-backed)")
        logger.info(f"Total Cost Seg: ${total_cost_seg:,.2f}")
        logger.info(f"Total Standard: ${total_std_dep:,.2f}")

        # Calculate current year number for remaining basis/life calculations
        current_year_number = adjustment_481a['years_elapsed'] + 1 if adjustment_481a['years_elapsed'] > 0 else 1

        # Calculate remaining basis and life
        remaining_basis = calc.calculate_remaining_basis_by_class(current_year_number)
        life_remaining = calc.calculate_life_remaining_by_class(current_year_number)

        # Get the dynamic building key (27.5yr, 39yr, 30yr, or 40yr)
        building_key = calc._building_key()

        # Build current_year_depreciation_by_class with dynamic building key
        current_raw = adjustment_481a['current_year_depreciation']
        current_year_by_class = {
            "5yr": round_to_pennies(current_raw.get('5yr', 0)),
            "7yr": round_to_pennies(current_raw.get('7yr', 0)),
            "15yr": round_to_pennies(current_raw.get('15yr', 0)),
            building_key: round_to_pennies(
                current_raw.get('27.5yr', 0) +
                current_raw.get('39yr', 0) +
                current_raw.get('30yr', 0) +
                current_raw.get('40yr', 0)
            )
        }

        # Build remaining_basis_by_class with dynamic building key
        remaining_by_class = {
            "5yr": round_to_pennies(remaining_basis.get('5yr', 0)),
            "7yr": round_to_pennies(remaining_basis.get('7yr', 0)),
            "15yr": round_to_pennies(remaining_basis.get('15yr', 0)),
            building_key: round_to_pennies(
                remaining_basis.get('27.5yr', 0) +
                remaining_basis.get('39yr', 0) +
                remaining_basis.get('30yr', 0) +
                remaining_basis.get('40yr', 0)
            )
        }

        # Verify sum equals total after rounding
        computed_sum = sum(current_year_by_class.values())
        expected_total = round_to_pennies(adjustment_481a['current_year_total'])

        # Log warning if there's drift (shouldn't happen with Decimal rounding)
        if abs(computed_sum - expected_total) > 0.01:
            logger.warning(f"Rounding drift detected: sum({computed_sum}) != total({expected_total})")

        depreciation_481a = {
            "bonus_rate_detected": calc.bonus_rate,
            "years_elapsed": adjustment_481a['years_elapsed'],
            "481a_should_have_taken": round_to_pennies(adjustment_481a['should_have_taken']),
            "481a_did_take": round_to_pennies(adjustment_481a['did_take']),
            "481a_catch_up": round_to_pennies(adjustment_481a['catch_up_adjustment']),
            "current_year_depreciation_by_class": current_year_by_class,
            "current_year_total": expected_total,  # Use rounded total
            "total_first_year_benefit": round_to_pennies(adjustment_481a['total_current_year_benefit']),
            # New fields for transparency
            "remaining_basis_by_class": remaining_by_class,
            "life_remaining_by_class": life_remaining  # Years or "Complete"
        }

    except Exception as e:
        logger.error(f"Error in depreciation calculation: {str(e)}")
        logger.exception(e)
        # Minimal fallback - return empty schedule and let frontend handle gracefully
        schedule = []
        total_cost_seg = 0
        total_std_dep = 0
        total_trad = 0
        depreciation_481a = None

    # Format dates
    quote_date = datetime.now().strftime("%Y-%m-%d")
    valid_until = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
    purchase_date_str = acquisition_date.strftime("%Y-%m-%d") if hasattr(acquisition_date, 'strftime') else str(acquisition_date)
    due_date_label = f"{inp.tax_deadline or 'October'} {inp.tax_year or datetime.now().year}"

    # Invariant checks: Lifetime totals must reconcile to expected total
    # For same-year, each schedule sum must equal basis
    # For later-year CSS, each == basis - SL through prior year
    if 'calc' in locals() and schedule:
        basis = Decimal(str(calc.total_depreciable))
        css_year = css_date.year
        acq_year = acquisition_date.year if hasattr(acquisition_date, 'year') else acquisition_date

        if css_year == acq_year:
            # Same year: all schedules should equal full basis
            expected_total = basis
        else:
            # Later year: should equal basis - SL through prior year
            years_elapsed = css_year - acq_year
            sl_prior = Decimal(str(calc.calculate_standard_depreciation(years_elapsed)))
            expected_total = basis - sl_prior

        # Use lifetime totals (full recovery horizon), NOT the 10-year slice, for reconciliation.
        # Pass from_css_year=True to get remaining life from CSS year forward
        lt = calc.lifetime_totals(from_css_year=True)
        std_total = lt["standard"]
        trad_total = lt["traditional"]
        bonus_total = lt["bonus"]

        exp = expected_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Calculate expected totals for each method
        # Standard method: basis only (CapEx not depreciated under standard)
        exp_std = exp
        # Traditional/Bonus: basis + CapEx
        capex_total = Decimal("0")
        if calc.capex_pools:
            for pool in calc.capex_pools:
                capex_total += Decimal(str(pool.amount))
        exp_trad = exp + capex_total
        exp_bonus = exp + capex_total

        # Allow small rounding tolerance (1 cent)
        tolerance = Decimal("0.01")
        if not (abs(std_total - exp_std) <= tolerance and abs(trad_total - exp_trad) <= tolerance and abs(bonus_total - exp_bonus) <= tolerance):
            logger.error(
                f"Lifetime totals invariant violation: "
                f"exp_std={float(exp_std)}, std={float(std_total)}, "
                f"exp_trad={float(exp_trad)}, trad={float(trad_total)}, "
                f"exp_bonus={float(exp_bonus)}, bonus={float(bonus_total)}"
            )
            raise HTTPException(
                status_code=400,
                detail={
                    "error": "Lifetime totals do not reconcile to expected totals",
                    "expected_standard": float(exp_std),
                    "expected_traditional": float(exp_trad),
                    "expected_bonus": float(exp_bonus),
                    "std_total": float(std_total),
                    "trad_total": float(trad_total),
                    "bonus_total": float(bonus_total),
                    "message": "Internal calculation error - please contact support"
                },
            )

        logger.info(f"Lifetime invariant check passed: exp_std={float(exp_std)}, std={float(std_total)}, exp_trad={float(exp_trad)}, trad={float(trad_total)}, bonus={float(bonus_total)}")

    # Build notes object for diagnostic/transparency
    notes = {
        "capex_items_count": len(capex_items_list) if capex_items_list else 0,
        "ads_applied": inp.use_ads or False,
        "qip_count": sum(1 for item in (inp.capex_items or []) if item.classification == "QIP"),
        "capex_total_basis": sum(float(item.amount) for item in (inp.capex_items or [])) if inp.capex_items else 0,
        "bonus_rate_detected": calc.bonus_rate if 'calc' in locals() else None,
        "building_key": building_key if 'building_key' in locals() else None,
        "schedule_span": calc.schedule_span() if 'calc' in locals() else "10y",
        "lifetime_totals": {
            "standard": float(std_total) if 'std_total' in locals() else 0,
            "traditional": float(trad_total) if 'trad_total' in locals() else 0,
            "bonus": float(bonus_total) if 'bonus_total' in locals() else 0
        } if 'calc' in locals() else None
    }

    # Structured logging (no PII)
    duration_ms = (time.time() - start_time) * 1000
    logger.info(
        f"route=/quote/document "
        f"duration_ms={duration_ms:.2f} "
        f"bonus_rate_detected={notes['bonus_rate_detected']} "
        f"ads_applied={notes['ads_applied']} "
        f"capex_items_count={notes['capex_items_count']} "
        f"qip_count={notes['qip_count']} "
        f"years_elapsed={depreciation_481a['years_elapsed'] if depreciation_481a else 'N/A'} "
        f"481a_catch_up={depreciation_481a['481a_catch_up'] if depreciation_481a else 0:.2f}"
    )

    # Add depreciation period to property label
    dep_period = "27.5yr" if css_property_type == "multi-family" else "39yr"
    property_type_display = inp.property_type or "Multi-Family"
    property_label_with_period = f"{property_type_display} ({dep_period})"

    return {
        # Header
        "company": "Valued Client",
        "property_label": property_label_with_period,
        "property_address": "Property Address",
        "purchase_price": inp.purchase_price,
        "capex_amount": inp.capex_amount or 0,
        "building_value": round(building_value, 2),
        "land_value": round(land_value_dollars, 2),
        "purchase_date": purchase_date_str,
        "sqft_building": inp.sqft_building,
        "acres_land": inp.acres_land,
        "due_date_label": due_date_label,
        "quote_date": quote_date,
        "valid_until": valid_until,

        # Contact info
        "rcg_contact_name": "Scott Roelofs",
        "rcg_contact_office": "331.248.7245",
        "rcg_contact_cell": "480.276.5626",
        "rcg_contact_email": "info@rcgvaluation.com",
        "rcg_contact_site": "rcgvaluation.com",
        "rcg_address": "6929 N Hayden Rd Suite C4-494, Scottsdale, AZ 85250",

        # Payments
        "payments": {
            "originally_quoted": final,
            "rush_fee": rush_fee,
            "pay_upfront": pay_upfront,
            "pay_50_50": pay_50_50,
            "pay_over_time_amount": pay_over_time,
            "pay_over_time_note": "Quarterly installments"
        },

        # Schedule
        "schedule": schedule,

        # Totals
        "total_cost_seg_est": round(total_cost_seg, 2),
        "total_std_dep": round(total_std_dep, 2),
        "total_trad_cost_seg": round(total_trad, 2),

        # 481(a) Depreciation Breakdown
        # 481(a) = accumulated cost-seg (through prior year) − accumulated straight-line (through prior year)
        # total_first_year_benefit = 481(a) catch-up + current-year depreciation
        "depreciation_481a": depreciation_481a,

        # Notes object for transparency and diagnostics
        "notes": notes
    }

@app.post("/quote/save_draft")
def save_draft():
    return {"ok": True, "draft": CURRENT_DRAFT}

@app.get("/quote/load_draft")
def load_draft():
    return {"ok": True, "draft": CURRENT_DRAFT}

# -------- AgentKit + ChatKit (OpenAI client) --------
from openai import OpenAI

def get_openai_client():
    key = os.environ.get("OPENAI_API_KEY")
    if not key:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY not configured.")
    return OpenAI(api_key=key)

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "quote_set_inputs",
            "description": "Upsert any provided quote inputs into the working draft.",
            "parameters": {
                "type": "object",
                "properties": {
                    "purchase_price": {"type": "number"},
                    "zip_code": {"type": "integer"},
                    "land_value": {"type": "number", "description": "Percent if known_land_value=false, dollars if True"},
                    "known_land_value": {"type": "boolean"},
                    "property_type": {"type": "string"},
                    "sqft_building": {"type": "number"},
                    "acres_land": {"type": "number"},
                    "floors": {"type": "integer"},
                    "multiple_properties": {"type": "integer"},
                    "purchase_date": {"type": "string", "format": "date"},
                    "tax_year": {"type": "integer"},
                    "pad_deferred_growth": {"type": "boolean"},
                    "is_1031": {"type": "string", "enum": ["Yes","No"]},
                    "capex": {"type": "string", "enum": ["Yes","No"]},
                    "capex_amount": {"type": "number"},
                    "capex_date": {"type": "string", "format": "date"},
                    "price_override": {"type": "number"},
                    "rush": {"type": "string", "enum": ["No Rush","4W $500","2W $1000"]},
                    "premium": {"type": "string", "enum": ["Yes","No"]},
                    "referral": {"type": "string", "enum": ["Yes","No"]},
                    "name": {"type": "string", "description": "Client name"},
                    "email": {"type": "string", "description": "Client email"},
                    "phone": {"type": "string", "description": "Client phone"}
                }
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "quote_compute",
            "description": "Compute the quote using provided inputs. Returns base and final pricing.",
            "parameters": {
                "type": "object",
                "properties": {
                    "purchase_price": {"type": "number"},
                    "zip_code": {"type": "integer"},
                    "land_value": {"type": "number"},
                    "known_land_value": {"type": "boolean"},
                    "rush": {"type": "string", "enum": ["No Rush","4W $500","2W $1000"]},
                    "premium": {"type": "string", "enum": ["Yes","No"]},
                    "referral": {"type": "string", "enum": ["Yes","No"]},
                    "price_override": {"type": "number"}
                },
                "required": ["purchase_price","zip_code","land_value","known_land_value"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "quote_submit_request",
            "description": "Signal that the user wants to submit their quote. Only call this when user explicitly requests to submit/send the quote.",
            "parameters": {
                "type": "object",
                "properties": {
                    "confirm": {"type": "boolean", "description": "Set to true to confirm submission intent"}
                },
                "required": ["confirm"]
            }
        }
    }
]

SYSTEM_PROMPT = """You are RCGV's friendly AI assistant for cost segregation quoting. You help clients through a conversational process to get accurate quotes.

Your Personality:
- Warm, professional, and helpful
- Patient and encouraging
- Speak naturally, as if having a conversation
- Use "I" and "you" (e.g., "I can help you with that")
- Acknowledge what they say before asking for more info

Your Goals:
1. Guide users through filling out the quote form conversationally
2. Ask for missing information one question at a time
3. Compute quotes when you have the required information
4. Offer to submit the quote when they're satisfied

Workflow:
1. Greet new users warmly and ask how you can help
2. Listen to their needs and extract information from what they say
3. Use quote_set_inputs to store any information they provide
4. Ask for missing required fields: purchase_price, zip_code, land_value, known_land_value
5. When you have all required fields, use quote_compute to calculate the quote
6. Present the quote clearly and ask if they want to make any adjustments
7. When they're ready, offer to submit the quote using quote_submit_request

Required Fields for Quote:
- purchase_price (dollar amount)
- zip_code (5-digit ZIP code)
- land_value (percentage or dollar amount)
- known_land_value (true if dollar amount, false if percentage)

Optional Fields (ask if relevant):
- property_type (e.g., Multi-Family, Office, Retail, Industrial, etc.)
- rush (options: "No Rush", "4W $500", "2W $1000")
- premium (options: "Yes", "No")
- referral (options: "Yes", "No")
- Contact info: name, email, phone

Response Style:
- After computing a quote, present it clearly:
  "Great news! Here's your quote:
  • Base Price: $X,XXX
  • Final Price: $X,XXX (after adjustments)

  This includes [briefly mention key factors].

  Would you like to adjust rush delivery, premium service, or submit this quote?"

- Be conversational: "I see you have a multi-family property..." rather than just listing facts
- Celebrate progress: "Perfect!" "Got it!" "Excellent!"
- Offer next steps: "What would you like to do next?" "Shall I submit this for you?"

Rules:
- If land is a percent, set known_land_value=False; if dollar amount, set known_land_value=True
- Validate: zip_code (00000-99999), land percent (0-100 or 0-1)
- Always be encouraging and positive
- When user says "submit" or "send", use quote_submit_request tool
"""

class ChatRequest(BaseModel):
    messages: List[Dict[str, Any]]

def _tool_quote_set_inputs(args: Dict[str, Any]) -> Dict[str, Any]:
    global CURRENT_DRAFT
    CURRENT_DRAFT.update(args or {})
    return {"ok": True, "draft": CURRENT_DRAFT}

def _tool_quote_compute(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Agent tool for computing quotes - uses NEW Python calculator
    """
    payload = {**CURRENT_DRAFT, **(args or {})}
    qi = QuoteInputs(**payload)
    base, final, breakdown = compute_with_new_calculator(qi)
    return {"base_quote": base, "final_quote": final, "parts": breakdown, "action": "compute"}

def _tool_quote_submit_request(args: Dict[str, Any]) -> Dict[str, Any]:
    """
    Agent tool to signal quote submission request.
    This doesn't actually submit - it signals the frontend to handle submission.
    """
    if args.get("confirm"):
        return {
            "ok": True,
            "message": "Quote submission requested. Preparing to submit...",
            "action": "submit"
        }
    return {"ok": False, "message": "Submission not confirmed"}

_TOOL_REGISTRY = {
    "quote_set_inputs": _tool_quote_set_inputs,
    "quote_compute": _tool_quote_compute,
    "quote_submit_request": _tool_quote_submit_request,
}

@app.post("/agent/chat")
def agent_chat(req: ChatRequest):
    client = get_openai_client()
    messages = [{"role": "system", "content": SYSTEM_PROMPT}] + req.messages

    # seed known draft so the model knows what we already have
    if CURRENT_DRAFT:
        messages.insert(1, {
            "role": "system",
            "content": f"Current known inputs (JSON): {json.dumps(CURRENT_DRAFT)}"
        })

    # Track any action signals from tools
    action_signal = None

    # loop tool-calls until final answer
    for _ in range(6):
        resp = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=TOOLS,
            tool_choice="auto"
        )
        choice = resp.choices[0]
        msg = choice.message

        if getattr(msg, "tool_calls", None):
            # record assistant msg with tool calls
            messages.append({
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": [
                    {"id": tc.id, "type":"function",
                     "function": {"name": tc.function.name, "arguments": tc.function.arguments}}
                    for tc in msg.tool_calls
                ]
            })
            # execute tools and append tool results
            for tc in msg.tool_calls:
                name = tc.function.name
                args = json.loads(tc.function.arguments or "{}")
                fn = _TOOL_REGISTRY.get(name)
                tool_out = {"error": f"Unknown tool {name}"} if not fn else fn(args)

                # Capture action signal from tool result
                if isinstance(tool_out, dict) and "action" in tool_out:
                    action_signal = tool_out["action"]

                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "name": name,
                    "content": json.dumps(tool_out)
                })
            continue

        # no tool calls → final reply
        response = {"reply": msg.content, "draft": CURRENT_DRAFT}
        if action_signal:
            response["action"] = action_signal
        return response

    return {"reply": "I hit the tool-call step limit. Please try again with more detail."}

@app.get("/agent/envcheck")
def envcheck():
    """QA-only endpoint - Check environment configuration"""
    if IS_PRODUCTION:
        raise HTTPException(status_code=404, detail="Not found")
    return {
        "has_key": bool(os.environ.get("OPENAI_API_KEY")),
        "environment": ENVIRONMENT,
        "is_production": IS_PRODUCTION
    }

@app.get("/")
def root():
    return {
        "ok": True,
        "service": "RCGV Cost Segregation Quote API",
        "version": "2.1.0",
        "calculator": "Python-based (no Excel dependency)",
        "environment": ENVIRONMENT,
        "docs": "/docs",
        "health": "/healthz"
    }

# ---- Health check for deployment ----
@app.get("/health")
def health_check():
    """Detailed health check with system info"""
    return {
        "status": "healthy",
        "version": "2.1.0",
        "calculator": "python",
        "environment": ENVIRONMENT,
        "features": {
            "capex_pools": True,
            "ads_election": True,
            "qip_classification": True,
            "481a_catch_up": True
        },
        "cors": "environment-based"
    }

@app.get("/healthz")
def healthz():
    """Simple health check endpoint for Vercel and other monitoring"""
    return {"status": "ok", "version": "2.1.0"}

# ---- OPTIONS preflight for CORS ----
@app.options("/{rest_of_path:path}")
async def preflight_handler(rest_of_path: str):
    """Handle CORS preflight requests"""
    return {"message": "OK"}