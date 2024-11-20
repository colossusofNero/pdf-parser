export const formatDate = (value: string): string => {
  if (!value) return '';
  
  try {
    // If already in MM/DD/YYYY format, return as is
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      return value;
    }

    // If in YYYY-MM-DD format, convert to MM/DD/YYYY
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-');
      return `${month}/${day}/${year}`;
    }

    // Try to parse the date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }

    return value;
  } catch {
    return value;
  }
};

// Rest of the formatters.ts file remains the same
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