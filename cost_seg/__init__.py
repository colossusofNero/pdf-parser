"""
Cost Segregation Calculator Module

A comprehensive Python module for calculating MACRS depreciation
with bonus depreciation and 481(a) adjustments.
"""

from .cost_seg_calculator import CostSegregationCalculator
from .macrs_tables import get_macrs_percentage, get_accumulated_depreciation

__version__ = "1.0.0"
__author__ = "RCGV Quote Assistant"

__all__ = [
    'CostSegregationCalculator',
    'get_macrs_percentage',
    'get_accumulated_depreciation'
]