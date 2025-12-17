"""
Cost Segregation Depreciation Calculator
Handles MACRS depreciation with bonus depreciation and 481(a) adjustments
"""

from datetime import datetime
import math
from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Tuple

# Try relative import first, fall back to direct import
try:
    from .macrs_tables import get_macrs_percentage, get_accumulated_depreciation
except ImportError:
    from macrs_tables import get_macrs_percentage, get_accumulated_depreciation

# Bonus Depreciation Schedule (using date objects for comparison)
from datetime import date
BONUS_SCHEDULE = [
    {'start': date(2025, 1, 20), 'end': None, 'rate': 100},
    {'start': date(2025, 1, 1), 'end': date(2025, 1, 19), 'rate': 40},
    {'start': date(2024, 1, 1), 'end': date(2024, 12, 31), 'rate': 60},
    {'start': date(2023, 1, 1), 'end': date(2023, 12, 31), 'rate': 80},
    {'start': date(2017, 9, 27), 'end': date(2022, 12, 31), 'rate': 100},
]

def get_bonus_rate(acquisition_date):
    """
    Get bonus depreciation rate based on acquisition date
    
    Args:
        acquisition_date: datetime object
    
    Returns:
        Bonus depreciation percentage (0-100)
    """
    for period in BONUS_SCHEDULE:
        if period['end'] is None:
            if acquisition_date >= period['start']:
                return period['rate']
        elif period['start'] <= acquisition_date <= period['end']:
            return period['rate']
    return 0

def calculate_age_adjustment(year_built, current_year):
    """
    Calculate logistic curve age adjustment factor
    
    Args:
        year_built: Year property was built
        current_year: Current year for calculation
    
    Returns:
        Adjustment factor (0.0 to 1.0)
    """
    age = current_year - year_built
    
    # Logistic curve parameters
    X0 = 0  # Inflection point
    L = 0.5  # Maximum value
    K = 0.01  # Steepness
    
    # Logistic curve: L / (1 + e^(-K*(age-X0)))
    logistic_value = L / (1 + math.exp(-K * (age - X0)))
    
    return logistic_value

def calculate_allocation_percentages(property_type, year_built, current_year, base_allocations):
    """
    Calculate age-adjusted allocation percentages
    
    Args:
        property_type: 'multi-family' or 'commercial'
        year_built: Year property was built
        current_year: Current year
        base_allocations: Dict with base percentages for each asset class
    
    Returns:
        Dict with adjusted allocation percentages
    """
    age_factor = calculate_age_adjustment(year_built, current_year)
    
    # 22% multiplier for the adjustment
    adjustment_factor = age_factor * 0.22
    
    # Determine building asset class
    building_class = '27.5yr' if property_type == 'multi-family' else '39yr'
    building_base = base_allocations[building_class]
    
    # Calculate reduction in building allocation
    building_reduction = adjustment_factor * building_base
    
    # Adjusted allocations
    adjusted = base_allocations.copy()
    adjusted[building_class] = building_base * (1 - adjustment_factor)
    adjusted['15yr'] = base_allocations['15yr'] + building_reduction
    
    return adjusted

class CapexPool:
    """
    Represents a single CapEx item with its own placed-in-service date and classification
    """
    def __init__(self, amount, pis_date, classification=None, bonus_rate=None, use_ads=False):
        self.amount = amount
        # Convert pis_date to date object for bonus rate comparison
        if hasattr(pis_date, 'hour'):  # It's a datetime
            self.pis_date = pis_date.date()
        elif isinstance(pis_date, str):
            self.pis_date = datetime.strptime(pis_date, '%Y-%m-%d').date()
        else:  # Already a date
            self.pis_date = pis_date
        self.classification = classification
        self.use_ads = use_ads

        # Determine bonus rate (can be overridden)
        if use_ads:
            self.bonus_rate = 0  # ADS disallows bonus
        elif bonus_rate is not None:
            self.bonus_rate = bonus_rate
        else:
            self.bonus_rate = get_bonus_rate(self.pis_date)

        # Map classification to asset class
        self.asset_class = self._get_asset_class()

    def _get_asset_class(self):
        """Map classification to standard asset class"""
        if self.classification == "QIP":
            return "15yr"  # QIP is 15-year property
        elif self.classification == "5_year":
            return "5yr"
        elif self.classification == "7_year":
            return "7yr"
        elif self.classification == "15_year":
            return "15yr"
        elif self.classification == "27_5_year":
            return "27.5yr"
        elif self.classification == "39_year":
            return "39yr"
        else:
            # Default to 5yr for CapEx if not specified
            return "5yr"


