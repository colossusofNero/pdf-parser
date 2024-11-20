import React from 'react';
import { ExtractedData } from '../types';
import { Check, AlertCircle } from 'lucide-react';

interface DataPreviewProps {
  data: ExtractedData & { file?: File };
  onSubmit: () => Promise<void>;
  onEdit: (field: string, value: any) => void;
  isProcessing: boolean;
}

export const DataPreview: React.FC<DataPreviewProps> = ({ data, onSubmit, onEdit, isProcessing }) => {
  // Convert MM/DD/YYYY to YYYY-MM-DD for date input
  const convertDateForInput = (dateStr: string): string => {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [month, day, year] = parts;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    return '';
  };

  // Convert YYYY-MM-DD to MM/DD/YYYY for Caspio
  const handleDateChange = (key: string, value: string) => {
    if (!value) {
      onEdit(key, '');
      return;
    }

    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear();
      onEdit(key, `${month}/${day}/${year}`);
    }
  };

  const fields = [
    { key: 'Name_of_Prospect', label: 'Client Name', type: 'text' },
    { key: 'Address_of_Property', label: 'Property Address', type: 'text' },
    { key: 'Zip_Code', label: 'Zip Code', type: 'text' },
    { key: 'Purchase_Price', label: 'Purchase Price', type: 'currency' },
    { key: 'Capital_Improvements_Amount', label: 'Capital Improvements', type: 'currency' },
    { key: 'Building_Value', label: 'Building Value', type: 'currency' },
    { key: 'Know_Land_Value', label: 'Land Value', type: 'currency' },
    { key: 'Date_of_Purchase', label: 'Purchase Date', type: 'date' },
    { key: 'SqFt_Building', label: 'Building Sq Ft', type: 'number' },
    { key: 'Acres_Land', label: 'Land Acres', type: 'acres' },
    { key: 'Year_Built', label: 'Year Built', type: 'number' },
    { key: 'Bid_Amount_Original', label: 'Original Bid Amount', type: 'currency' },
    { key: 'Pay_Upfront', label: 'Upfront Payment', type: 'currency' },
    { key: 'Pay_50_50_Amount', label: '50/50 Payment', type: 'currency' },
    { key: 'Pay_Over_Time', label: 'Over Time Payment', type: 'currency' },
    { key: 'Rush_Fee', label: 'Rush Fee', type: 'currency' },
    { key: 'Multiple_Properties_Quote', label: 'Multiple Properties', type: 'number' },
    { key: 'First_Year_Bonus_Quote', label: 'First Year Bonus', type: 'currency' },
    { key: 'Tax_Year', label: 'Tax Year', type: 'number' },
    { key: 'Tax_Deadline_Quote', label: 'Tax Deadline', type: 'text' }
  ];

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Extracted Data Preview</h2>
      
      <div className="grid grid-cols-2 gap-6 mb-8">
        {fields.map(({ key, label, type }) => (
          <div key={key} className="flex items-center space-x-4">
            <label className="w-1/3 text-gray-600">{label}:</label>
            {type === 'date' ? (
              <>
                <input
                  type="date"
                  value={convertDateForInput(data[key as keyof ExtractedData] as string || '')}
                  onChange={(e) => handleDateChange(key, e.target.value)}
                  className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-500"
                />
                {/* Display the MM/DD/YYYY format as text for reference */}
                <span className="text-sm text-gray-500 ml-2">
                  {data[key as keyof ExtractedData] || ''}
                </span>
              </>
            ) : (
              <input
                type={type === 'number' || type === 'currency' ? 'number' : 'text'}
                step={type === 'currency' ? '0.01' : type === 'number' ? '1' : undefined}
                value={data[key as keyof ExtractedData] || ''}
                onChange={(e) => onEdit(key, e.target.value)}
                className="flex-1 p-2 border rounded focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex justify-end space-x-4">
        <button
          onClick={() => window.location.href = 'mailto:support@example.com'}
          className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          <AlertCircle className="w-4 h-4 inline mr-2" />
          Report Issue
        </button>
        <button
          onClick={onSubmit}
          disabled={isProcessing}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center disabled:opacity-50"
        >
          <Check className="w-4 h-4 mr-2" />
          Submit to Caspio
        </button>
      </div>
    </div>
  );
};