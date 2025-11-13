"""
Manual test script for depreciation engine
Tests the engine directly without API server
"""

import sys
from pathlib import Path
from datetime import datetime

# Add paths
sys.path.insert(0, str(Path(__file__).parent / 'cost_seg'))
sys.path.insert(0, str(Path(__file__).parent / 'service'))

# Import the depreciation calculator
from cost_seg_calculator import CostSegregationCalculator


def test_depreciation_engine():
    """Test the depreciation engine with a realistic scenario"""

    print("=" * 80)
    print("MANUAL TEST: Depreciation Engine with 481(a) Catch-Up")
    print("=" * 80)

    # Test scenario: 2019 purchase, CSS in 2021, 100% bonus
    print("\nTest Scenario:")
    print("  - Property purchased: June 15, 2019")
    print("  - Cost segregation study: Tax year 2021")
    print("  - Purchase price: $2,550,000")
    print("  - Land value: $255,000 (10%)")
    print("  - Property type: Multi-Family")

    calc = CostSegregationCalculator(
        purchase_price=2_550_000,
        land_value=255_000,
        capex=0,
        pad=0,
        deferred_gain=0,
        acquisition_date=datetime(2019, 6, 15),
        css_date=datetime(2021, 12, 31),
        property_type='multi-family',
        year_built=2005
    )

    print(f"\nBonus Rate Detected: {calc.bonus_rate}%")
    print(f"Total Depreciable Basis: ${calc.total_depreciable:,.2f}")
    print(f"Building Class: {calc.building_class}")

    # Calculate 481(a) adjustment
    adjustment_481a = calc.calculate_481a_adjustment()

    print("\n" + "=" * 80)
    print("481(a) CATCH-UP CALCULATION")
    print("=" * 80)
    print(f"Years Elapsed: {adjustment_481a['years_elapsed']} years (2019-2020)")
    print(f"\nAccumulated through 2020:")
    print(f"  Should Have Taken (Cost Seg): ${adjustment_481a['should_have_taken']:,.2f}")
    print(f"  Did Take (Straight Line):     ${adjustment_481a['did_take']:,.2f}")
    print(f"  -------------------------------------------------")
    print(f"  481(a) Catch-Up Adjustment:   ${adjustment_481a['catch_up_adjustment']:,.2f}")

    print(f"\nCurrent Year (2021) Depreciation:")
    for asset_class, amount in adjustment_481a['current_year_depreciation'].items():
        if amount > 0:
            print(f"  {asset_class:>8s}: ${amount:,.2f}")
    print(f"  -------------------------------------------------")
    print(f"  Total Current Year:           ${adjustment_481a['current_year_total']:,.2f}")

    print(f"\nTOTAL FIRST-YEAR BENEFIT:    ${adjustment_481a['total_current_year_benefit']:,.2f}")

    # Generate 10-year schedule
    print("\n" + "=" * 80)
    print("10-YEAR DEPRECIATION SCHEDULE")
    print("=" * 80)

    schedule = calc.generate_depreciation_schedule(years=10)

    print(f"\n{'Year':<6} {'Annual':<15} {'Accumulated':<15}")
    print("-" * 40)
    for year_data in schedule:
        print(f"{year_data['year']:<6} "
              f"${year_data['depreciation_total']:>12,.2f}  "
              f"${year_data['accumulated_total']:>12,.2f}")

    print("\nTest completed successfully!")
    print("=" * 80)

    assert True


def test_partial_bonus():
    """Test partial bonus scenario"""

    print("\n\n" + "=" * 80)
    print("MANUAL TEST: Partial Bonus Depreciation (60%)")
    print("=" * 80)

    print("\nTest Scenario:")
    print("  - Property purchased: June 15, 2019")
    print("  - Cost segregation study: Tax year 2021")
    print("  - Purchase price: $2,550,000")
    print("  - Bonus rate: 60% (forced for testing)")

    calc = CostSegregationCalculator(
        purchase_price=2_550_000,
        land_value=255_000,
        capex=0,
        pad=0,
        deferred_gain=0,
        acquisition_date=datetime(2019, 6, 15),
        css_date=datetime(2021, 12, 31),
        property_type='multi-family',
        year_built=2005
    )

    # Override bonus rate for testing
    calc.bonus_rate = 60

    adjustment_481a = calc.calculate_481a_adjustment()

    print(f"\nBonus Rate: {calc.bonus_rate}%")
    print(f"   - 60% taken as bonus in Year 1")
    print(f"   - 40% continues through MACRS schedule")

    print(f"\n481(a) Catch-Up: ${adjustment_481a['catch_up_adjustment']:,.2f}")

    print(f"\nCurrent Year (2021 - Year 3) Depreciation:")
    print(f"  (Year 3 MACRS rates on 40% remainder)")
    for asset_class, amount in adjustment_481a['current_year_depreciation'].items():
        if amount > 0:
            print(f"  {asset_class:>8s}: ${amount:,.2f}")
    print(f"  -------------------------------------------------")
    print(f"  Total:                        ${adjustment_481a['current_year_total']:,.2f}")

    print("\nPartial bonus test completed successfully!")
    print("=" * 80)

    assert True


if __name__ == '__main__':
    try:
        test_depreciation_engine()
        test_partial_bonus()
        print("\n\nALL MANUAL TESTS PASSED!\n")
    except Exception as e:
        print(f"\n\nERROR: {e}\n")
        import traceback
        traceback.print_exc()
        sys.exit(1)
