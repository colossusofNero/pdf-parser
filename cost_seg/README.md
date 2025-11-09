# Cost Segregation Calculator Module

Depreciation calculations for the RCGV Quote Assistant system.

## Quick Start
```python
from cost_seg import CostSegregationCalculator

calc = CostSegregationCalculator(
    purchase_price=5_000_000,
    land_value=1_000_000,
    acquisition_date='06/15/2025',
    css_date='12/31/2025',
    property_type='multi-family'
)

summary = calc.generate_summary_report()
print(f"First Year Benefit: ${summary['first_year_benefit']:,.2f}")
```

## Documentation

See `QUICK_START.md` for quick examples.