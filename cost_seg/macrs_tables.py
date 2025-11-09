"""
MACRS Depreciation Tables
Standard IRS depreciation percentages for various asset classes
"""

# 5-Year Property - Half-Year Convention (HY)
# GDS 200% Declining Balance
MACRS_5YR_HY = {
    1: 20.00,
    2: 32.00,
    3: 19.20,
    4: 11.52,
    5: 11.52,
    6: 5.76
}

# 7-Year Property - Half-Year Convention (HY)
# GDS 200% Declining Balance
MACRS_7YR_HY = {
    1: 14.29,
    2: 24.49,
    3: 17.49,
    4: 12.49,
    5: 8.93,
    6: 8.92,
    7: 8.93,
    8: 4.46
}

# 15-Year Property - Half-Year Convention (HY)
# GDS 150% Declining Balance
MACRS_15YR_HY = {
    1: 5.00,
    2: 9.50,
    3: 8.55,
    4: 7.70,
    5: 6.93,
    6: 6.23,
    7: 5.90,
    8: 5.90,
    9: 5.91,
    10: 5.90,
    11: 5.91,
    12: 5.90,
    13: 5.91,
    14: 5.90,
    15: 5.91,
    16: 2.95
}

# 27.5-Year Residential Rental Property - Mid-Month Convention (MM)
# GDS Straight-Line
# Percentages vary by month placed in service
MACRS_27_5YR_MM = {
    # Year: {Month: Percentage}
    1: {
        1: 3.485, 2: 3.182, 3: 2.879, 4: 2.576, 5: 2.273, 6: 1.970,
        7: 1.667, 8: 1.364, 9: 1.061, 10: 0.758, 11: 0.455, 12: 0.152
    },
    # Years 2-27: 3.636% regardless of month
    **{year: {month: 3.636 for month in range(1, 13)} for year in range(2, 28)},
    # Year 28: varies by month (reciprocal of year 1)
    28: {
        1: 3.637, 2: 3.636, 3: 3.636, 4: 3.636, 5: 3.636, 6: 3.636,
        7: 3.636, 8: 3.636, 9: 3.636, 10: 3.636, 11: 3.636, 12: 3.636
    },
    29: {
        1: 0.000, 2: 0.303, 3: 0.606, 4: 0.909, 5: 1.212, 6: 1.515,
        7: 1.818, 8: 2.121, 9: 2.424, 10: 2.727, 11: 3.030, 12: 3.333
    }
}

# 39-Year Nonresidential Real Property - Mid-Month Convention (MM)
# GDS Straight-Line
MACRS_39YR_MM = {
    # Year: {Month: Percentage}
    1: {
        1: 2.461, 2: 2.247, 3: 2.033, 4: 1.819, 5: 1.605, 6: 1.391,
        7: 1.177, 8: 0.963, 9: 0.749, 10: 0.535, 11: 0.321, 12: 0.107
    },
    # Years 2-39: 2.564% regardless of month
    **{year: {month: 2.564 for month in range(1, 13)} for year in range(2, 40)},
    # Year 40: varies by month (reciprocal of year 1)
    40: {
        1: 0.000, 2: 0.214, 3: 0.428, 4: 0.642, 5: 0.856, 6: 1.070,
        7: 1.284, 8: 1.498, 9: 1.712, 10: 1.926, 11: 2.140, 12: 2.354
    }
}

def get_macrs_percentage(asset_class, year, month=None):
    """
    Get MACRS depreciation percentage for a given asset class and year
    
    Args:
        asset_class: '5yr', '7yr', '15yr', '27.5yr', or '39yr'
        year: Year of depreciation (1-based)
        month: Month placed in service (1-12, required for 27.5yr and 39yr)
    
    Returns:
        Depreciation percentage for that year
    """
    if asset_class == '5yr':
        return MACRS_5YR_HY.get(year, 0.0)
    elif asset_class == '7yr':
        return MACRS_7YR_HY.get(year, 0.0)
    elif asset_class == '15yr':
        return MACRS_15YR_HY.get(year, 0.0)
    elif asset_class == '27.5yr':
        if month is None:
            raise ValueError("Month required for 27.5yr property")
        return MACRS_27_5YR_MM.get(year, {}).get(month, 0.0)
    elif asset_class == '39yr':
        if month is None:
            raise ValueError("Month required for 39yr property")
        return MACRS_39YR_MM.get(year, {}).get(month, 0.0)
    else:
        raise ValueError(f"Unknown asset class: {asset_class}")

def get_accumulated_depreciation(asset_class, years, month=None):
    """
    Get accumulated depreciation percentage through a given number of years
    
    Args:
        asset_class: '5yr', '7yr', '15yr', '27.5yr', or '39yr'
        years: Number of years to accumulate
        month: Month placed in service (1-12, required for 27.5yr and 39yr)
    
    Returns:
        Accumulated depreciation percentage
    """
    total = 0.0
    for year in range(1, years + 1):
        total += get_macrs_percentage(asset_class, year, month)
    return total
