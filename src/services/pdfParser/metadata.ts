import { MetadataField } from './types';
import { ExtractedData } from '../../types';
import { formatDate, formatNumber, formatZipCode, formatCurrency } from './formatters';

const metadataFields: MetadataField[] = [
  { key: 'Name_of_Prospect', type: 'text', required: true },
  { key: 'Address_of_Property', type: 'text', required: true },
  { key: 'Zip_Code', type: 'zipcode', required: true },
  { key: 'Type_of_Property_Quote', type: 'text' },
  { key: 'Purchase_Price', type: 'currency', required: true },
  { key: 'Capital_Improvements_Amount', type: 'currency' },
  { key: 'Building_Value', type: 'currency' },
  { key: 'Know_Land_Value', type: 'currency' },
  { key: 'Date_of_Purchase', type: 'date' },
  { key: 'CapEx_Date', type: 'date' },
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

type PDFTextItem = {
  str: string;
  transform: number[];
};

export const extractMetadataRow = (textContent: { items: (PDFTextItem | any)[] }): Partial<ExtractedData> => {
  // Find the metadata row (white text)
  const whiteTextItems = textContent.items
    .filter((item: PDFTextItem | any): item is PDFTextItem => {
      if (!('str' in item) || !('transform' in item)) return false;
      const hasText = Boolean(item.str.trim());
      const isWhiteText = item.transform[0] === 0;
      console.log('Filtering item:', {
        text: item.str,
        transform: item.transform[0],
        hasText,
        isWhiteText
      });
      return hasText && isWhiteText;
    })
    .map(item => item.str)
    .join('');

  console.log('Raw metadata string:', whiteTextItems);

  // Split the metadata string into fields
  const fields = whiteTextItems
    .split('||')
    .filter((field: string) => field.includes(':'))
    .reduce((acc: Record<string, string>, field: string) => {
      const [key, value] = field.split(':').map((part: string) => part.trim());
      console.log('Processing field:', { key, value });
      if (key) acc[key] = value || '';
      return acc;
    }, {});

  console.log('Parsed fields:', fields);

  // Initialize data object
  const data = {} as Record<keyof ExtractedData, any>;

  // Process each field according to its type
  metadataFields.forEach(({ key, type }) => {
    const value = fields[key] || '';
    console.log(`Processing field ${key} of type ${type} with value:`, value);

    switch (type) {
      case 'text':
        data[key] = value || undefined;
        break;
      case 'zipcode':
        data[key] = formatZipCode(value) || undefined;
        break;
      case 'number':
      case 'currency':
        const numValue = type === 'currency' ? formatCurrency(value) : formatNumber(value, 0);
        data[key] = numValue || undefined;
        break;
      case 'date':
        data[key] = formatDate(value) || undefined;
        break;
    }
  });

  console.log('Final processed data:', data);
  return data as Partial<ExtractedData>;
};