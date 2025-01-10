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
  CapEx_Date: string;
  Type_of_Property_Quote: string;
  file?: File;
}

export type PartialExtractedData = Partial<ExtractedData>;

// Helper function for Excel date conversion
const excelDateToJSDate = (excelNumber: number): string => {
  const date = new Date((excelNumber - 25569) * 86400 * 1000);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

// Helper function for date formatting
const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    if (/^\d+$/.test(dateString)) {
      return excelDateToJSDate(parseInt(dateString));
    }
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${month}/${day}/${year}`;
    }
    throw new Error('Unsupported date format');
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
};

// Get static token from environment
const staticToken = import.meta.env.VITE_CASPIO_ACCESS_TOKEN;

// File upload function using static token
export const uploadFileToCaspio = async (file: File): Promise<string> => {
  const fileUploadUrl = import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL;

  if (!fileUploadUrl) {
    throw new Error('Caspio file upload URL is not configured');
  }

  if (!staticToken) {
    throw new Error('Caspio access token is not configured');
  }

  const formData = new FormData();
  formData.append('File', file);

  try {
    const response = await fetch(fileUploadUrl, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'Authorization': `bearer ${staticToken}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Upload failed:', {
        status: response.status,
        error: errorText
      });
      throw new Error(`Request failed: ${response.status}`);
    }

    const responseData = await response.json();
    console.log('Upload response:', responseData);
    return responseData.fileUrl || file.name;
  } catch (error) {
    console.error('File upload error:', error);
    throw error;
  }
};

// Extract data from PDF
export const extractPdfData = async (file: File): Promise<PartialExtractedData> => {
  if (!file) {
    throw new Error('No file provided');
  }

  try {
    const extractedData = await parsePDF(file);
    return { ...extractedData, file, Quote_pdf: file.name };
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw error;
  }
};

// Submit data to Caspio using static token
// Submit data to Caspio using static token
export const submitToCaspio = async (data: PartialExtractedData): Promise<boolean> => {
  const apiUrl = import.meta.env.VITE_CASPIO_API_URL;

  if (!apiUrl) {
    throw new Error('API URL not configured');
  }

  if (!staticToken) {
    throw new Error('Caspio access token is not configured');
  }

  try {
    // Format dates
    const formattedData = {
      ...data,
      Date_of_Purchase: data.Date_of_Purchase ? formatDate(data.Date_of_Purchase) : undefined,
      CapEx_Date: data.CapEx_Date ? formatDate(data.CapEx_Date) : undefined,
    };

    // Handle file upload if present
    if (data.file) {
      try {
        const fileUrl = await uploadFileToCaspio(data.file);
        formattedData.Quote_pdf = fileUrl;
      } catch (error) {
        console.error('File upload failed:', error);
        throw new Error('File upload failed during Caspio submission.');
      }
    }

    // Remove the file field before submitting to Caspio
    const { file, ...dataToSubmit } = formattedData;

    console.log('Submitting to Caspio:', dataToSubmit);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${staticToken}`,
        'Content-Type': 'application/json',
        'accept': 'application/json'
      },
      body: JSON.stringify(dataToSubmit)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Submission failed: ${response.status} ${errorText}`);
    }

    return true;
  } catch (error) {
    console.error('Error submitting to Caspio:', error);
    throw error;
  }
};