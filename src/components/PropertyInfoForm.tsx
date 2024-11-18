import React from 'react';
import { ExtractedData } from '../types';

interface PropertyInfoFormProps {
  data: ExtractedData;
  onEdit: (field: string, value: any) => void;
}

type FieldConfig = {
  key: string;
  label: string;
  type: string;
};

export const PropertyInfoForm: React.FC<PropertyInfoFormProps> = ({ data, onEdit }) => {
  const fields: FieldConfig[] = [
    { key: 'companyName', label: 'Company Name', type: 'text' },
    { key: 'propertyType', label: 'Property Type', type: 'text' },
    { key: 'address', label: 'Property Address', type: 'text' },
    { key: 'purchasePrice', label: 'Purchase Price', type: 'number' },
    { key: 'capitalImprovements', label: 'Capital Improvements', type: 'number' },
    { key: 'landValue', label: 'Land Value', type: 'number' },
    { key: 'purchaseDate', label: 'Purchase Date', type: 'date' },
    { key: 'buildingSqFt', label: 'Building Square Footage', type: 'number' },
    { key: 'acresLand', label: 'Land Acres', type: 'number' },
    { key: 'dueDate', label: 'Due Date', type: 'date' },
    { key: 'bidAmount', label: 'Bid Amount', type: 'number' },
    { key: 'rushFee', label: 'Rush Fee', type: 'number' }
  ];

  return (
    <div className="grid grid-cols-2 gap-6 mb-8">
      <div className="space-y-4">
        {fields.map(({ key, label, type }) => (
          <div key={key} className="flex items-start">
            <div className="w-1/3 text-gray-600">{label}:</div>
            <input
              type={type}
              value={data[key as keyof ExtractedData] as string | number}
              onChange={(e) => onEdit(key, type === 'number' ? Number(e.target.value) : e.target.value)}
              className="flex-1 p-1 border rounded focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
      </div>
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Calculated Values</h3>
        <div className="space-y-2">
          <p className="text-gray-700">
            Total Bid Amount: ${(data.bidAmount + data.rushFee).toLocaleString()}
          </p>
          <p className="text-gray-700">
            First Year Bonus Quote: ${(data.depreciationTable[0]?.firstYearBonusQuote || 0).toLocaleString()}
          </p>
          <p className="text-gray-700">
            Tax Year: {data.depreciationTable[0]?.taxYear || 'N/A'}
          </p>
        </div>
      </div>
    </div>
  );
};