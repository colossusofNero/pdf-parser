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
    // Handle Excel serial dates
    if (/^\d+$/.test(dateString)) {
      return excelDateToJSDate(parseInt(dateString));
    }
    
    // Handle MM/DD/YYYY format (already correct)
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
      const parts = dateString.split('/');
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${month}/${day}/${year}`;
    }
    
    // Handle other date formats by parsing and reformatting
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }
    
    throw new Error('Unsupported date format');
  } catch (error) {
    console.error('Date formatting error for value:', dateString, error);
    return '';
  }
};

// Debug environment variables
const debugEnvVars = () => {
  console.log('Environment Variables Debug:', {
    hasViteToken: !!import.meta.env.VITE_CASPIO_ACCESS_TOKEN,
    hasViteApiUrl: !!import.meta.env.VITE_CASPIO_API_URL,
    hasViteFileUrl: !!import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL,
    viteTokenLength: import.meta.env.VITE_CASPIO_ACCESS_TOKEN?.length || 0,
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD
  });
};

// Get environment variables with fallbacks and debugging
const getEnvVars = () => {
  debugEnvVars();
  
  const token = import.meta.env.VITE_CASPIO_ACCESS_TOKEN;
  const apiUrl = import.meta.env.VITE_CASPIO_API_URL;
  const fileUploadUrl = import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL;
  
  return { token, apiUrl, fileUploadUrl };
};

// File upload function with improved error handling
export const uploadFileToCaspio = async (file: File): Promise<string> => {
  if (!file) {
    throw new Error('No file provided');
  }

  const { token, fileUploadUrl } = getEnvVars();

  // Try proxy first, then direct upload
  try {
    // Option 1: Use proxy route (recommended for production)
    console.log('Attempting file upload via proxy...');
    const formData = new FormData();
    formData.append('File', file);

    const proxyResponse = await fetch('/api/proxy-upload', {
      method: 'POST',
      body: formData,
    });

    if (proxyResponse.ok) {
      const responseData = await proxyResponse.json();
      console.log('Proxy upload successful:', responseData);
      return responseData.fileUrl || responseData.data?.fileUrl || file.name;
    } else {
      console.warn('Proxy upload failed, status:', proxyResponse.status);
      // Fall through to direct upload
    }
  } catch (proxyError) {
    console.warn('Proxy upload error:', proxyError);
    // Fall through to direct upload
  }

  // Option 2: Direct upload (fallback)
  if (!fileUploadUrl || !token) {
    console.error('Missing Caspio configuration for direct upload');
    throw new Error('File upload configuration is missing');
  }

  try {
    console.log('Attempting direct file upload to Caspio...');
    const formData = new FormData();
    formData.append('file', file);

    const directResponse = await fetch(fileUploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: formData
    });

    if (!directResponse.ok) {
      const errorText = await directResponse.text();
      console.error('Direct upload failed:', {
        status: directResponse.status,
        statusText: directResponse.statusText,
        error: errorText
      });
      throw new Error(`Direct upload failed: ${directResponse.status} - ${errorText}`);
    }

    const responseData = await directResponse.json();
    console.log('Direct upload successful:', responseData);
    return responseData.fileUrl || responseData.data?.fileUrl || file.name;

  } catch (directError) {
    console.error('Direct upload error:', directError);
    throw new Error(`File upload failed: ${directError instanceof Error ? directError.message : 'Unknown error'}`);
  }
};

// Extract data from PDF with improved error handling
export const extractPdfData = async (file: File): Promise<PartialExtractedData> => {
  if (!file) {
    throw new Error('No file provided');
  }

  if (!file.type.includes('pdf')) {
    throw new Error('Please provide a PDF file');
  }

  try {
    console.log('Extracting data from PDF:', file.name);
    const extractedData = await parsePDF(file);
    
    return { 
      ...extractedData, 
      file, 
      Quote_pdf: file.name 
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(`Failed to extract PDF data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Submit data to Caspio with comprehensive error handling
export const submitToCaspio = async (data: PartialExtractedData): Promise<boolean> => {
  const { token, apiUrl } = getEnvVars();

  if (!apiUrl) {
    throw new Error('Caspio API URL is not configured');
  }

  if (!token) {
    throw new Error('Caspio access token is not configured');
  }

  try {
    console.log('Preparing data for Caspio submission...');

    // Format dates properly
    const formattedData = {
      ...data,
      Date_of_Purchase: data.Date_of_Purchase ? formatDate(data.Date_of_Purchase) : undefined,
      CapEx_Date: data.CapEx_Date ? formatDate(data.CapEx_Date) : undefined,
    };

    // Handle file upload if present
    if (data.file && formattedData.Quote_pdf === data.file.name) {
      try {
        console.log('Uploading file before submission...');
        const fileUrl = await uploadFileToCaspio(data.file);
        formattedData.Quote_pdf = fileUrl;
        console.log('File uploaded, URL:', fileUrl);
      } catch (error) {
        console.error('File upload failed during submission:', error);
        throw new Error(`File upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Remove the file field before submitting to Caspio
    const { file, ...dataToSubmit } = formattedData;

    // Clean up undefined values
    Object.keys(dataToSubmit).forEach(key => {
      if (dataToSubmit[key as keyof typeof dataToSubmit] === undefined) {
        delete dataToSubmit[key as keyof typeof dataToSubmit];
      }
    });

    console.log('Submitting to Caspio:', {
      ...dataToSubmit,
      // Don't log the full data, just show what fields are being sent
      fieldCount: Object.keys(dataToSubmit).length,
      hasRequiredFields: !!(dataToSubmit.Name_of_Prospect && dataToSubmit.Address_of_Property)
    });

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`, // Fixed: use proper Bearer format
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(dataToSubmit)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Caspio API error:', {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        error: errorText
      });
      
      // Parse error message if JSON
      let errorMessage = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorJson.error || errorText;
      } catch (e) {
        // Use raw error text
      }
      
      throw new Error(`Caspio API error (${response.status}): ${errorMessage}`);
    }

    const responseData = await response.json();
    console.log('Caspio submission successful:', responseData);
    return true;

  } catch (error) {
    console.error('Error submitting to Caspio:', error);
    throw error; // Re-throw to preserve the original error
  }
};
