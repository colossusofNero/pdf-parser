import { ExtractedData } from '../../types';
import { ValidationError } from './types';
import { formatNumber, formatZipCode } from './formatters';

export const validateRequiredFields = (data: Partial<ExtractedData>): ValidationError[] => {
  const errors: ValidationError[] = [];
  const requiredFields = [
    'Name_of_Prospect',
    'Address_of_Property',
    'Zip_Code',
    'Purchase_Price',
    'Type_of_Property', // Added Type_of_Property
    'CapEx_Date' // Added CapEx_Date
  ];

  requiredFields.forEach(field => {
    if (!data[field as keyof ExtractedData]) {
      errors.push({
        field,
        message: `${field} is required`
      });
    }
  });

  return errors;
};

export const validateFieldFormats = (data: Partial<ExtractedData>): ValidationError[] => {
  const errors: ValidationError[] = [];

  // Validate zip code format
  if (data.Zip_Code && formatZipCode(data.Zip_Code) !== data.Zip_Code) {
    errors.push({
      field: 'Zip_Code',
      message: 'Invalid zip code format'
    });
  }

  // Validate numeric fields are positive
  const numericFields = [
    'Purchase_Price',
    'Capital_Improvements_Amount',
    'Building_Value',
    'Know_Land_Value',
    'SqFt_Building',
    'Acres_Land',
    'Year_Built',
    'Bid_Amount_Original',
    'Pay_Upfront',
    'Pay_50_50_Amount',
    'Pay_Over_Time',
    'Rush_Fee',
    'Multiple_Properties_Quote',
    'First_Year_Bonus_Quote',
    'Tax_Year'
  ] as const;

  numericFields.forEach(field => {
    const value = data[field];
    if (value !== undefined && value < 0) {
      errors.push({
        field,
        message: `${field} cannot be negative`
      });
    }
  });

  // Validate CapEx_Date format (if it's expected to be a valid date string)
  if (data.CapEx_Date && isNaN(Date.parse(data.CapEx_Date))) {
    errors.push({
      field: 'CapEx_Date',
      message: 'Invalid date format for CapEx_Date'
    });
  }

  return errors;
};
