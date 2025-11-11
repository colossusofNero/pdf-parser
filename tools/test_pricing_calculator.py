"""
Test suite for pricing_calculator.py
Run with: python test_pricing_calculator.py
"""

import unittest
from pricing_calculator import calculate_quote_pricing


class TestPricingCalculator(unittest.TestCase):
    
    def test_basic_calculation(self):
        """Test with default parameters"""
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
        
        self.assertIsInstance(result, dict)
        self.assertIn('final_bid', result)
        self.assertIn('originally_quoted', result)
        self.assertIn('pay_upfront', result)
        self.assertGreater(result['final_bid'], 0)
    
    def test_cost_basis_factors(self):
        """Test different cost basis tiers"""
        # Test $500k property
        result_500k = calculate_quote_pricing(
            purchase_price=500000,
            land_value=100000,
            sqft_building=20000,
            acres_land=2.0,
            property_type="Multi-Family"
        )
        
        # Test $5M property
        result_5m = calculate_quote_pricing(
            purchase_price=5000000,
            land_value=500000,
            sqft_building=20000,
            acres_land=2.0,
            property_type="Multi-Family"
        )
        
        # Test $10M property
        result_10m = calculate_quote_pricing(
            purchase_price=10000000,
            land_value=1000000,
            sqft_building=20000,
            acres_land=2.0,
            property_type="Multi-Family"
        )
        
        # Check factors are different
        self.assertEqual(result_500k['factors']['cost_basis'], 0.95)
        self.assertEqual(result_5m['factors']['cost_basis'], 1.01)
        self.assertEqual(result_10m['factors']['cost_basis'], 1.05)
    
    def test_property_types(self):
        """Test all property type factors"""
        property_types = {
            "Industrial": 1.01,
            "Medical": 1.15,
            "Office": 1.05,
            "Warehouse": 0.4,
            "Multi-Family": 0.5,
            "Restaurant": 1.15
        }
        
        base_params = {
            'purchase_price': 1000000,
            'land_value': 150000,
            'sqft_building': 20000,
            'acres_land': 2.0,
            'floors': 2,
            'num_properties': 1
        }
        
        for prop_type, expected_factor in property_types.items():
            result = calculate_quote_pricing(
                **base_params,
                property_type=prop_type
            )
            self.assertEqual(
                result['factors']['property_type'], 
                expected_factor,
                f"Property type {prop_type} should have factor {expected_factor}"
            )
    
    def test_sqft_tiers(self):
        """Test square footage factors"""
        test_cases = [
            (0, 0.75),
            (2500, 0.8),
            (5000, 0.85),
            (20000, 1.0),
            (38000, 1.15),
            (550000, 9.0)
        ]
        
        for sqft, expected_factor in test_cases:
            result = calculate_quote_pricing(
                purchase_price=1000000,
                land_value=150000,
                sqft_building=sqft,
                acres_land=2.0,
                property_type="Multi-Family"
            )
            self.assertEqual(
                result['factors']['sqft'],
                expected_factor,
                f"SqFt {sqft} should have factor {expected_factor}"
            )
    
    def test_acres_tiers(self):
        """Test acreage factors"""
        test_cases = [
            (0, 0.75),
            (0.25, 0.8),
            (1.0, 0.9),
            (3.0, 1.0),
            (5.0, 1.1),
            (12.0, 12.0)
        ]
        
        for acres, expected_factor in test_cases:
            result = calculate_quote_pricing(
                purchase_price=1000000,
                land_value=150000,
                sqft_building=20000,
                acres_land=acres,
                property_type="Multi-Family"
            )
            self.assertEqual(
                result['factors']['acres'],
                expected_factor,
                f"Acres {acres} should have factor {expected_factor}"
            )
    
    def test_floors_factor(self):
        """Test floors multiplier"""
        test_cases = [
            (1, 1.0),
            (2, 1.0),
            (3, 1.05),
            (5, 1.1),
            (11, 1.3)
        ]
        
        for floors, expected_factor in test_cases:
            result = calculate_quote_pricing(
                purchase_price=1000000,
                land_value=150000,
                sqft_building=20000,
                acres_land=2.0,
                property_type="Multi-Family",
                floors=floors
            )
            self.assertEqual(
                result['factors']['floors'],
                expected_factor,
                f"Floors {floors} should have factor {expected_factor}"
            )
    
    def test_multiple_properties(self):
        """Test multiple properties factor"""
        test_cases = [
            (1, 0.7),
            (2, 1.0),
            (3, 1.05),
            (5, 1.15),
            (12, 12.0)
        ]
        
        for num_props, expected_factor in test_cases:
            result = calculate_quote_pricing(
                purchase_price=1000000,
                land_value=150000,
                sqft_building=20000,
                acres_land=2.0,
                property_type="Multi-Family",
                num_properties=num_props
            )
            self.assertEqual(
                result['factors']['multi_prop'],
                expected_factor,
                f"Num properties {num_props} should have factor {expected_factor}"
            )
    
    def test_payment_options(self):
        """Test payment calculation logic"""
        result = calculate_quote_pricing(
            purchase_price=1000000,
            land_value=150000,
            sqft_building=20000,
            acres_land=2.0,
            property_type="Multi-Family"
        )
        
        # Pay upfront should be 91% of original
        self.assertAlmostEqual(
            result['pay_upfront'],
            result['originally_quoted'] * 0.91,
            places=2
        )
        
        # 50/50 should be half
        self.assertAlmostEqual(
            result['pay_50_50'],
            result['originally_quoted'] / 2,
            places=2
        )
        
        # Pay over time should be 1/4
        self.assertAlmostEqual(
            result['pay_over_time'],
            result['originally_quoted'] / 4,
            places=2
        )
    
    def test_minimum_bid_floor(self):
        """Test that bid never goes below $100"""
        result = calculate_quote_pricing(
            purchase_price=100000,
            land_value=50000,
            sqft_building=500,
            acres_land=0.1,
            property_type="Warehouse",
            num_properties=1
        )
        
        self.assertGreaterEqual(result['final_bid'], 100)
    
    def test_with_capex(self):
        """Test with capital expenditures"""
        result_no_capex = calculate_quote_pricing(
            purchase_price=1000000,
            land_value=150000,
            capex=0,
            sqft_building=20000,
            acres_land=2.0,
            property_type="Multi-Family"
        )
        
        result_with_capex = calculate_quote_pricing(
            purchase_price=1000000,
            land_value=150000,
            capex=200000,
            sqft_building=20000,
            acres_land=2.0,
            property_type="Multi-Family"
        )
        
        # With capex should have higher bid due to higher cost basis
        self.assertGreater(
            result_with_capex['final_bid'],
            result_no_capex['final_bid']
        )
    
    def test_logistic_bid_calculation(self):
        """Test logistic bid formula"""
        # Small building value should give lower logistic bid
        result_small = calculate_quote_pricing(
            purchase_price=200000,
            land_value=50000,
            sqft_building=5000,
            acres_land=1.0,
            property_type="Office"
        )
        
        # Large building value should give higher logistic bid
        result_large = calculate_quote_pricing(
            purchase_price=5000000,
            land_value=500000,
            sqft_building=5000,
            acres_land=1.0,
            property_type="Office"
        )
        
        self.assertLess(
            result_small['logistic_bid'],
            result_large['logistic_bid']
        )
    
    def test_edge_case_unknown_property_type(self):
        """Test with unknown property type defaults to 1.0"""
        result = calculate_quote_pricing(
            purchase_price=1000000,
            land_value=150000,
            sqft_building=20000,
            acres_land=2.0,
            property_type="Unknown Type"
        )
        
        self.assertEqual(result['factors']['property_type'], 1.0)
    
    def test_all_outputs_present(self):
        """Verify all expected keys are in output"""
        result = calculate_quote_pricing(
            purchase_price=1000000,
            land_value=150000,
            sqft_building=20000,
            acres_land=2.0,
            property_type="Multi-Family"
        )
        
        expected_keys = [
            'originally_quoted',
            'pay_upfront',
            'pay_50_50',
            'pay_over_time',
            'final_bid',
            'linear_bid',
            'logistic_bid',
            'multi_properties_bid',
            'factors'
        ]
        
        for key in expected_keys:
            self.assertIn(key, result)
        
        # Check factors dict
        factor_keys = ['cost_basis', 'zip_code', 'sqft', 'acres', 
                      'property_type', 'floors', 'multi_prop']
        for key in factor_keys:
            self.assertIn(key, result['factors'])


