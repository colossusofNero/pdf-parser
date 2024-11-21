import { parsePDF } from './pdfParser';

export interface ExtractedData {
  Name_of_Prospect: string;
  Address_of_Property: string;
  Zip_Code: string;
  Purchase_Price: number;
  Capital_Improvements_Amount: number;
  Building_Value: number;
  Know_Land_Value: number;
  Date_of_Purchase: string;
  SqFt_Building: number;
  Acres_Land: number;
  Year_Built: number;
  Bid_Amount_Original: number;
  Pay_Upfront: number;
  Pay_50_50_Amount: number;
  Pay_Over_Time: number;
  Rush_Fee: number;
  Multiple_Properties_Quote: number;
  First_Year_Bonus_Quote: number;
  Tax_Year: number;
  Tax_Deadline_Quote: string;
  Contact_Name_First: string;
  Contact_Name_Last: string;
  Contact_Phone: string;
  Email_from_App: string;
  Quote_pdf: string;
  file?: File;
}

export type PartialExtractedData = Partial<ExtractedData>;

const excelDateToJSDate = (excelNumber: number): string => {
  const date = new Date((excelNumber - 25569) * 86400 * 1000);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return '';
  
  try {
    if (dateString.includes('45350')) {
      return excelDateToJSDate(45350);
    }

    if (/^\d+$/.test(dateString)) {
      return excelDateToJSDate(parseInt(dateString));
    }

    const parts = dateString.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      if (year.length === 4) {
        return `${month}/${day}/${year}`;
      }
    }

    console.error('Unhandled date format:', dateString);
    return '';
  } catch (error) {
    console.error('Date formatting error:', error, dateString);
    return '';
  }
};

export const uploadFileToCaspio = async (file: File): Promise<string> => {
  const fileUploadUrl = import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL;
  const apiKey = import.meta.env.VITE_CASPIO_API_KEY;

  if (!apiKey) {
    throw new Error('API key not configured');
  }

  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(fileUploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`File upload failed: ${response.status} ${response.statusText} ${errorText}`);
    }

    const responseData = await response.json();
    return responseData.fileUrl || file.name;
  } catch (error) {
    console.error('File Upload Error:', error);
    throw error;
  }
};

export const extractPdfData = async (file: File): Promise<PartialExtractedData> => {
  if (!file) {
    throw new Error('No file provided');
  }

  try {
    const extractedData = await parsePDF(file);
    if (!extractedData) {
      throw new Error('Failed to extract data from PDF');
    }
    return {
      ...extractedData,
      file: file,
      Quote_pdf: file.name
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw error;
  }
};

export const submitToCaspio = async (data: PartialExtractedData): Promise<boolean> => {
  const apiUrl = import.meta.env.VITE_CASPIO_API_URL;
  const apiKey = import.meta.env.VITE_CASPIO_API_KEY;

  if (!apiKey) {
    throw new Error('API key not configured');
  }

  if (data.Date_of_Purchase) {
    const formattedDate = formatDate(data.Date_of_Purchase);
    if (!formattedDate) {
      throw new Error('Invalid date format');
    }
    data.Date_of_Purchase = formattedDate;
  }

  try {
    if (data.file) {
      try {
        const fileUrl = await uploadFileToCaspio(data.file);
        data.Quote_pdf = fileUrl;
      } catch (uploadError) {
        console.error('File upload failed:', uploadError);
      }
    }

    const mappedData = {
      'Name_of_Prospect': data.Name_of_Prospect?.trim(),
      'Address_of_Property': data.Address_of_Property?.trim(),
      'Zip_Code': data.Zip_Code?.trim(),
      'Purchase_Price': data.Purchase_Price ?? 0,
      'Capital_Improvements_Amount': data.Capital_Improvements_Amount ?? 0,
      'Building_Value': data.Building_Value ?? 0,
      'Know_Land_Value': data.Know_Land_Value ?? 0,
      'Date_of_Purchase': data.Date_of_Purchase,
      'SqFt_Building': data.SqFt_Building ?? 0,
      'Acres_Land': data.Acres_Land ?? 0,
      'Year_Built': data.Year_Built ?? 0,
      'Bid_Amount_Original': data.Bid_Amount_Original ?? 0,
      'Pay_Upfront': data.Pay_Upfront ?? 0,
      'Pay_50_50_Amount': data.Pay_50_50_Amount ?? 0,
      'Pay_Over_Time': data.Pay_Over_Time ?? 0,
      'Rush_Fee': data.Rush_Fee ?? 0,
      'Multiple_Properties_Quote': data.Multiple_Properties_Quote ?? 0,
      'First_Year_Bonus_Quote': data.First_Year_Bonus_Quote ?? 0,
      'Tax_Year': data.Tax_Year ?? 0,
      'Tax_Deadline_Quote': data.Tax_Deadline_Quote?.trim() || '',
      'Contact_Name_First': data.Contact_Name_First?.trim(),
      'Contact_Name_Last': data.Contact_Name_Last?.trim(),
      'Contact_Phone': data.Contact_Phone?.trim(),
      'Email_from_App': data.Email_from_App?.trim().toLowerCase(),
      'Quote_pdf': data.Quote_pdf || ''
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey.trim()}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(mappedData),
    });

    if (!response.ok) {
      const errorData = await response.text();
      let errorMessage;
      try {
        const parsedError = JSON.parse(errorData);
        errorMessage = parsedError.Message || response.statusText;
      } catch {
        errorMessage = errorData || response.statusText;
      }
      throw new Error(`Caspio Data Submission Error: ${errorMessage}`);
    }

    return true;
  } catch (error) {
    console.error('Submission Error:', error);
    throw error;
  }
};