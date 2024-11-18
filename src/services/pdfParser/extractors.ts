import { TextItem } from './types';
import { ExtractedData } from '../../types';

const formatDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric'
  });
};

const formatNumber = (value: string, decimals: number = 2): number => {
  const num = parseFloat(value.replace(/[^0-9.-]/g, ''));
  return isNaN(num) ? 0 : Number(num.toFixed(decimals));
};

const formatZipCode = (zip: string): string => {
  const cleaned = zip.replace(/\D/g, '');
  return cleaned.slice(0, 5).padStart(5, '0');
};

export const extractMetadataRow = (textContent: { items: TextItem[] }): ExtractedData => {
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

  // Create and format the extracted data
  const data: ExtractedData = {
    Name_of_Prospect: fields.Name_of_Prospect || '',
    Address_of_Property: fields.Address_of_Property || '',
    Zip_Code: formatZipCode(fields.Zip_Code || ''),
    Purchase_Price: formatNumber(fields.Purchase_Price || '0'),
    Capital_Improvements_Amount: formatNumber(fields.Capital_Improvements_Amount || '0'),
    Building_Value: formatNumber(fields.Building_Value || '0'),
    Know_Land_Value: formatNumber(fields.Know_Land_Value || '0'),
    Date_of_Purchase: formatDate(fields.Date_of_Purchase || ''),
    SqFt_Building: Math.round(formatNumber(fields.SqFt_Building || '0', 0)),
    Acres_Land: formatNumber(fields.Acres_Land || '0', 2),
    Year_Built: Math.round(formatNumber(fields.Year_Built || '0', 0)),
    Bid_Amount_Original: formatNumber(fields.Bid_Amount_Original || '0'),
    Pay_Upfront: formatNumber(fields.Pay_Upfront || '0'),
    Pay_50_50_Amount: formatNumber(fields.Pay_50_50_Amount || '0'),
    Pay_Over_Time: formatNumber(fields.Pay_Over_Time || '0'),
    Rush_Fee: formatNumber(fields.Rush_Fee || '0'),
    Multiple_Properties_Quote: Math.round(formatNumber(fields.Multiple_Properties_Quote || '0', 0)),
    First_Year_Bonus_Quote: formatNumber(fields.First_Year_Bonus_Quote || '0'),
    Tax_Year: Math.round(formatNumber(fields.Tax_Year || '0', 0)),
    Tax_Deadline_Quote: fields.Tax_Deadline_Quote || ''
  };

  return data;
};