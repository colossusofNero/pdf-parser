import React from 'react';
import { DepreciationRow } from '../types';

interface DepreciationTableProps {
  data: DepreciationRow[];
  onEdit: (index: number, field: keyof DepreciationRow, value: number) => void;
}

export const DepreciationTable: React.FC<DepreciationTableProps> = ({ data, onEdit }) => {
  const headers = [
    'Year', 
    'Standard Depreciation', 
    'Traditional Cost Seg', 
    'Bonus Depreciation'
  ];
  
  const fields: (keyof DepreciationRow)[] = [
    'year',
    'standardDepreciation',
    'traditionalCostSeg',
    'bonusDepreciation'
  ];

  return (
    <div className="mb-8">
      <h3 className="text-lg font-semibold mb-4">Depreciation Details</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr>
              {headers.map((header) => (
                <th key={header} className="px-4 py-2 bg-gray-50 text-left text-sm font-medium text-gray-600">
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {data.map((row, index) => (
              <tr key={index}>
                {fields.map((field) => (
                  <td key={field} className="px-4 py-2">
                    <input
                      type="number"
                      value={row[field]}
                      onChange={(e) => onEdit(index, field, Number(e.target.value))}
                      className="w-full p-1 border rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};