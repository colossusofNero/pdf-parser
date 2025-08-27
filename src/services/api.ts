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

// File upload function with better error handling
export const uploadFileToCaspio = async (file: File): Promise<string> => {
  console.log('File upload requested for:', file.name);
  
  const fileUploadUrl = import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL;
  
  if (!fileUploadUrl || !staticToken) {
    console.log('Missing upload configuration, returning filename');
    return file.name;
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(fileUploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${staticToken}`,
        'Accept': 'application/json'
      },
      body: formData
    });

    console.log('Upload response status:', response.status);

    if (response.ok) {
      const responseText = await response.text();
      console.log('Upload response:', responseText);
      
      if (responseText.trim()) {
        try {
          const responseData = JSON.parse(responseText);
          return responseData.fileUrl || responseData.data?.fileUrl || file.name;
        } catch (e) {
          return file.name;
        }
      }
    }
    
    return file.name;
  } catch (error) {
    console.log('Upload error:', error);
    return file.name;
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

// Submit data to Caspio with better error handling
export const submitToCaspio = async (data: PartialExtractedData): Promise<boolean> => {
  const apiUrl = import.meta.env.VITE_CASPIO_API_URL;

  if (!apiUrl) {
    throw new Error('API URL not configured');
  }

  if (!staticToken) {
    throw new Error('Caspio access token is not configured');
  }

  try {
    console.log('Environment Variables Debug:', {
      hasViteToken: !!staticToken,
      hasViteApiUrl: !!apiUrl,
      hasViteFileUrl: !!import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL,
      viteTokenLength: staticToken ? staticToken.length : 0,
      isDev: import.meta.env.DEV,
      isProd: import.meta.env.PROD,
      mode: import.meta.env.MODE
    });

    // Format dates
    const formattedData = {
      ...data,
      Date_of_Purchase: data.Date_of_Purchase ? formatDate(data.Date_of_Purchase) : undefined,
      CapEx_Date: data.CapEx_Date ? formatDate(data.CapEx_Date) : undefined,
    };

    // Remove the file field before submitting to Caspio
    const { file, ...dataToSubmit } = formattedData;

    console.log('Preparing data for Caspio submission...');
    console.log('Submitting to Caspio:', dataToSubmit);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${staticToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(dataToSubmit)
    });

    console.log('Caspio response status:', response.status);
    console.log('Caspio response ok:', response.ok);

    // Get response as text first to avoid JSON parsing errors
    const responseText = await response.text();
    console.log('Caspio raw response:', responseText);
    console.log('Response length:', responseText.length);

    if (!response.ok) {
      console.error('Caspio API error:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });
      
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      if (responseText) {
        errorMessage = responseText || errorMessage;
      }
      
      throw new Error(`Submission failed: ${errorMessage}`);
    }

    // Handle empty or non-JSON responses
    if (responseText.trim() === '') {
      console.log('Empty response from Caspio (likely success)');
      return true;
    }

    try {
      const responseData = JSON.parse(responseText);
      console.log('Caspio submission successful:', responseData);
      return true;
    } catch (parseError) {
      console.log('Could not parse response as JSON, but status was ok:', parseError);
      // If status is success but JSON parsing failed, still return true
      return true;
    }

  } catch (error) {
    console.error('Error submitting to Caspio:', error);
    throw error;
  }
};
