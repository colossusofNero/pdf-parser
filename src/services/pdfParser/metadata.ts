import { TextContent, MetadataField } from './types';
import { ExtractedData } from '../../types';
import { formatDate, formatNumber, formatZipCode, formatCurrency } from './formatters';

const metadataFields: MetadataField[] = [
  { key: 'Name_of_Prospect', type: 'text', required: true },
  { key: 'Address_of_Property', type: 'text', required: true },
  { key: 'Zip_Code', type: 'zipcode', required: true },
  { key: 'Purchase_Price', type: 'currency', required: true },
  { key: 'Capital_Improvements_Amount', type: 'currency' },
  { key: 'Building_Value', type: 'currency' },
  { key: 'Know_Land_Value', type: 'currency' },
  { key: 'Date_of_Purchase', type: 'date' },
  { key: 'SqFt_Building', type: 'number' },
  { key: 'Acres_Land', type: 'number' },
  { key: 'Year_Built', type: 'number' },
  { key: 'Bid_Amount_Original', type: 'currency' },
  { key: 'Pay_Upfront', type: 'currency' },
  { key: 'Pay_50_50_Amount', type: 'currency' },
  { key: 'Pay_Over_Time', type: 'currency' },
  { key: 'Rush_Fee', type: 'currency' },
  { key: 'Multiple_Properties_Quote', type: 'number' },
  { key: 'First_Year_Bonus_Quote', type: 'currency' },
  { key: 'Tax_Year', type: 'number' },
  { key: 'Tax_Deadline_Quote', type: 'text' }
];

export const extractMetadataRow = (textContent: TextContent): ExtractedData => {
  // Find the metadata row (white text)
  const whiteTextItems = textContent.items
    .filter(item => item.str.trim() && item.transform[0] === 0)
    .map(item => item.str)
    .join('');

  // Split the metadata string into fields
  const fields = whiteTextItems
    .split('||')
    .filter(field => field.includes(':'))
    .reduce((acc: Record<string, string>, field) => {
      const [key, value] = field.split(':').map(part => part.trim());
      if (key) acc[key] = value || '';
      return acc;
    }, {});

  // Initialize data object with default values
  const data = {} as ExtractedData;

  // Process each field according to its type
  metadataFields.forEach(({ key, type }) => {
    const value = fields[key] || '';

    switch (type) {
      case 'text':
        data[key] = value;
        break;
      case 'number':
        data[key] = formatNumber(value, 0);
        break;
      case 'currency':
        data[key] = formatCurrency(value);
        break;
      case 'date':
        data[key] = formatDate(value);
        break;
      case 'zipcode':
        data[key] = formatZipCode(value);
        break;
    }
  });

  return data;
};