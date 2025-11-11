"""
Simple Examples - RCG Valuation Pricing Calculator
Quick copy-paste examples for common scenarios
"""

from pricing_calculator import calculate_quote_pricing


print("="*70)
print("RCG VALUATION - PRICING CALCULATOR EXAMPLES")
print("="*70)


# Example 1: Basic Multi-Family Property
print("\n" + "-"*70)
print("Example 1: Basic Multi-Family Property ($1M)")
print("-"*70)
result1 = calculate_quote_pricing(
    purchase_price=1000000,
    land_value=150000,
    sqft_building=38000,
    acres_land=2.0,
    property_type="Multi-Family",
    floors=2
)
print(f"Final Price: ${result1['final_bid']:,.2f}")
print(f"Pay Upfront (9% off): ${result1['pay_upfront']:,.2f}")
print(f"50/50 Payment: ${result1['pay_50_50']:,.2f}")


# Example 2: Small Warehouse
print("\n" + "-"*70)
print("Example 2: Small Warehouse ($750k)")
print("-"*70)
result2 = calculate_quote_pricing(
    purchase_price=750000,
    land_value=200000,
    capex=50000,
    sqft_building=15000,
    acres_land=1.5,
    property_type="Warehouse",
    floors=1
)
print(f"Final Price: ${result2['final_bid']:,.2f}")
print(f"Pay Upfront (9% off): ${result2['pay_upfront']:,.2f}")


# Example 3: Medical Office Building
print("\n" + "-"*70)
print("Example 3: Medical Office Building ($3.5M)")
print("-"*70)
result3 = calculate_quote_pricing(
    purchase_price=3500000,
    land_value=500000,
    capex=100000,
    sqft_building=25000,
    acres_land=2.5,
    property_type="Medical",
    floors=3
)
print(f"Final Price: ${result3['final_bid']:,.2f}")
print(f"Pay Upfront (9% off): ${result3['pay_upfront']:,.2f}")
print(f"Factors Applied:")
print(f"  - Cost Basis: {result3['factors']['cost_basis']}")
print(f"  - Property Type: {result3['factors']['property_type']}")
print(f"  - Floors: {result3['factors']['floors']}")


# Example 4: Large Retail Center
print("\n" + "-"*70)
print("Example 4: Large Retail Shopping Center ($8M)")
print("-"*70)
result4 = calculate_quote_pricing(
    purchase_price=8000000,
    land_value=1500000,
    sqft_building=45000,
    acres_land=6.0,
    property_type="Retail",
    floors=2
)
print(f"Final Price: ${result4['final_bid']:,.2f}")
print(f"Pay Upfront (9% off): ${result4['pay_upfront']:,.2f}")
print(f"Pay Over Time (Affirm): ${result4['pay_over_time']:,.2f}")


# Example 5: Multi-Family Portfolio (5 properties)
print("\n" + "-"*70)
print("Example 5: Multi-Family Portfolio (5 properties, $10M total)")
print("-"*70)
result5 = calculate_quote_pricing(
    purchase_price=10000000,
    land_value=1500000,
    capex=500000,
    sqft_building=100000,
    acres_land=8.0,
    property_type="Multi-Family",
    floors=4,
    num_properties=5
)
print(f"Final Price: ${result5['final_bid']:,.2f}")
print(f"Pay Upfront (9% off): ${result5['pay_upfront']:,.2f}")
print(f"50/50 Payment: ${result5['pay_50_50']:,.2f}")
print(f"Pay Over Time: ${result5['pay_over_time']:,.2f}")
print(f"\nBid Details:")
print(f"  - Linear Bid: ${result5['linear_bid']:,.2f}")
print(f"  - Logistic Bid: ${result5['logistic_bid']:,.2f}")
print(f"  - Multi Prop Bid: ${result5['multi_properties_bid']:,.2f}")


# Example 6: Small Restaurant Property
print("\n" + "-"*70)
print("Example 6: Small Restaurant Property ($500k)")
print("-"*70)
result6 = calculate_quote_pricing(
    purchase_price=500000,
    land_value=100000,
    sqft_building=3000,
    acres_land=0.5,
    property_type="Restaurant",
    floors=1
)
print(f"Final Price: ${result6['final_bid']:,.2f}")
print(f"Pay Upfront (9% off): ${result6['pay_upfront']:,.2f}")


print("\n" + "="*70)
print("All examples completed successfully!")
print("="*70)
print("\nNOTE: You can copy any of these examples and modify the parameters")
print("to calculate quotes for your specific properties.")
print("="*70 + "\n")
