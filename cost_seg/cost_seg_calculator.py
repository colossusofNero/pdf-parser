"""
Cost Segregation Depreciation Calculator
Handles MACRS depreciation with bonus depreciation and 481(a) adjustments
"""

from datetime import datetime
from macrs_tables import get_macrs_percentage, get_accumulated_depreciation
import math

# Bonus Depreciation Schedule
BONUS_SCHEDULE = [
    {'start': datetime(2025, 1, 20), 'end': None, 'rate': 100},
    {'start': datetime(2025, 1, 1), 'end': datetime(2025, 1, 19), 'rate': 40},
    {'start': datetime(2024, 1, 1), 'end': datetime(2024, 12, 31), 'rate': 60},
    {'start': datetime(2023, 1, 1), 'end': datetime(2023, 12, 31), 'rate': 80},
    {'start': datetime(2017, 9, 27), 'end': datetime(2022, 12, 31), 'rate': 100},
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
                 allocations=None):
        """
        Initialize Cost Segregation Calculator
        
        Args:
            purchase_price: Total purchase price
            land_value: Land value (non-depreciable)
            capex: Capital expenditures
            pad: Prior Accumulated Depreciation (1031 exchange)
            deferred_gain: Deferred gain (1031 exchange)
            acquisition_date: Date property was acquired
            css_date: Date of cost segregation study / tax filing year
            property_type: 'multi-family' or 'commercial'
            year_built: Year property was built
            allocations: Dict with allocation percentages for each asset class
        """
        self.purchase_price = purchase_price
        self.land_value = land_value
        self.capex = capex
        self.pad = pad
        self.deferred_gain = deferred_gain
        
        # Parse dates
        if isinstance(acquisition_date, str):
            acquisition_date = datetime.strptime(acquisition_date, '%m/%d/%Y')
        if isinstance(css_date, str):
            css_date = datetime.strptime(css_date, '%m/%d/%Y')
        
        self.acquisition_date = acquisition_date or datetime.now()
        self.css_date = css_date or datetime.now()
        self.property_type = property_type
        self.year_built = year_built or self.acquisition_date.year
        
        # Calculate total depreciable assets
        self.total_depreciable = purchase_price - land_value + capex - pad - deferred_gain
        
        # Get bonus depreciation rate
        self.bonus_rate = get_bonus_rate(self.acquisition_date)
        
        # Determine building asset class
        self.building_class = '27.5yr' if property_type == 'multi-family' else '39yr'
        
        # Get or calculate allocations
        if allocations:
            self.allocations = allocations
        else:
            # Use default allocations with age adjustment
            base_allocations = {
                '5yr': 0.07,
                '7yr': 0.05,
                '15yr': 0.24,
                '27.5yr': 0.64 if property_type == 'multi-family' else 0.00,
                '39yr': 0.00 if property_type == 'multi-family' else 0.61,
            }
            self.allocations = calculate_allocation_percentages(
                property_type, 
                self.year_built, 
                self.acquisition_date.year,
                base_allocations
            )
        
        # Calculate allocated amounts
        self.allocated_amounts = {
            asset_class: self.total_depreciable * (pct / 100 if pct > 1 else pct)
            for asset_class, pct in self.allocations.items()
        }
    
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
    
    def calculate_481a_adjustment(self):
        """
        Calculate 481(a) adjustment for catching up depreciation
        
        Returns:
            Dict with detailed 481(a) calculation
        """
        # Calculate years elapsed
        years_elapsed = self.css_date.year - self.acquisition_date.year
        
        if years_elapsed == 0:
            # Same year acquisition and CSS - no catch-up needed
            current_year_depreciation = self.calculate_year_1_depreciation()
            return {
                'years_elapsed': 0,
                'should_have_taken': 0,
                'did_take': 0,
                'catch_up_adjustment': 0,
                'current_year_depreciation': current_year_depreciation,
                'total_current_year_benefit': sum(current_year_depreciation.values())
            }
        
        # Calculate what they should have taken (with cost seg)
        should_have_taken_detail = self.calculate_accumulated_depreciation(years_elapsed)
        should_have_taken_total = sum(should_have_taken_detail.values())
        
        # Calculate what they did take (standard method)
        did_take_total = self.calculate_standard_depreciation(years_elapsed)
        
        # Calculate current year depreciation
        current_year_detail = self.calculate_current_year_depreciation(years_elapsed + 1)
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
