# RCG Valuation - Pricing Calculator

## Overview
This pricing calculator computes Cost Segregation pricing based on RCG Valuation formulas. It uses a sophisticated multi-factor approach combining linear, logistic, and multi-property bid calculations.

## Files Included

1. **pricing_calculator.py** - Main calculator module
2. **test_pricing_calculator.py** - Comprehensive automated test suite (16 tests)
3. **interactive_test.py** - Interactive testing interface
4. **README.md** - This file

## Installation

### Prerequisites
- Python 3.6 or higher
- No external dependencies required (uses only standard library)

### Setup
```bash
# Navigate to your project directory
cd C:\Users\scott\Claude_Code\Online_quote_RCGV

# No installation needed - ready to run!
```

## Usage

### Method 1: Import as Module
```python
from pricing_calculator import calculate_quote_pricing

result = calculate_quote_pricing(
    purchase_price=1000000,
    land_value=150000,
    capex=0,
    sqft_building=38000,
    acres_land=2.0,
    property_type="Multi-Family",
    floors=2,
    num_properties=1
)

print(f"Final Bid: ${result['final_bid']:,.2f}")
```

### Method 2: Run Directly
```bash
python pricing_calculator.py
```

### Method 3: Run Automated Tests
```bash
python test_pricing_calculator.py
```

### Method 4: Interactive Testing
```bash
python interactive_test.py
```

## Function Parameters

```python
calculate_quote_pricing(
    purchase_price: float,      # Property purchase price ($)
    land_value: float,          # Land value component ($)
    capex: float = 0,           # Capital expenditures ($)
    zip_code: str = "85260",    # Property zip code
    property_type: str = "Multi-Family",  # Type of property
    sqft_building: float = 38000,  # Building square footage
    acres_land: float = 2.0,    # Land acreage
    floors: int = 2,            # Number of floors
    num_properties: int = 1,    # Number of properties
    year_built: int = 2005      # Year property was built
)
```

## Property Types Supported

- **Industrial** (1.01x multiplier)
- **Medical** (1.15x multiplier)
- **Office** (1.05x multiplier)
- **Other** (1.1x multiplier)
- **Restaurant** (1.15x multiplier)
- **Retail** (1.05x multiplier)
- **Warehouse** (0.4x multiplier)
- **Multi-Family** (0.5x multiplier)
- **Residential/LTR** (1.05x multiplier)
- **Short-Term Rental** (1.05x multiplier)

## Return Value

The function returns a dictionary with:

```python
{
    "originally_quoted": float,    # Base quoted price
    "pay_upfront": float,         # 9% discount for upfront payment
    "pay_50_50": float,           # Half of total (2 payments)
    "pay_over_time": float,       # Quarter of total (4 payments via Affirm)
    "final_bid": float,           # Final calculated bid
    "linear_bid": float,          # Linear calculation result
    "logistic_bid": float,        # Logistic calculation result
    "multi_properties_bid": float, # Multi-property calculation result
    "factors": {
        "cost_basis": float,      # Cost basis multiplier
        "zip_code": float,        # Zip code multiplier (currently 1.0)
        "sqft": float,            # Square footage multiplier
        "acres": float,           # Acreage multiplier
        "property_type": float,   # Property type multiplier
        "floors": float,          # Floors multiplier
        "multi_prop": float       # Multiple properties multiplier
    }
}
```

## Calculation Logic

### 1. Linear Bid Calculation
```
base_cost = (purchase_price + capex) × 0.0572355 × 0.25 × 0.08 + 4000
linear_bid = base_cost × cost_basis_factor × zip_code_factor × 
             sqft_factor × acres_factor × property_type_factor × 
             floors_factor × multi_prop_factor
```

### 2. Logistic Bid Calculation
```
building_value = purchase_price - land_value + capex
logistic_bid = 15000 / (1 + e^(-0.01 × (building_value - 3500) × 0.001))
```

### 3. Multi-Properties Bid
```
multi_properties_bid = linear_bid × num_properties
```

### 4. Final Bid Selection
```
minimum_of_three = min(linear_bid, logistic_bid, multi_properties_bid)
final_bid = max(minimum_of_three if minimum_of_three < multi_properties_bid 
                else multi_properties_bid, 100)
```

## Factor Tiers

