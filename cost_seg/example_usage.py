"""
Example Usage of Cost Segregation Calculator
"""

from cost_seg_calculator import CostSegregationCalculator
import json

def format_currency(value):
    """Format value as currency"""
    return f"${value:,.2f}"

def print_section(title):
    """Print section header"""
    print(f"\n{'=' * 80}")
    print(f"{title:^80}")
    print('=' * 80)

# Example 1: Simple property - acquisition and CSS in same year
print_section("EXAMPLE 1: Multi-Family Property - Same Year Acquisition")

calc1 = CostSegregationCalculator(
    purchase_price=5_000_000,
    land_value=1_000_000,
    capex=0,
    pad=0,
    deferred_gain=0,
    acquisition_date='06/15/2025',
    css_date='12/31/2025',
    property_type='multi-family',
    year_built=2005
)

summary1 = calc1.generate_summary_report()

print(f"\nInputs:")
print(f"  Purchase Price: {format_currency(calc1.purchase_price)}")
print(f"  Land Value: {format_currency(calc1.land_value)}")
print(f"  Total Depreciable: {format_currency(calc1.total_depreciable)}")
print(f"  Acquisition Date: {calc1.acquisition_date.strftime('%m/%d/%Y')}")
print(f"  Bonus Rate: {calc1.bonus_rate}%")

print(f"\nAllocations:")
for asset_class, amount in calc1.allocated_amounts.items():
    if amount > 0:
        pct = calc1.allocations[asset_class]
        pct_display = pct * 100 if pct < 1 else pct
        print(f"  {asset_class:8s}: {format_currency(amount):>15s} ({pct_display:6.2f}%)")

print(f"\nYear 1 Depreciation:")
year1_dep = calc1.calculate_year_1_depreciation()
for asset_class, amount in year1_dep.items():
    if amount > 0:
        print(f"  {asset_class:8s}: {format_currency(amount):>15s}")
print(f"  {'Total:':8s} {format_currency(sum(year1_dep.values())):>15s}")

# Example 2: Property with 481(a) adjustment - acquired in prior year
print_section("EXAMPLE 2: Commercial Property - 481(a) Adjustment (60% Bonus)")

calc2 = CostSegregationCalculator(
    purchase_price=10_000_000,
    land_value=2_500_000,
    capex=500_000,
    pad=0,
    deferred_gain=0,
    acquisition_date='06/15/2024',
    css_date='12/31/2025',
    property_type='commercial',
    year_built=2010
)

summary2 = calc2.generate_summary_report()

print(f"\nInputs:")
print(f"  Purchase Price: {format_currency(calc2.purchase_price)}")
print(f"  Land Value: {format_currency(calc2.land_value)}")
print(f"  CapEx: {format_currency(calc2.capex)}")
print(f"  Total Depreciable: {format_currency(calc2.total_depreciable)}")
print(f"  Acquisition Date: {calc2.acquisition_date.strftime('%m/%d/%Y')}")
print(f"  CSS Date: {calc2.css_date.strftime('%m/%d/%Y')}")
print(f"  Years Elapsed: {summary2['depreciation_481a']['years_elapsed']}")
print(f"  Bonus Rate: {calc2.bonus_rate}%")

print(f"\n481(a) Adjustment Calculation:")
adjustment = summary2['depreciation_481a']
print(f"  Should Have Taken (Cost Seg): {format_currency(adjustment['should_have_taken']):>20s}")
print(f"  Did Take (Standard):          {format_currency(adjustment['did_take']):>20s}")
print(f"  Catch-Up Adjustment:          {format_currency(adjustment['catch_up_adjustment']):>20s}")
print(f"  Current Year Depreciation:    {format_currency(adjustment['current_year_total']):>20s}")
print(f"  {'─' * 60}")
print(f"  Total First Year Benefit:     {format_currency(adjustment['total_current_year_benefit']):>20s}")

# Example 3: 1031 Exchange property
print_section("EXAMPLE 3: Multi-Family - 1031 Exchange with PAD and Deferred Gain")

calc3 = CostSegregationCalculator(
    purchase_price=8_000_000,
    land_value=1_500_000,
    capex=200_000,
    pad=500_000,
    deferred_gain=300_000,
    acquisition_date='03/01/2023',
    css_date='12/31/2025',
    property_type='multi-family',
    year_built=2015
)

summary3 = calc3.generate_summary_report()

print(f"\nInputs:")
print(f"  Purchase Price: {format_currency(calc3.purchase_price)}")
print(f"  Land Value: {format_currency(calc3.land_value)}")
print(f"  CapEx: {format_currency(calc3.capex)}")
print(f"  PAD (Prior Accumulated Depreciation): {format_currency(calc3.pad)}")
print(f"  Deferred Gain: {format_currency(calc3.deferred_gain)}")
print(f"  {'─' * 60}")
print(f"  Total Depreciable Assets: {format_currency(calc3.total_depreciable)}")
print(f"  Acquisition Date: {calc3.acquisition_date.strftime('%m/%d/%Y')}")
print(f"  CSS Date: {calc3.css_date.strftime('%m/%d/%Y')}")
print(f"  Years Elapsed: {summary3['depreciation_481a']['years_elapsed']}")
print(f"  Bonus Rate: {calc3.bonus_rate}%")

print(f"\n481(a) Adjustment Calculation:")
adjustment3 = summary3['depreciation_481a']
print(f"  Should Have Taken (Cost Seg): {format_currency(adjustment3['should_have_taken']):>20s}")
print(f"  Did Take (Standard):          {format_currency(adjustment3['did_take']):>20s}")
print(f"  Catch-Up Adjustment:          {format_currency(adjustment3['catch_up_adjustment']):>20s}")
print(f"  Current Year Depreciation:    {format_currency(adjustment3['current_year_total']):>20s}")
print(f"  {'─' * 60}")
print(f"  Total First Year Benefit:     {format_currency(adjustment3['total_current_year_benefit']):>20s}")

# Example 4: Depreciation Schedule
print_section("EXAMPLE 4: 10-Year Depreciation Schedule")

schedule = calc2.generate_depreciation_schedule(years=10)

print(f"\n{'Year':>6} {'Calendar':>8} {'Annual Dep':>15} {'Accumulated':>15}")
print('─' * 50)
for year_data in schedule:
    print(f"{year_data['year']:>6} {year_data['calendar_year']:>8} "
          f"{format_currency(year_data['depreciation_total']):>15} "
          f"{format_currency(year_data['accumulated_total']):>15}")

print("\n\nCalculator ready for use!")
print("Import CostSegregationCalculator from cost_seg_calculator.py to use in your own scripts.")
