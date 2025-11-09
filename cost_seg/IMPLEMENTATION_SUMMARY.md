# Cost Segregation Calculator - Implementation Summary

## What Was Built

A complete Python-based cost segregation depreciation calculator that implements all the requirements discussed:

### Core Features Implemented ✓

1. **MACRS Depreciation Tables**
   - 5-year, 7-year, 15-year property (Half-Year Convention)
   - 27.5-year, 39-year property (Mid-Month Convention)
   - Complete IRS standard tables

2. **Bonus Depreciation**
   - Automatic determination based on acquisition date
   - 100% bonus (1/20/2025+)
   - 40% bonus (1/1/2025 - 1/19/2025)
   - 60% bonus (2024)
   - 80% bonus (2023)
   - Handles partial bonus scenarios correctly

3. **Age-Based Allocation Adjustments**
   - Logistic curve calculation: L / (1 + e^(-K*(age-X0)))
   - Parameters: L=0.5, K=0.01, X0=0
   - 22% multiplier for adjustment
   - Reduces building allocation as property ages
   - Increases 15-year allocation to compensate

4. **Total Depreciable Assets Calculation**
   ```
   Total = Purchase Price - Land + CapEx - PAD - Deferred Gain
   ```

5. **481(a) Catch-Up Adjustments**
   - Calculates what should have been taken (with cost seg)
   - Calculates what was actually taken (standard depreciation)
   - Computes catch-up adjustment + current year
   - Handles multi-year scenarios

6. **Convention Handling**
   - Half-Year Convention for assets < 20 years
   - Mid-Month Convention for assets ≥ 20 years
   - Proper month-based calculations for MM

7. **1031 Exchange Support**
   - Prior Accumulated Depreciation (PAD)
   - Deferred Gain handling
   - Proper basis calculations

## File Structure

### 1. `macrs_tables.py`
Contains all IRS MACRS depreciation percentage tables:
- Functions to retrieve depreciation percentages by year
- Functions to calculate accumulated depreciation
- Support for both HY and MM conventions

### 2. `cost_seg_calculator.py`
Main calculator class with all business logic:
- `CostSegregationCalculator` class
- Allocation calculations with age adjustments
- Bonus depreciation logic (100% and partial scenarios)
- 481(a) adjustment calculations
- Depreciation schedule generation
- Comprehensive reporting

### 3. `example_usage.py`
Demonstration of all features:
- Example 1: Same-year acquisition (100% bonus)
- Example 2: Prior year acquisition with 481(a) (60% bonus)
- Example 3: 1031 Exchange with PAD and Deferred Gain
- Example 4: 10-year depreciation schedule

### 4. `README.md`
Complete documentation:
- API reference
- Usage examples
- Explanation of all calculations
- MACRS table details

## Key Calculation Logic

### Year 1 Depreciation

**For 100% Bonus:**
```
- All 5yr, 7yr, 15yr assets: 100% expensed
- 27.5yr/39yr building: MM convention Year 1 rate
```

**For Partial Bonus (e.g., 60%):**
```
- 5yr, 7yr, 15yr assets:
  * 60% taken as bonus
  * 40% follows MACRS HY Year 1 rate
- 27.5yr/39yr building: MM convention Year 1 rate
```

### Accumulated Depreciation

**Year 1 = Accumulated for Year 1**

**Years 2+:**
```
Accumulated = Sum of depreciation from Year 1 through Year N
```

For short-life assets with partial bonus:
```
Accumulated = Bonus Amount + (Remaining × MACRS Accumulated %)
```

### Standard Depreciation ("Did Take")

Uses straight-line depreciation on total depreciable assets:
- 27.5-year for multi-family
- 39-year for commercial
- Mid-Month convention based on acquisition month

### 481(a) Formula

```
481(a) = (Cost Seg Accumulated through Prior Year) 
       - (Standard Accumulated through Prior Year)
       + (Current Year Depreciation)
```

## Usage Examples

### Basic Quote Calculation

