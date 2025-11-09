# Quick Start Guide

## Get Started in 60 Seconds

### 1. Run the Examples
```bash
python example_usage.py
```

This will show you 4 complete scenarios demonstrating all features.

### 2. Create Your First Calculation

```python
from cost_seg_calculator import CostSegregationCalculator

# Simple example
calc = CostSegregationCalculator(
    purchase_price=5_000_000,      # Total purchase price
    land_value=1_000_000,          # Non-depreciable land
    acquisition_date='06/15/2025',  # When property was acquired
    css_date='12/31/2025',         # When doing cost seg study
    property_type='multi-family'    # or 'commercial'
)

# Get results
summary = calc.generate_summary_report()
benefit = summary['first_year_benefit']
print(f"First Year Tax Benefit: ${benefit:,.2f}")
```

### 3. Most Common Scenarios

#### Same Year Acquisition (Simple)
```python
calc = CostSegregationCalculator(
    purchase_price=5_000_000,
    land_value=1_000_000,
    acquisition_date='06/15/2025',
    css_date='12/31/2025',
    property_type='multi-family',
    year_built=2005  # Optional, defaults to acquisition year
)
```

#### Prior Year Acquisition (481a Adjustment)
```python
calc = CostSegregationCalculator(
    purchase_price=10_000_000,
    land_value=2_500_000,
    capex=500_000,              # Any capital improvements
    acquisition_date='06/15/2024',  # Last year
    css_date='12/31/2025',          # This year
    property_type='commercial'
)

# Get the 481a details
adjustment = calc.calculate_481a_adjustment()
print(f"Catch-Up: ${adjustment['catch_up_adjustment']:,.2f}")
print(f"Total Benefit: ${adjustment['total_current_year_benefit']:,.2f}")
```

#### 1031 Exchange
```python
calc = CostSegregationCalculator(
    purchase_price=8_000_000,
    land_value=1_500_000,
    capex=200_000,
    pad=500_000,           # Prior accumulated depreciation
    deferred_gain=300_000, # Deferred gain from exchange
    acquisition_date='03/01/2023',
    css_date='12/31/2025',
    property_type='multi-family'
)
```

### 4. Get Different Reports

#### Summary Report
```python
summary = calc.generate_summary_report()
# Returns everything: inputs, allocations, 481a, first year benefit
```

#### Depreciation Schedule
```python
schedule = calc.generate_depreciation_schedule(years=10)
# Returns year-by-year depreciation for 10 years
for year in schedule:
    print(f"Year {year['year']}: ${year['depreciation_total']:,.2f}")
```

#### Year 1 Only
```python
year1 = calc.calculate_year_1_depreciation()
# Returns dict with depreciation by asset class
total = sum(year1.values())
```

### 5. Understanding Results

**Key Metrics:**
- `first_year_benefit`: Total depreciation deduction in first year
- `catch_up_adjustment`: 481(a) adjustment for prior years
- `current_year_total`: Depreciation for current tax year
- `total_current_year_benefit`: Sum of catch-up + current year

**Asset Classes in Results:**
- `5yr`: Carpets, appliances, decorative items
- `7yr`: Furniture, fixtures, equipment  
- `15yr`: Land improvements, site utilities
- `27.5yr`: Multi-family building structure
- `39yr`: Commercial building structure

### 6. Property Types

**Multi-Family:**
- Uses 27.5-year recovery period for building
- Base allocation: 64% to building
- Examples: Apartments, condos, residential rentals

**Commercial:**
- Uses 39-year recovery period for building
- Base allocation: 61% to building
- Examples: Office buildings, retail, industrial

### 7. Bonus Depreciation (Automatic)

The calculator automatically determines bonus rate based on acquisition date:

| Date Range | Bonus |
|-----------|-------|
| 1/20/2025+ | 100% |
| 1/1/2025 - 1/19/2025 | 40% |
| 2024 | 60% |
| 2023 | 80% |

**100% Bonus:** All short-life assets (5yr, 7yr, 15yr) are fully expensed in Year 1

**Partial Bonus:** Some is expensed, remainder follows MACRS schedule

### 8. Common Questions

**Q: What if I don't know the year built?**
A: It defaults to acquisition year. Age affects allocation slightly.

**Q: What if there's no CapEx, PAD, or Deferred Gain?**
A: Just leave them as 0 (or omit them).

**Q: Can I override the default allocations?**
A: Yes! Pass `allocations` dict with custom percentages:
```python
calc = CostSegregationCalculator(
    purchase_price=5_000_000,
    land_value=1_000_000,
    acquisition_date='06/15/2025',
    css_date='12/31/2025',
    allocations={
        '5yr': 0.10,    # 10%
        '7yr': 0.08,    # 8%
        '15yr': 0.25,   # 25%
        '27.5yr': 0.57  # 57%
    }
)
```

**Q: How do I export results?**
A: Use the summary dict:
```python
import json
summary = calc.generate_summary_report()
with open('results.json', 'w') as f:
    json.dump(summary, f, indent=2, default=str)
```

### 9. Files Included

- `macrs_tables.py` - IRS depreciation tables
- `cost_seg_calculator.py` - Main calculator
- `example_usage.py` - Usage examples
- `README.md` - Full documentation
- `QUICK_START.md` - This file

### 10. Need Help?

1. Run `python example_usage.py` to see working examples
2. Read `README.md` for detailed documentation
3. Check `IMPLEMENTATION_SUMMARY.md` for technical details

## That's It!

You're ready to calculate cost segregation depreciation. Start with the examples and customize from there!
