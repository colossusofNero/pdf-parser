export const formatDate = (value: string): string => {
  if (!value) return '';
  
  // Handle different date formats
  const dateFormats = [
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/    // YYYY-MM-DD
  ];

  for (const format of dateFormats) {
    const match = value.match(format);
    if (match) {
      const [_, month, day, year] = match;
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric'
        });
      }
    }
  }
  
  return '';
};

export const formatNumber = (value: string | number, decimals: number = 2): number => {
  const strValue = String(value).replace(/[^0-9.-]/g, '');
  const num = parseFloat(strValue);
  return isNaN(num) ? 0 : Number(num.toFixed(decimals));
};

export const formatZipCode = (value: string): string => {
  const cleaned = String(value).replace(/\D/g, '');
  return cleaned.slice(0, 5).padStart(5, '0');
};

export const formatCurrency = (value: string | number): number => {
  const strValue = String(value).replace(/[^0-9.-]/g, '');
  return formatNumber(strValue, 2);
};