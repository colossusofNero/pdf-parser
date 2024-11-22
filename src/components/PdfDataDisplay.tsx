import React from 'react';
import type { PartialExtractedData } from '../services/api';

interface PdfDataDisplayProps {
  data: PartialExtractedData;
}

interface DisplayField {
  key: keyof PartialExtractedData;
  label: string;
  format?: (value: any) => string;
}

export const PdfDataDisplay: React.FC<PdfDataDisplayProps> = ({ data }) => {
  const formatCurrency = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return '$NaN';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  };

  const formatNumber = (value: number | undefined) => {
    if (value === undefined || isNaN(value)) return 'NaN';
    return value.toString();
  };

  // Debug log to check incoming data
  console.log('PdfDataDisplay received data:', data);

  const fields: DisplayField[] = [
    { key: 'Name_of_Prospect', label: 'Name Of Prospect' },
    { key: 'Address_of_Property', label: 'Address Of Property' },
    { key: 'Zip_Code', label: 'Zip Code' },
    { key: 'Purchase_Price', label: 'Purchase Price', format: formatCurrency },
    { key: 'Date_of_Purchase', label: 'Date Of Purchase' },
    { key: 'Capital_Improvements_Amount', label: 'Capital Improvements Amount', format: formatCurrency },
    { key: 'Building_Value', label: 'Building Value', format: formatCurrency },
    { key: 'Know_Land_Value', label: 'Know Land Value', format: formatCurrency },
    { key: 'SqFt_Building', label: 'Sqft Building', format: formatNumber },
    { key: 'Acres_Land', label: 'Acres Land', format: formatNumber },
    { key: 'Year_Built', label: 'Year Built', format: formatNumber },
    { key: 'Bid_Amount_Original', label: 'Bid Amount Original', format: formatCurrency },
    { key: 'Pay_Upfront', label: 'Pay Upfront', format: formatCurrency }, // Changed to currency
    { key: 'Pay_50_50_Amount', label: 'Pay 50 50 Amount', format: formatCurrency },
    { key: 'Pay_Over_Time', label: 'Pay Over Time', format: formatCurrency }, // Changed to currency
    { key: 'Rush_Fee', label: 'Rush Fee', format: formatCurrency },
    { key: 'Multiple_Properties_Quote', label: 'Multiple Properties Quote', format: formatCurrency },
    { key: 'First_Year_Bonus_Quote', label: 'First Year Bonus Quote', format: formatCurrency },
    { key: 'Tax_Year', label: 'Tax Year', format: formatNumber },
    { key: 'Tax_Deadline_Quote', label: 'Tax Deadline Quote' },
    { key: 'Type_of_Property_Quote', label: 'Type Of Property Quote' }, // Moved up in display order
    { key: 'CapEx_Date', label: 'CapEx Date' } // Moved up in display order
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fields.map(({ key, label, format }) => {
        const value = data[key];
        const displayValue = format ? format(value as number) : value?.toString() || '';

        // Debug log for CapEx_Date and Type_of_Property_Quote
        if (key === 'CapEx_Date' || key === 'Type_of_Property_Quote') {
          console.log(`${key}:`, value);
        }

        // Show all non-null values, including zero
        if (value === null || value === undefined) return null;

        return (
          <div key={key} className="bg-white p-4 rounded-lg shadow-sm">
            <div className="text-sm text-gray-500 mb-1">{label}</div>
            <div className="text-lg font-semibold">{displayValue}</div>
          </div>
        );
      })}

      <div className="col-span-2 text-sm text-gray-500 italic text-center mt-4">
        * All values are extracted from the uploaded PDF
      </div>
    </div>
  );
};

export default PdfDataDisplay;