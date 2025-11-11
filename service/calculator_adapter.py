"""
Integration adapter for new pricing_calculator.py
This allows the new calculator to work with the existing API structure
"""

import sys
import os

# Add tools directory to path so we can import pricing_calculator
tools_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'tools')
sys.path.insert(0, tools_path)

from pricing_calculator import calculate_quote_pricing


def adapt_inputs_for_new_calculator(inp):
    """
    Convert API inputs (QuoteInputs) to new calculator format
    """
    # Calculate land value in dollars if it's a percentage
    if inp.known_land_value:
        land_value_dollars = inp.land_value
    else:
        # land_value is a percentage (0-1 or 0-100)
        pct = inp.land_value / 100.0 if inp.land_value > 1.0 else inp.land_value
        land_value_dollars = inp.purchase_price * pct
    
    # Build parameters for new calculator
    params = {
        'purchase_price': inp.purchase_price,
        'land_value': land_value_dollars,
        'capex': inp.capex_amount or 0,
        'zip_code': str(inp.zip_code),
        'property_type': inp.property_type or "Multi-Family",
        'sqft_building': inp.sqft_building or 38000,
        'acres_land': inp.acres_land or 2.0,
        'floors': inp.floors or 2,
        'num_properties': getattr(inp, 'multi_properties', None) or getattr(inp, 'multiple_properties', None) or 1,
        'year_built': 2005  # Not in current inputs, using default
    }
    
    return params


def compute_with_new_calculator(inp):
    """
    Use new pricing_calculator.py to compute quote
    Returns result in the same format as the old calculator
    """
    # Get parameters for new calculator
    params = adapt_inputs_for_new_calculator(inp)
    
    # Call new calculator
    result = calculate_quote_pricing(**params)
    
    # Adapt result to match old calculator's format
    base_quote = result['final_bid']
    
    # Apply adjustments from API inputs (rush, premium, referral, override)
    adjustments = 0.0
    
    # Rush fee
    rush_fees = {
        "No Rush": 0.0,
        "4W $500": 500.0,
        "2W $1000": 1000.0
    }
    rush_fee = rush_fees.get(inp.rush, 0.0)
    adjustments += rush_fee
    
    # Premium uplift (5%)
    premium_pct = 0.05 if inp.premium == "Yes" else 0.0
    adjustments += base_quote * premium_pct
    
    # Referral uplift (configurable, default 0%)
    referral_pct = 0.00 if inp.referral == "No" else 0.10  # 10% if Yes
    adjustments += base_quote * referral_pct
    
    # Final quote with adjustments
    if inp.price_override and inp.price_override > 0:
        final_quote = float(inp.price_override)
    else:
        final_quote = base_quote + adjustments
    
    # Build breakdown dict (parts) to match old API format
    parts = {
        'base_rate': 2235.0,  # Not calculated by new calc, using default
        'cost_basis': inp.purchase_price + (inp.capex_amount or 0),
        'cb_factor': result['factors']['cost_basis'],
        'zip_factor': result['factors']['zip_code'],
        'rush_fee': rush_fee,
        'premium_uplift_pct': premium_pct,
        'referral_pct': referral_pct,
        'override': float(inp.price_override or 0.0),
        # Additional factors from new calculator
        'sqft_factor': result['factors']['sqft'],
        'acres_factor': result['factors']['acres'],
        'property_type_factor': result['factors']['property_type'],
        'floors_factor': result['factors']['floors'],
        'multi_prop_factor': result['factors']['multi_prop'],
        'linear_bid': result['linear_bid'],
        'logistic_bid': result['logistic_bid'],
        'multi_properties_bid': result['multi_properties_bid'],
    }
    
    return round(base_quote, 2), round(final_quote, 2), parts


if __name__ == "__main__":
    # Test the adapter
    print("Testing calculator adapter...")
    print()
    
    # Create a mock input object
    class MockQuoteInput:
        def __init__(self):
            self.purchase_price = 1000000
            self.zip_code = 85260
            self.land_value = 0.10  # 10%
            self.known_land_value = False
            self.rush = "No Rush"
            self.premium = "No"
            self.referral = "No"
            self.price_override = None
            self.sqft_building = 38000
            self.acres_land = 2.0
            self.property_type = "Multi-Family"
            self.floors = 2
            self.multi_properties = 1
            self.multiple_properties = 1
            self.capex_amount = 0
    
    test_input = MockQuoteInput()
    
    try:
        base, final, parts = compute_with_new_calculator(test_input)
        
        print("✅ Adapter Test Successful!")
        print()
        print(f"Base Quote:  ${base:,.2f}")
        print(f"Final Quote: ${final:,.2f}")
        print()
        print("Breakdown:")
        for key, value in parts.items():
            if isinstance(value, float):
                if 'pct' in key or 'factor' in key:
                    print(f"  {key}: {value:.3f}")
                else:
                    print(f"  {key}: ${value:,.2f}")
            else:
                print(f"  {key}: {value}")
        print()
        print("✅ Ready to integrate with API!")
        
    except Exception as e:
        print(f"❌ Error testing adapter: {e}")
        import traceback
        traceback.print_exc()