import React from 'react';
import { ExtractedData } from '../types';

interface PropertyInfoFormProps {
  data: ExtractedData;
  onEdit: (field: keyof ExtractedData, value: any) => void;
}

type FieldConfig = {
  label: string;
  type: string;
};

export const PropertyInfoForm: React.FC<PropertyInfoFormProps> = ({ data, onEdit }) => {
  const fields: (FieldConfig & { key: keyof ExtractedData })[] = [
    { key: 'Name_of_Prospect', label: 'Company Name', type: 'text' },
    { key: 'Type_of_Property_Quote', label: 'Property Type', type: 'text' },
    { key: 'Address_of_Property', label: 'Property Address', type: 'text' },
    { key: 'Purchase_Price', label: 'Purchase Price', type: 'number' },
    { key: 'Capital_Improvements_Amount', label: 'Capital Improvements', type: 'number' },
    { key: 'Know_Land_Value', label: 'Land Value', type: 'number' },
    { key: 'Date_of_Purchase', label: 'Purchase Date', type: 'date' },
    { key: 'SqFt_Building', label: 'Building Square Footage', type: 'number' },
    { key: 'Acres_Land', label: 'Land Acres', type: 'number' },
    { key: 'Tax_Deadline_Quote', label: 'Due Date', type: 'text' },
    { key: 'Bid_Amount_Original', label: 'Bid Amount', type: 'number' },
    { key: 'Rush_Fee', label: 'Rush Fee', type: 'number' },
    { key: 'CapEx_Date', label: 'CapEx Date', type: 'date' }
  ];

  // Format value for input
  const formatValueForInput = (value: any): string => {
    if (value === null || value === undefined) return '';
    if (value instanceof File) return '';
    if (Array.isArray(value)) return '';
    return value.toString();
  };

  // Calculate total bid amount
  const totalBidAmount = (data.Bid_Amount_Original || 0) + (data.Rush_Fee || 0);

  return (
    <div className="grid grid-cols-2 gap-6 mb-8">
      <div className="space-y-4">
        {fields.map(({ key, label, type }) => {
          const value = data[key];
          const displayValue = formatValueForInput(value);

          return (
            <div key={key} className="flex items-start">
              <div className="w-1/3 text-gray-600">{label}:</div>
              <input
                type={type}
                value={displayValue}
                onChange={(e) => onEdit(key, type === 'number' ? Number(e.target.value) : e.target.value)}
                className="flex-1 p-1 border rounded focus:ring-2 focus:ring-blue-500"
              />
            </div>
          );
        })}
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Calculated Values</h3>
        <div className="space-y-2">
          <p className="text-gray-700">
            Total Bid Amount: ${totalBidAmount.toLocaleString()}
          </p>
          <p className="text-gray-700">
            First Year Bonus Quote: ${data.First_Year_Bonus_Quote?.toLocaleString() || '0'}
          </p>
          <p className="text-gray-700">
            Tax Year: {data.Tax_Year || 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
};