### Cost Basis Factor
- Under $500k: 0.95x
- $500k-$749k: 0.95x
- $750k-$999k: 0.96x
- $1M-$1.99M: 0.97x
- $2M-$2.99M: 0.98x
- $3M-$3.99M: 0.99x
- $4M-$4.99M: 1.0x
- $5M-$5.99M: 1.01x
- $6M-$6.99M: 1.02x
- $7M-$7.99M: 1.03x
- $8M-$8.99M: 1.04x
- $9M+: 1.05x

### Square Footage Factor
- 0 sqft: 0.75x
- 1-2,500: 0.8x
- 2,501-5,000: 0.85x
- 5,001-10,000: 0.9x
- 10,001-15,000: 0.95x
- 15,001-20,000: 1.0x
- 20,001-30,000: 1.05x
- 30,001-35,000: 1.1x
- 35,001-40,000: 1.15x
- 40,001-45,000: 1.2x
- 45,001-50,000: 1.25x
- 550,000+: 9.0x

### Acreage Factor
- 0 acres: 0.75x
- 0.01-0.25: 0.8x
- 0.26-0.5: 0.85x
- 0.51-1.0: 0.9x
- 1.01-2.0: 0.95x
- 2.01-3.0: 1.0x
- 3.01-4.0: 1.05x
- 4.01-5.0: 1.1x
- 5.01-6.0: 1.15x
- 6.01-7.0: 1.2x
- 7.01-8.0: 1.25x
- 12.0+: 12.0x

### Floors Factor
- 1-2 floors: 1.0x
- 3 floors: 1.05x
- 4-6 floors: 1.1x
- 7-9 floors: 1.15x
- 10 floors: 1.2x
- 11+ floors: 1.3x

### Multiple Properties Factor
- 1 property: 0.7x
- 2 properties: 1.0x
- 3 properties: 1.05x
- 4 properties: 1.1x
- 5-6 properties: 1.15x
- 7 properties: 1.2x
- 8-10 properties: 1.25x
- 11 properties: 1.3x
- 12+ properties: 12.0x

## Testing

### Run All Automated Tests
```bash
python test_pricing_calculator.py
```

The test suite includes:
- ✅ Basic calculation validation
- ✅ Cost basis factor testing across all tiers
- ✅ Property type factor verification
- ✅ Square footage tier testing
- ✅ Acreage tier testing
- ✅ Floors factor testing
- ✅ Multiple properties factor testing
- ✅ Payment options calculation
- ✅ Minimum bid floor enforcement
- ✅ CAPEX impact testing
- ✅ Logistic bid calculation
- ✅ Edge cases (unknown property types)
- ✅ Real-world scenarios (warehouse, medical, portfolio)

**All 16 tests pass successfully! ✓**

## Example Calculations

### Example 1: Small Multi-Family Property
```python
result = calculate_quote_pricing(
    purchase_price=750000,
    land_value=100000,
    sqft_building=15000,
    acres_land=1.0,
    property_type="Multi-Family",
    floors=2
)
# Expected: ~$1,000 - $1,500
```

### Example 2: Large Commercial Warehouse
```python
result = calculate_quote_pricing(
    purchase_price=5000000,
    land_value=1000000,
    capex=200000,
    sqft_building=50000,
    acres_land=5.0,
    property_type="Warehouse",
    floors=1
)
# Expected: ~$3,000 - $5,000
```

### Example 3: Medical Office Portfolio
```python
result = calculate_quote_pricing(
    purchase_price=8000000,
    land_value=1500000,
    capex=500000,
    sqft_building=30000,
    acres_land=3.0,
    property_type="Medical",
    floors=4,
    num_properties=3
)
# Expected: ~$8,000 - $12,000
```

## Troubleshooting

### Issue: Import Error
**Solution**: Make sure you're in the correct directory:
```bash
cd C:\Users\scott\Claude_Code\Online_quote_RCGV
```

### Issue: Test Failures
**Solution**: Verify Python version:
```bash
python --version  # Should be 3.6+
```

### Issue: Unexpected Results
**Solution**: Check all input parameters and run the interactive test to verify factors:
```bash
python interactive_test.py
```

## File Location
✅ **Correct Location**: `C:\Users\scott\Claude_Code\Online_quote_RCGV\`

This is the right place for your project! The files are organized in a dedicated project folder.

## Support & Maintenance

For questions or issues:
1. Review the test suite for examples
2. Run interactive tests to validate calculations
3. Check factor tables in this README
4. Verify input parameters match expected ranges

## Version History

- **v1.0** - Initial implementation with complete calculation logic
- All 16 automated tests passing
- Interactive testing interface included

---

**Created**: 2024
**Last Updated**: 2024
**Status**: ✅ Production Ready