```python
from cost_seg_calculator import CostSegregationCalculator

calc = CostSegregationCalculator(
    purchase_price=5_000_000,
    land_value=1_000_000,
    acquisition_date='06/15/2025',
    css_date='12/31/2025',
    property_type='multi-family',
    year_built=2005
)

summary = calc.generate_summary_report()
print(f"First Year Tax Benefit: ${summary['first_year_benefit']:,.2f}")
```

### With 481(a) Adjustment

```python
calc = CostSegregationCalculator(
    purchase_price=10_000_000,
    land_value=2_500_000,
    acquisition_date='06/15/2023',  # Prior year
    css_date='12/31/2025',          # Current year
    property_type='commercial'
)

adjustment = calc.calculate_481a_adjustment()
print(f"Catch-Up: ${adjustment['catch_up_adjustment']:,.2f}")
print(f"Current Year: ${adjustment['current_year_total']:,.2f}")
print(f"Total Benefit: ${adjustment['total_current_year_benefit']:,.2f}")
```

### 1031 Exchange

```python
calc = CostSegregationCalculator(
    purchase_price=8_000_000,
    land_value=1_500_000,
    capex=200_000,
    pad=500_000,           # From relinquished property
    deferred_gain=300_000, # From exchange
    acquisition_date='03/01/2023',
    css_date='12/31/2025',
    property_type='multi-family'
)
```

## Testing

Run the examples:
```bash
python example_usage.py
```

Expected output includes:
- 4 complete scenarios
- Proper bonus depreciation rates
- Accurate 481(a) calculations
- 10-year depreciation schedule

## Validation Points

✓ **Bonus Rates**: Correct rates based on acquisition date
✓ **Conventions**: HY for <20yr, MM for ≥20yr assets
✓ **Age Adjustments**: Logistic curve reduces building, increases 15yr
✓ **481(a) Logic**: Catch-up + current year = total benefit
✓ **1031 Basis**: Purchase - Land + CapEx - PAD - Deferred = Depreciable
✓ **100% Bonus**: All short-life assets expensed in Year 1
✓ **Partial Bonus**: Correct split between bonus and MACRS
✓ **Accumulation**: Year 1 is the accumulated; Years 2+ sum properly

## Next Steps for Production Use

1. **Custom Allocations**: Allow users to override age-adjusted allocations
2. **State Rules**: Add state-specific depreciation rules if needed
3. **Reporting**: Create formatted PDF reports
4. **Database Integration**: Save calculations for historical tracking
5. **UI Development**: Build web interface for easier input
6. **API Endpoints**: Create REST API for integration
7. **CPA Integration**: Import actual depreciation history from tax software

## Technical Notes

- **No External Dependencies**: Pure Python (stdlib only)
- **Modular Design**: Easy to extend or modify
- **Type Hints**: Could be added for better IDE support
- **Error Handling**: Basic validation; could be enhanced
- **Performance**: Fast for typical use cases
- **Precision**: Uses Python's float (sufficient for tax calculations)

## Limitations

- Assumes 100% business use
- Does not handle:
  - Partial dispositions
  - Mid-year sales
  - Section 179 expensing (separate from bonus)
  - Special depreciation rules for specific industries
  - State depreciation differences
- Standard depreciation assumes straight-line only (for quotes)

## Sample Output

```
Purchase Price: $10,000,000.00
Land Value: $2,500,000.00
CapEx: $500,000.00
Total Depreciable: $8,000,000.00

Allocations:
  5yr:     $560,000.00 (7.00%)
  7yr:     $400,000.00 (5.00%)
  15yr:   $2,027,200.00 (25.34%)
  39yr:   $5,012,800.00 (62.66%)

481(a) Adjustment:
  Should Have Taken: $2,075,988.01
  Did Take: $111,280.00
  Catch-Up: $1,964,708.01
  Current Year: $312,496.47
  ─────────────────────────
  Total First Year Benefit: $2,277,204.48
```

## Conclusion

The calculator is fully functional and implements all requested features:
- ✓ MACRS tables with both conventions
- ✓ Bonus depreciation (all scenarios)
- ✓ Age-based allocation adjustments
- ✓ 481(a) catch-up calculations
- ✓ 1031 exchange support
- ✓ Multi-year depreciation schedules
- ✓ Comprehensive reporting

Ready for use in cost segregation quotes and studies!
