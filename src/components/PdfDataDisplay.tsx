import React from 'react';
import type { PartialExtractedData } from '../services/api';

interface PdfDataDisplayProps {
  data: PartialExtractedData;
}

export const PdfDataDisplay: React.FC<PdfDataDisplayProps> = ({ data }) => {
  // Helper function to format values for display
  const formatValue = (key: string, value: any): string => {
    if (value === null || value === undefined) return 'N/A';
    
    // Format currency values
    if (
      key.includes('Price') ||
      key.includes('Value') ||
      key.includes('Amount') ||
      key.includes('Fee') ||
      key.includes('Quote')
    ) {
      return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD'
      }).format(value);
    }

    // Format dates
    if (key === 'Date_of_Purchase') {
      return new Date(value).toLocaleDateString();
    }

    // Format numbers with commas
    if (typeof value === 'number') {
      return new Intl.NumberFormat('en-US').format(value);
    }

    return value.toString();
  };

  // Helper function to format field names for display
  const formatFieldName = (key: string): string => {
    return key
      .replace(/_/g, ' ')  // Replace underscores with spaces
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())  // Capitalize first letter
      .join(' ');
  };

  // Filter out null/undefined values and sort fields
  const sortedEntries = Object.entries(data)
    .filter(([_, value]) => value !== null && value !== undefined)
    .sort(([keyA], [keyB]) => keyA.localeCompare(keyB));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {sortedEntries.map(([key, value]) => (
          <div key={key} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm font-medium text-gray-500 mb-1">
              {formatFieldName(key)}
            </p>
            <p className="text-lg font-semibold text-gray-900">
              {formatValue(key, value)}
            </p>
          </div>
        ))}
      </div>
      
      <div className="text-sm text-gray-500 italic text-center">
        * All values are extracted from the uploaded PDF
      </div>
    </div>
  );
};

export default PdfDataDisplay;