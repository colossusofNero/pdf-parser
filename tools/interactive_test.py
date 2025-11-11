"""
Interactive Pricing Calculator Tester
Run with: python interactive_test.py
"""

from pricing_calculator import calculate_quote_pricing


def format_currency(amount):
    """Format number as currency"""
    return f"${amount:,.2f}"


def print_results(result):
    """Pretty print the pricing results"""
    print("\n" + "="*60)
    print("PRICING RESULTS")
    print("="*60)
    
    print(f"\n💰 QUOTED PRICE: {format_currency(result['originally_quoted'])}")
    print(f"\n📊 PAYMENT OPTIONS:")
    print(f"   • Pay Upfront (9% discount): {format_currency(result['pay_upfront'])}")
    print(f"   • 50/50 Split:               {format_currency(result['pay_50_50'])} x 2")
    print(f"   • Pay Over Time (Affirm):    {format_currency(result['pay_over_time'])} x 4")
    
    print(f"\n🔍 BID ANALYSIS:")
    print(f"   • Linear Bid:           {format_currency(result['linear_bid'])}")
    print(f"   • Logistic Bid:         {format_currency(result['logistic_bid'])}")
    print(f"   • Multi Properties Bid: {format_currency(result['multi_properties_bid'])}")
    print(f"   • Final Bid:            {format_currency(result['final_bid'])}")
    
    print(f"\n⚙️  FACTORS APPLIED:")
    print(f"   • Cost Basis:     {result['factors']['cost_basis']}")
    print(f"   • Zip Code:       {result['factors']['zip_code']}")
    print(f"   • Square Feet:    {result['factors']['sqft']}")
    print(f"   • Acreage:        {result['factors']['acres']}")
    print(f"   • Property Type:  {result['factors']['property_type']}")
    print(f"   • Floors:         {result['factors']['floors']}")
    print(f"   • Multi Property: {result['factors']['multi_prop']}")
    print("="*60 + "\n")


def run_preset_tests():
    """Run several preset test scenarios"""
    
    print("\n🧪 RUNNING PRESET TEST SCENARIOS\n")
    
    scenarios = [
        {
            "name": "Small Multi-Family",
            "params": {
                "purchase_price": 750000,
                "land_value": 100000,
                "sqft_building": 15000,
                "acres_land": 1.0,
                "property_type": "Multi-Family",
                "floors": 2,
                "num_properties": 1
            }
        },
        {
            "name": "Large Warehouse",
            "params": {
                "purchase_price": 5000000,
                "land_value": 1000000,
                "capex": 200000,
                "sqft_building": 50000,
                "acres_land": 5.0,
                "property_type": "Warehouse",
                "floors": 1,
                "num_properties": 1
            }
        },
        {
            "name": "Medical Office Portfolio",
            "params": {
                "purchase_price": 8000000,
                "land_value": 1500000,
                "capex": 500000,
                "sqft_building": 30000,
                "acres_land": 3.0,
                "property_type": "Medical",
                "floors": 4,
                "num_properties": 3
            }
        },
        {
            "name": "Retail Shopping Center",
            "params": {
                "purchase_price": 3500000,
                "land_value": 800000,
                "sqft_building": 25000,
                "acres_land": 4.0,
                "property_type": "Retail",
                "floors": 1,
                "num_properties": 1
            }
        }
    ]
    
    for i, scenario in enumerate(scenarios, 1):
        print(f"\n{'─'*60}")
        print(f"Scenario {i}: {scenario['name']}")
        print(f"{'─'*60}")
        
        result = calculate_quote_pricing(**scenario['params'])
        print_results(result)
        
        if i < len(scenarios):
            input("Press Enter to see next scenario...")


def run_custom_test():
    """Run a custom test with user input"""
    print("\n📝 CUSTOM PRICING CALCULATOR\n")
    
    try:
        purchase_price = float(input("Purchase Price ($): "))
        land_value = float(input("Land Value ($): "))
        capex = float(input("Capital Expenditures ($) [0]: ") or 0)
        sqft_building = float(input("Building Square Feet: "))
        acres_land = float(input("Land Acreage: "))
        
        print("\nProperty Types:")
        print("  1. Multi-Family")
        print("  2. Warehouse")
        print("  3. Medical")
        print("  4. Office")
        print("  5. Retail")
        print("  6. Industrial")
        print("  7. Restaurant")
        print("  8. Other")
        
        prop_types = {
            "1": "Multi-Family",
            "2": "Warehouse",
            "3": "Medical",
            "4": "Office",
            "5": "Retail",
            "6": "Industrial",
            "7": "Restaurant",
            "8": "Other"
        }
        
        prop_choice = input("Property Type [1]: ") or "1"
        property_type = prop_types.get(prop_choice, "Multi-Family")
        
        floors = int(input("Number of Floors [1]: ") or 1)
        num_properties = int(input("Number of Properties [1]: ") or 1)
        
        result = calculate_quote_pricing(
            purchase_price=purchase_price,
            land_value=land_value,
            capex=capex,
            sqft_building=sqft_building,
            acres_land=acres_land,
            property_type=property_type,
            floors=floors,
            num_properties=num_properties
        )
        
        print_results(result)
        
    except ValueError as e:
        print(f"\n❌ Error: Invalid input. Please enter numeric values.")
    except Exception as e:
        print(f"\n❌ Error: {e}")


def main():
    """Main menu"""
    while True:
        print("\n" + "="*60)
        print("RCG VALUATION - PRICING CALCULATOR TESTER")
        print("="*60)
        print("\nOptions:")
        print("  1. Run Preset Test Scenarios")
        print("  2. Custom Calculation")
        print("  3. Exit")
        print()
        
        choice = input("Select option [1-3]: ")
        
        if choice == "1":
            run_preset_tests()
        elif choice == "2":
            run_custom_test()
        elif choice == "3":
            print("\n👋 Goodbye!\n")
            break
        else:
            print("\n❌ Invalid choice. Please select 1-3.")


if __name__ == "__main__":
    main()