class TestRealWorldScenarios(unittest.TestCase):
    """Test realistic scenarios"""
    
    def test_small_warehouse(self):
        """Small warehouse property"""
        result = calculate_quote_pricing(
            purchase_price=750000,
            land_value=200000,
            capex=50000,
            sqft_building=15000,
            acres_land=1.5,
            property_type="Warehouse",
            floors=1,
            num_properties=1
        )
        
        self.assertGreater(result['final_bid'], 0)
        self.assertEqual(result['factors']['property_type'], 0.4)
    
    def test_medical_office_building(self):
        """Medical office building"""
        result = calculate_quote_pricing(
            purchase_price=3500000,
            land_value=500000,
            capex=100000,
            sqft_building=25000,
            acres_land=2.5,
            property_type="Medical",
            floors=3,
            num_properties=1
        )
        
        self.assertGreater(result['final_bid'], 0)
        self.assertEqual(result['factors']['property_type'], 1.15)
        self.assertEqual(result['factors']['floors'], 1.05)
    
    def test_multifamily_portfolio(self):
        """Portfolio of 5 multi-family properties"""
        result = calculate_quote_pricing(
            purchase_price=8000000,
            land_value=1000000,
            capex=500000,
            sqft_building=100000,
            acres_land=10.0,
            property_type="Multi-Family",
            floors=4,
            num_properties=5
        )
        
        self.assertGreater(result['final_bid'], 0)
        self.assertEqual(result['factors']['multi_prop'], 1.15)


if __name__ == '__main__':
    # Run tests with verbose output
    unittest.main(verbosity=2)
