import math

def calculate_quote_pricing(
    purchase_price: float,
    land_value: float,
    capex: float = 0,
    zip_code: str = "85260",
    property_type: str = "Multi-Family",
    sqft_building: float = 38000,
    acres_land: float = 2.0,
    floors: int = 2,
    num_properties: int = 1,
    year_built: int = 2005
):
    """
    Calculate Cost Segregation pricing based on RCG Valuation formulas
    """
    
    # Base Linear Calculation
    base_cost = (purchase_price + capex) * 0.0572355 * 0.25 * 0.08 + 4000
    
    # Cost Basis Factor (from Excel VLOOKUP Tables)
    total_cost = purchase_price + capex
    if total_cost >= 10000000:
        cost_basis_factor = 1.5
    elif total_cost >= 7500000:
        cost_basis_factor = 1.45
    elif total_cost >= 5000000:
        cost_basis_factor = 1.4
    elif total_cost >= 3000000:
        cost_basis_factor = 1.35
    elif total_cost >= 2000000:
        cost_basis_factor = 1.3
    elif total_cost >= 1500000:
        cost_basis_factor = 1.25
    elif total_cost >= 1250000:
        cost_basis_factor = 1.1
    elif total_cost >= 1000000:
        cost_basis_factor = 1.075
    elif total_cost >= 750000:
        cost_basis_factor = 1.05
    elif total_cost >= 500000:
        cost_basis_factor = 1.02
    elif total_cost >= 250000:
        cost_basis_factor = 1.01
    else:
        cost_basis_factor = 1.0
    
    # Zip Code Factor (from Excel VLOOKUP Tables)
    zip_int = int(zip_code) if isinstance(zip_code, str) else zip_code
    if zip_int >= 90000:
        zip_code_factor = 1.1
    elif zip_int >= 80000:
        zip_code_factor = 1.05
    elif zip_int >= 70000:
        zip_code_factor = 1.0
    elif zip_int >= 60000:
        zip_code_factor = 1.05
    elif zip_int >= 50000:
        zip_code_factor = 1.1
    elif zip_int >= 40000:
        zip_code_factor = 1.05
    elif zip_int >= 30000:
        zip_code_factor = 1.0
    elif zip_int >= 20000:
        zip_code_factor = 1.05
    elif zip_int >= 10000:
        zip_code_factor = 1.1
    else:
        zip_code_factor = 1.11
    
    # SqFt Building Factor (from Excel VLOOKUP Tables)
    if sqft_building == 0:
        sqft_factor = 1.0
    elif sqft_building >= 55000:
        sqft_factor = 1.22
    elif sqft_building >= 50000:
        sqft_factor = 1.2
    elif sqft_building >= 45000:
        sqft_factor = 1.18
    elif sqft_building >= 40000:
        sqft_factor = 1.16
    elif sqft_building >= 35000:
        sqft_factor = 1.14
    elif sqft_building >= 30000:
        sqft_factor = 1.12
    elif sqft_building >= 20000:
        sqft_factor = 1.1
    elif sqft_building >= 15000:
        sqft_factor = 1.08
    elif sqft_building >= 10000:
        sqft_factor = 1.06
    elif sqft_building >= 5000:
        sqft_factor = 1.04
    elif sqft_building >= 2500:
        sqft_factor = 1.02
    else:
        sqft_factor = 1.0
    
    # Acres Land Factor
    if acres_land == 0:
        acres_factor = 0.75
    elif acres_land <= 0.25:
        acres_factor = 0.8
    elif acres_land <= 0.5:
        acres_factor = 0.85
    elif acres_land <= 1:
        acres_factor = 0.9
    elif acres_land <= 2:
        acres_factor = 0.95
    elif acres_land <= 3:
        acres_factor = 1.0
    elif acres_land <= 4:
        acres_factor = 1.05
    elif acres_land <= 5:
        acres_factor = 1.1
    elif acres_land <= 6:
        acres_factor = 1.15
    elif acres_land <= 7:
        acres_factor = 1.2
    elif acres_land <= 8:
        acres_factor = 1.25
    elif acres_land >= 12:
        acres_factor = 12.0
    else:
        acres_factor = 1.0
    
    # Property Type Factor (from Excel VLOOKUP Tables)
    property_type_map = {
        "Industrial": 1.01,
        "Medical": 1.15,
        "Office": 1.05,
        "Other": 1.1,
        "Restaurant": 1.15,
        "Retail": 1.05,
        "Warehouse": 0.4,
        "Multi Family": 0.4,
        "Multi-Family": 0.4,
        "Residential/LTR": 1.05,
        "Short-Term Rental": 1.05
    }
    property_type_factor = property_type_map.get(property_type, 1.0)
    
    # Floors Factor (from Excel VLOOKUP Tables)
    if floors >= 11:
        floors_factor = 1.3
    elif floors >= 10:
        floors_factor = 1.2
    elif floors >= 7:
        floors_factor = 1.15
    elif floors >= 4:
        floors_factor = 1.1
    elif floors >= 3:
        floors_factor = 1.05
    else:
        floors_factor = 1.0  # 1 or 2 floors
    
    # Multiple Properties Factor
    # Single property should be 1.0 (no adjustment), not 0.7
    if num_properties >= 12:
        multi_prop_factor = 12.0
    elif num_properties >= 11:
        multi_prop_factor = 1.3
    elif num_properties >= 8:
        multi_prop_factor = 1.25
    elif num_properties >= 7:
        multi_prop_factor = 1.2
    elif num_properties >= 5:
        multi_prop_factor = 1.15
    elif num_properties >= 4:
        multi_prop_factor = 1.1
    elif num_properties >= 3:
        multi_prop_factor = 1.05
    elif num_properties >= 2:
        multi_prop_factor = 1.0
    else:
        multi_prop_factor = 1.0  # Single property - no adjustment
    
    # Calculate Linear Bid
    linear_bid = (base_cost * 
                  cost_basis_factor * 
                  zip_code_factor * 
                  sqft_factor * 
                  acres_factor * 
                  property_type_factor * 
                  floors_factor * 
                  multi_prop_factor)
    
    # Calculate Logistic Bid
    building_value = purchase_price - land_value + capex
    
    X0 = 3500
    L = 15000
    K = 0.01
    
    step1 = building_value - X0
    step2 = step1 * 0.001
    step3 = K * (-step2)
    step4 = math.e ** step3
    step5 = 1 + step4
    logistic_bid = L / step5
    
    # Calculate Multiple Properties Bid
    cost_per_property = linear_bid * num_properties
    multi_properties_bid = cost_per_property
    
    # Determine Final Bid - Use minimum of all three bids
    # This ensures logistic bid caps fees for very large properties
    final_bid = min(linear_bid, logistic_bid, multi_properties_bid)
    
    # Apply floor
    final_bid = max(final_bid, 100)
    final_bid = round(final_bid, 2)
    
    # Calculate Payment Options
    originally_quoted = final_bid
    pay_upfront = round(final_bid * 0.91, 2)
    pay_50_50 = round(final_bid / 2, 2)
    pay_over_time = round(final_bid / 4, 2)
    
    return {
        "originally_quoted": originally_quoted,
        "pay_upfront": pay_upfront,
        "pay_50_50": pay_50_50,
        "pay_over_time": pay_over_time,
        "final_bid": final_bid,
        "linear_bid": round(linear_bid, 2),
        "logistic_bid": round(logistic_bid, 2),
        "multi_properties_bid": round(multi_properties_bid, 2),
        "factors": {
            "cost_basis": cost_basis_factor,
            "zip_code": zip_code_factor,
            "sqft": sqft_factor,
            "acres": acres_factor,
            "property_type": property_type_factor,
            "floors": floors_factor,
            "multi_prop": multi_prop_factor
        }
    }


if __name__ == "__main__":
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
    
    print("Pricing Results:")
    print(f"Originally Quoted: ${result['originally_quoted']:,.2f}")
    print(f"Pay Upfront (9% off): ${result['pay_upfront']:,.2f}")
    print(f"50/50 Split: ${result['pay_50_50']:,.2f}")
    print(f"Pay Over Time (Affirm): ${result['pay_over_time']:,.2f}")
    print(f"\nBid Comparisons:")
    print(f"Linear Bid: ${result['linear_bid']:,.2f}")
    print(f"Logistic Bid: ${result['logistic_bid']:,.2f}")
    print(f"Multi Prop Bid: ${result['multi_properties_bid']:,.2f}")