class CostSegregationCalculator:
    def __init__(self,
                 purchase_price,
                 land_value,
                 capex=0,
                 pad=0,
                 deferred_gain=0,
                 acquisition_date=None,
                 css_date=None,
                 property_type='commercial',
                 year_built=None,
                 allocations=None,
                 capex_items=None,
                 use_ads=False,
                 bonus_override=None):
        """
        Initialize Cost Segregation Calculator

        Args:
            purchase_price: Total purchase price
            land_value: Land value (non-depreciable)
            capex: Capital expenditures (legacy - superseded by capex_items)
            pad: Prior Accumulated Depreciation (1031 exchange)
            deferred_gain: Deferred gain (1031 exchange)
            acquisition_date: Date property was acquired
            css_date: Date of cost segregation study / tax filing year
            property_type: 'multi-family' or 'commercial'
            year_built: Year property was built
            allocations: Dict with allocation percentages for each asset class
            capex_items: List of CapEx items with individual PIS dates
            use_ads: Use Alternative Depreciation System (no bonus, longer lives)
            bonus_override: Override bonus rate (0-100) if provided
        """
        self.purchase_price = purchase_price
        self.land_value = land_value
        self.capex = capex
        self.pad = pad
        self.deferred_gain = deferred_gain
        self.use_ads = use_ads
        self.bonus_override = bonus_override

        # Parse dates
        if isinstance(acquisition_date, str):
            acquisition_date = datetime.strptime(acquisition_date, '%m/%d/%Y').date()
        if isinstance(css_date, str):
            css_date = datetime.strptime(css_date, '%m/%d/%Y')

        # Ensure acquisition_date is a date object (not datetime) for bonus rate comparison
        if acquisition_date:
            # Check if it's a datetime object (has both date and time)
            # datetime is a subclass of date, so check for the 'hour' attribute
            if hasattr(acquisition_date, 'hour'):
                self.acquisition_date = acquisition_date.date()
            else:
                self.acquisition_date = acquisition_date
        else:
            self.acquisition_date = datetime.now().date()

        self.css_date = css_date or datetime.now()
        self.property_type = property_type
        self.year_built = year_built if year_built is not None else self.acquisition_date.year

        # Calculate total depreciable assets (base property only, CapEx tracked separately)
        self.total_depreciable = purchase_price - land_value - pad - deferred_gain
        if not capex_items:
            # Only add legacy capex if no capex_items provided
            self.total_depreciable += capex

        # Get bonus depreciation rate
        if use_ads:
            self.bonus_rate = 0  # ADS disallows bonus
        elif bonus_override is not None:
            self.bonus_rate = bonus_override
        else:
            self.bonus_rate = get_bonus_rate(self.acquisition_date)

        # Determine building asset class (ADS uses longer lives)
        if use_ads:
            self.building_class = '30yr' if property_type == 'multi-family' else '40yr'
        else:
            self.building_class = '27.5yr' if property_type == 'multi-family' else '39yr'

        # Create CapEx pools
        self.capex_pools = []
        if capex_items:
            for item in capex_items:
                pool = CapexPool(
                    amount=float(item.get('amount', 0)),
                    pis_date=item.get('placed_in_service_date') or item.get('pis_date'),
                    classification=item.get('classification'),
                    bonus_rate=bonus_override,
                    use_ads=use_ads
                )
                self.capex_pools.append(pool)
        
        # Get or calculate allocations
        if allocations:
            self.allocations = allocations
        else:
            # Use default allocations with age adjustment
            # Excel-matched allocation percentages
            # NOTE: 7yr property ONLY exists in commercial (39yr), NOT residential (27.5yr)
            if property_type == 'multi-family':
                # Residential: No 7yr property - it's all combined into 5yr
                # All percentages to 8 decimal places, sum = 1.00000000
                base_allocations = {
                    '5yr': 0.08926036,     # 8.92603600%
                    '7yr': 0.00000000,     # 0.00000000% - no 7yr in residential
                    '15yr': 0.27500630,    # 27.50063000%
                    '27.5yr': 0.63573334,  # 63.57333400% (adjusted for exact 100%)
                    '39yr': 0.00000000,
                }
            else:
                # Commercial: Has 7yr property (furniture, fixtures, equipment)
                # All percentages to 8 decimal places, sum = 1.00000000
                base_allocations = {
                    '5yr': 0.07000000,     # 7.00000000%
                    '7yr': 0.01926036,     # 1.92603600%
                    '15yr': 0.27500630,    # 27.50063000%
                    '27.5yr': 0.00000000,
                    '39yr': 0.63573334,    # 63.57333400% (adjusted for exact 100%)
                }
            # Apply age adjustments based on year_built
            # Older properties get more allocation to short-life assets (15yr)
            self.allocations = calculate_allocation_percentages(
                property_type,
                self.year_built,
                self.css_date.year,
                base_allocations
            )
        
        # Calculate allocated amounts
        # Remap building class keys for ADS (27.5yr→30yr, 39yr→40yr)
        allocated_amounts_temp = {}
        for asset_class, pct in self.allocations.items():
            amount = self.total_depreciable * (pct / 100 if pct > 1 else pct)

            # Remap building class if ADS is enabled
            if use_ads:
                if asset_class == '27.5yr' and self.building_class == '30yr':
                    asset_class = '30yr'
                elif asset_class == '39yr' and self.building_class == '40yr':
                    asset_class = '40yr'

            allocated_amounts_temp[asset_class] = amount

        self.allocated_amounts = allocated_amounts_temp

        # Store whether property is residential for helper methods
        self.is_residential = (property_type == 'multi-family')

    def _building_key(self) -> str:
        """
        Determine the proper building label for response dictionaries.
        """
        if self.use_ads:
            # ADS lives: residential 30, nonres 40
            return "30yr" if self.is_residential else "40yr"
        # GDS lives
        return "27.5yr" if self.is_residential else "39yr"

    def _allocate_basis(self) -> Tuple[Dict[str, Decimal], Dict[str, Decimal]]:
        """
        Return (percentages, amounts) for 5/7/15/building after applying:
          - Base MF/Nonres splits
          - Age/finish adjustments
          - Explicit 7->5 transfer used by the Excel workbook
        All math uses Decimal; amounts rounded to cents at the end.
        """
        basis = Decimal(str(self.total_depreciable))

        # Start from existing allocations (already age-adjusted)
        # Convert to Decimal percentages (0.0-1.0 range)
        adj = {}
        total_pct = Decimal("0")

        for asset_class, pct_value in self.allocations.items():
            # Handle both percentage (0-100) and decimal (0-1) formats
            if pct_value > 1:
                pct_decimal = Decimal(str(pct_value)) / Decimal("100")
            else:
                pct_decimal = Decimal(str(pct_value))

            # Map to standard keys (5yr, 7yr, 15yr, building)
            if asset_class in ['5yr']:
                adj['5yr'] = pct_decimal
            elif asset_class in ['7yr']:
                adj['7yr'] = pct_decimal
            elif asset_class in ['15yr']:
                adj['15yr'] = pct_decimal
            elif asset_class in ['27.5yr', '39yr', '30yr', '40yr']:
                adj['building'] = pct_decimal

            total_pct += pct_decimal

        # Ensure all keys exist
        for k in ['5yr', '7yr', '15yr', 'building']:
            if k not in adj:
                adj[k] = Decimal("0")

        # 7->5 transfer disabled - Excel percentages already account for final allocation
        # The base percentages (7%, 1.926036%, etc.) are the actual allocations to use
        # No additional transfers needed

        # Normalize to ensure sum == 1.00000000
        total_pct = adj['5yr'] + adj['7yr'] + adj['15yr'] + adj['building']
        if total_pct != Decimal("1"):
            adj['building'] += (Decimal("1") - total_pct)

        # Convert to dollar amounts and round at the end
        amounts: Dict[str, Decimal] = {}
        for k in ('5yr', '7yr', '15yr', 'building'):
            amounts[k] = (basis * adj[k]).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        # Final safety: enforce sum equals basis (adjust building by a cent if needed)
        diff = basis - sum(amounts.values())
        if diff != Decimal("0.00"):
            amounts['building'] = (amounts['building'] + diff).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

        return adj, amounts

    def calculate_year_1_depreciation(self):
        """
        Calculate Year 1 depreciation with bonus
        
        Returns:
            Dict with depreciation by asset class
        """
        results = {}
        month = self.acquisition_date.month
        
        for asset_class, amount in self.allocated_amounts.items():
            if amount == 0:
                results[asset_class] = 0
                continue
            
            if asset_class in ['5yr', '7yr', '15yr']:
                # Short-life assets with bonus
                if self.bonus_rate == 100:
                    # 100% bonus - all expensed in year 1
                    results[asset_class] = amount
                else:
                    # Partial bonus
                    bonus_portion = amount * (self.bonus_rate / 100)
                    regular_portion = amount * (1 - self.bonus_rate / 100)
                    macrs_pct = get_macrs_percentage(asset_class, 1) / 100
                    regular_depreciation = regular_portion * macrs_pct
                    results[asset_class] = bonus_portion + regular_depreciation
            else:
                # Long-life property (27.5yr or 39yr) - no bonus
                macrs_pct = get_macrs_percentage(asset_class, 1, month) / 100
                results[asset_class] = amount * macrs_pct
        
        return results
    
    def calculate_accumulated_depreciation(self, years):
        """
        Calculate accumulated depreciation through N years
        
        Args:
            years: Number of years to accumulate
        
        Returns:
            Dict with accumulated depreciation by asset class
        """
        results = {}
        month = self.acquisition_date.month
        
        for asset_class, amount in self.allocated_amounts.items():
            if amount == 0 or years == 0:
                results[asset_class] = 0
                continue
            
            if asset_class in ['5yr', '7yr', '15yr']:
                # Short-life assets with bonus
                if self.bonus_rate == 100:
                    # All expensed in year 1
                    results[asset_class] = amount
                else:
                    # Partial bonus in year 1 + MACRS on remainder
                    bonus_portion = amount * (self.bonus_rate / 100)
                    regular_portion = amount * (1 - self.bonus_rate / 100)
                    
                    # Get accumulated MACRS percentage
                    macrs_accumulated_pct = get_accumulated_depreciation(asset_class, years) / 100
                    regular_depreciation = regular_portion * macrs_accumulated_pct
                    
                    results[asset_class] = bonus_portion + regular_depreciation
            else:
                # Long-life property (27.5yr or 39yr)
                macrs_accumulated_pct = get_accumulated_depreciation(asset_class, years, month) / 100
                results[asset_class] = amount * macrs_accumulated_pct
        
        return results
    
    def calculate_standard_depreciation(self, years):
        """
        Calculate standard straight-line depreciation (what they "did take")
        
        Args:
            years: Number of years
        
        Returns:
            Total accumulated standard depreciation
        """
        month = self.acquisition_date.month
        
        # Standard depreciation uses straight-line on building class only
        building_amount = self.total_depreciable
        
        # Get accumulated percentage for building class
        macrs_accumulated_pct = get_accumulated_depreciation(self.building_class, years, month) / 100
        
        return building_amount * macrs_accumulated_pct
    
    def calculate_remaining_basis_by_class(self, year):
        """
        Calculate remaining depreciable basis for each asset class after a given year

        Args:
            year: Year number (1-based)

        Returns:
            Dict with remaining basis by asset class
        """
        remaining = {}
        accumulated = self.calculate_accumulated_depreciation(year)

        for asset_class, initial_amount in self.allocated_amounts.items():
            remaining[asset_class] = max(0, initial_amount - accumulated[asset_class])

        return remaining

    def calculate_life_remaining_by_class(self, year):
        """
        Calculate remaining depreciation life for each asset class after a given year

        Args:
            year: Year number (1-based)

        Returns:
            Dict with remaining life (years or "Complete") by asset class
        """
        life_remaining = {}

        for asset_class in self.allocated_amounts.keys():
            if asset_class == '5yr':
                total_life = 6  # 5-year property has 6 years with half-year convention
            elif asset_class == '7yr':
                total_life = 8
            elif asset_class == '15yr':
                total_life = 16
            elif asset_class == '27.5yr':
                total_life = 29
            elif asset_class == '39yr':
                total_life = 40
            else:
                total_life = 0

            # Calculate remaining
            remaining = total_life - year

            # For short-life with 100% bonus, they're done after year 1
            if asset_class in ['5yr', '7yr', '15yr'] and self.bonus_rate == 100 and year >= 1:
                life_remaining[asset_class] = "Complete"
            # For partial bonus, calculate based on MACRS schedule
            elif asset_class in ['5yr', '7yr', '15yr'] and self.bonus_rate < 100:
                # Remaining years for the non-bonused portion
                life_remaining[asset_class] = max(0, remaining)
            else:
                life_remaining[asset_class] = max(0, remaining)

        return life_remaining

    def _calculate_capex_pool_year_depreciation(self, pool, target_year):
        """
        Calculate depreciation for a single CapEx pool for a specific calendar year

        Args:
            pool: CapexPool instance
            target_year: Calendar year (e.g., 2021)

        Returns:
            Depreciation amount for that year
        """
        # Calculate depreciation year (1 = first year of depreciation)
        # If PIS is 2021 and target is 2021, this is year 1
        # If PIS is 2021 and target is 2022, this is year 2
        depreciation_year = target_year - pool.pis_date.year + 1

        if depreciation_year < 1:
            return 0  # Not yet placed in service

        asset_class = pool.asset_class
        amount = pool.amount
        month = pool.pis_date.month

        # Handle short-life assets (5yr, 7yr, 15yr)
        if asset_class in ['5yr', '7yr', '15yr']:
            if pool.bonus_rate == 100 and depreciation_year == 1:
                # 100% bonus in year 1
                return amount
            elif pool.bonus_rate > 0 and depreciation_year == 1:
                # Partial bonus in year 1
                bonus_portion = amount * (pool.bonus_rate / 100)
                regular_portion = amount * (1 - pool.bonus_rate / 100)
                macrs_pct = get_macrs_percentage(asset_class, 1) / 100
                return bonus_portion + (regular_portion * macrs_pct)
            elif pool.bonus_rate < 100 and depreciation_year > 1:
                # Subsequent years: MACRS on non-bonused portion
                regular_portion = amount * (1 - pool.bonus_rate / 100)
                macrs_pct = get_macrs_percentage(asset_class, depreciation_year) / 100
                return regular_portion * macrs_pct
            else:
                return 0
        else:
            # Long-life property (27.5yr, 39yr, 30yr ADS, 40yr ADS)
            macrs_pct = get_macrs_percentage(asset_class, depreciation_year, month) / 100
            return amount * macrs_pct

    def _calculate_capex_pool_accumulated(self, pool, target_year):
        """
        Calculate accumulated depreciation for a CapEx pool through a calendar year

        Args:
            pool: CapexPool instance
            target_year: Calendar year (e.g., 2021)

        Returns:
            Accumulated depreciation amount
        """
        # Calculate number of depreciation years completed
        depreciation_years_completed = target_year - pool.pis_date.year + 1

        if depreciation_years_completed < 1:
            return 0

        asset_class = pool.asset_class
        amount = pool.amount
        month = pool.pis_date.month

        if asset_class in ['5yr', '7yr', '15yr']:
            if pool.bonus_rate == 100:
                # All expensed in year 1
                return amount
            else:
                # Partial bonus + MACRS on remainder
                bonus_portion = amount * (pool.bonus_rate / 100)
                regular_portion = amount * (1 - pool.bonus_rate / 100)
                macrs_accumulated_pct = get_accumulated_depreciation(asset_class, depreciation_years_completed) / 100
                return bonus_portion + (regular_portion * macrs_accumulated_pct)
        else:
            # Long-life property
            macrs_accumulated_pct = get_accumulated_depreciation(asset_class, depreciation_years_completed, month) / 100
            return amount * macrs_accumulated_pct

    def _aggregate_capex_by_class(self, calc_func, *args):
        """
        Aggregate CapEx pool results by asset class

        Args:
            calc_func: Function to call for each pool (e.g., _calculate_capex_pool_year_depreciation)
            *args: Arguments to pass to calc_func

        Returns:
            Dict with totals by asset class
        """
        by_class = {'5yr': 0, '7yr': 0, '15yr': 0, '27.5yr': 0, '39yr': 0, '30yr': 0, '40yr': 0}

        for pool in self.capex_pools:
            depreciation = calc_func(pool, *args)
            asset_class = pool.asset_class
            by_class[asset_class] = by_class.get(asset_class, 0) + depreciation

        return by_class

    def calculate_481a_adjustment(self):
        """
        Calculate 481(a) adjustment for catching up depreciation (includes CapEx pools)

        Returns:
            Dict with detailed 481(a) calculation
        """
        # Calculate years elapsed for primary property
        years_elapsed = self.css_date.year - self.acquisition_date.year
        tax_year = self.css_date.year

        if years_elapsed == 0:
            # Same year acquisition and CSS - no catch-up needed
            current_year_depreciation = self.calculate_year_1_depreciation()

            # Add CapEx contributions for current year
            capex_current = self._aggregate_capex_by_class(self._calculate_capex_pool_year_depreciation, tax_year)
            for asset_class, amount in capex_current.items():
                current_year_depreciation[asset_class] = current_year_depreciation.get(asset_class, 0) + amount

            current_year_total = sum(current_year_depreciation.values())

            return {
                'years_elapsed': 0,
                'should_have_taken': 0,
                'did_take': 0,
                'catch_up_adjustment': 0,
                'current_year_depreciation': current_year_depreciation,
                'current_year_total': current_year_total,
                'total_current_year_benefit': current_year_total
            }

        # Calculate what they should have taken (with cost seg) - includes CapEx through prior year
        should_have_taken_detail = self.calculate_accumulated_depreciation(years_elapsed)

        # Add CapEx accumulated through prior year
        prior_year = tax_year - 1
        capex_accumulated = self._aggregate_capex_by_class(self._calculate_capex_pool_accumulated, prior_year)
        for asset_class, amount in capex_accumulated.items():
            should_have_taken_detail[asset_class] = should_have_taken_detail.get(asset_class, 0) + amount

        should_have_taken_total = sum(should_have_taken_detail.values())

        # Calculate what they did take (standard method)
        did_take_total = self.calculate_standard_depreciation(years_elapsed)

        # Calculate current year depreciation (includes CapEx for current year)
        current_year_detail = self.calculate_current_year_depreciation(years_elapsed + 1)

        # Add CapEx contributions for current year
        capex_current = self._aggregate_capex_by_class(self._calculate_capex_pool_year_depreciation, tax_year)
        for asset_class, amount in capex_current.items():
            current_year_detail[asset_class] = current_year_detail.get(asset_class, 0) + amount

        current_year_total = sum(current_year_detail.values())

        # 481(a) adjustment
        catch_up = should_have_taken_total - did_take_total

        return {
            'years_elapsed': years_elapsed,
            'should_have_taken': should_have_taken_total,
            'should_have_taken_detail': should_have_taken_detail,
            'did_take': did_take_total,
            'catch_up_adjustment': catch_up,
            'current_year_depreciation': current_year_detail,
            'current_year_total': current_year_total,
            'total_current_year_benefit': catch_up + current_year_total
        }
    
    def calculate_current_year_depreciation(self, year):
        """
        Calculate depreciation for a specific year (not accumulated)
        
        Args:
            year: Year number (1-based)
        
        Returns:
            Dict with depreciation by asset class for that year
        """
        results = {}
        month = self.acquisition_date.month
        
        for asset_class, amount in self.allocated_amounts.items():
            if amount == 0:
                results[asset_class] = 0
                continue
            
            if asset_class in ['5yr', '7yr', '15yr']:
                if self.bonus_rate == 100:
                    # All taken in year 1
                    results[asset_class] = amount if year == 1 else 0
                else:
                    if year == 1:
                        # Year 1 with partial bonus
                        bonus_portion = amount * (self.bonus_rate / 100)
                        regular_portion = amount * (1 - self.bonus_rate / 100)
                        macrs_pct = get_macrs_percentage(asset_class, 1) / 100
                        results[asset_class] = bonus_portion + (regular_portion * macrs_pct)
                    else:
                        # Subsequent years - only on non-bonused portion
                        regular_portion = amount * (1 - self.bonus_rate / 100)
                        macrs_pct = get_macrs_percentage(asset_class, year) / 100
                        results[asset_class] = regular_portion * macrs_pct
            else:
                # Long-life property
                macrs_pct = get_macrs_percentage(asset_class, year, month) / 100
                results[asset_class] = amount * macrs_pct
        
        return results
    
    def generate_depreciation_schedule(self, years=10):
        """
        Generate complete depreciation schedule
        
        Args:
            years: Number of years to project
        
        Returns:
            List of dicts with year-by-year depreciation
        """
        schedule = []
        
        for year in range(1, years + 1):
            year_depreciation = self.calculate_current_year_depreciation(year)
            accumulated = self.calculate_accumulated_depreciation(year)
            
            schedule.append({
                'year': year,
                'calendar_year': self.acquisition_date.year + year - 1,
                'depreciation': year_depreciation,
                'depreciation_total': sum(year_depreciation.values()),
                'accumulated': accumulated,
                'accumulated_total': sum(accumulated.values())
            })
        
        return schedule
    
    def lifetime_totals(self, from_css_year: bool = False) -> dict:
        """
        Return totals over the full remaining life (including current year)
        for each method: standard, traditional, bonus.

        Args:
            from_css_year: If True, calculate from CSS year forward (excluding prior years)
                          If False, calculate full lifetime from acquisition

        These totals must reconcile to:
          - same-year CSS: full basis (+ CapEx for traditional/bonus only)
          - later-year CSS: basis - SL_through_prior_year (+ CapEx for traditional/bonus only)

        Note: Standard method only depreciates the base property (total_depreciable).
              CapEx pools are tracked separately and only included in traditional/bonus methods.
        """
        # Base depreciable amount (primary property only)
        basis = Decimal(str(self.total_depreciable))

        # Calculate CapEx total (only for traditional/bonus methods)
        capex_total = Decimal("0")
        if self.capex_pools:
            for pool in self.capex_pools:
                capex_total += Decimal(str(pool.amount))

        # For later-year CSS, we need to subtract SL depreciation already taken
        if from_css_year:
            years_elapsed = self.css_date.year - self.acquisition_date.year
            if years_elapsed > 0:
                sl_prior = Decimal(str(self.calculate_standard_depreciation(years_elapsed)))
                # Standard method: only depreciates base property
                std_lifetime = basis - sl_prior
                # Traditional/Bonus: base property + CapEx (CapEx not depreciated under standard)
                trad_bonus_lifetime = basis - sl_prior + capex_total
            else:
                # Same year
                std_lifetime = basis
                trad_bonus_lifetime = basis + capex_total
        else:
            # Full lifetime from acquisition
            std_lifetime = basis
            trad_bonus_lifetime = basis + capex_total

        return {
            "standard": std_lifetime.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "traditional": trad_bonus_lifetime.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
            "bonus": trad_bonus_lifetime.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        }

    def schedule_span(self) -> str:
        """
        Identify the horizon used for the schedule rows returned to the API.
        Returns "10y" (default) or "full".
        """
        return "10y"  # Default to 10-year projection

    def generate_summary_report(self):
        """
        Generate comprehensive summary report

        Returns:
            Dict with all key metrics
        """
        adjustment_481a = self.calculate_481a_adjustment()

        return {
            'inputs': {
                'purchase_price': self.purchase_price,
                'land_value': self.land_value,
                'capex': self.capex,
                'pad': self.pad,
                'deferred_gain': self.deferred_gain,
                'total_depreciable': self.total_depreciable,
                'acquisition_date': self.acquisition_date.strftime('%m/%d/%Y'),
                'css_date': self.css_date.strftime('%m/%d/%Y'),
                'property_type': self.property_type,
                'year_built': self.year_built,
                'bonus_rate': self.bonus_rate
            },
            'allocations': {
                'percentages': self.allocations,
                'amounts': self.allocated_amounts
            },
            'depreciation_481a': adjustment_481a,
            'first_year_benefit': adjustment_481a['total_current_year_benefit']
        }
