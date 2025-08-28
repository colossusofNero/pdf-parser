// services/api.ts - Fixed syntax errors and added generateFileName
import { parsePDF } from './pdf/index';

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

// Helper function to sanitize filename
const sanitizeFileName = (text: string): string => {
  return text
    .replace(/[<>:"/\\|?*]/g, '') // Remove illegal filename characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

// EXPORTED: Helper function to generate proper filename from PDF data
export const generateFileName = (extractedData: PartialExtractedData): string => {
  const prospectName = sanitizeFileName(extractedData.Name_of_Prospect || 'Unknown');
  const address = sanitizeFileName(extractedData.Address_of_Property || 'Unknown Address');
  
  return `RCGV_${prospectName}_${address}.pdf`;
};

// Get environment config
const getEnvironmentConfig = () => {
  try {
    const token = import.meta.env.VITE_CASPIO_ACCESS_TOKEN || 
                  import.meta.env.VITE_CASPIO_API_KEY || '';
    const apiUrl = import.meta.env.VITE_CASPIO_API_URL || '';
    const fileUploadUrl = import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL || '';
    
    console.log('Environment Variables Debug:', {
      hasViteToken: !!token,
      hasViteApiUrl: !!apiUrl,
      hasViteFileUrl: !!fileUploadUrl,
      viteTokenLength: token ? token.length : 0,
      isDev: import.meta.env.DEV,
      isProd: import.meta.env.PROD,
      mode: import.meta.env.MODE
    });
    
    return { token, apiUrl, fileUploadUrl };
  } catch (error) {
    console.error('Failed to access environment variables:', error);
    return { token: '', apiUrl: '', fileUploadUrl: '' };
  }
};

// Date formatting helper
const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }
    return '';
  } catch (error) {
    console.error('Date formatting error:', error);
    return '';
  }
};

// Extract data from PDF
export const extractPdfData = async (file: File): Promise<PartialExtractedData> => {
  if (!file) {
    throw new Error('No file provided');
  }

  try {
    console.log('Extracting data from PDF:', file.name);
    const extractedData = await parsePDF(file);
    return { ...extractedData, file };
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw error;
  }
};

// File upload with improved error handling
export const uploadFileToCaspio = async (file: File): Promise<string> => {
  if (!file) {
    throw new Error('No file provided');
  }

  const { token, fileUploadUrl } = getEnvironmentConfig();

  // Try proxy first (skip for now since it's failing)
  console.log('Skipping proxy upload (was failing), attempting direct upload...');

  // Direct upload to Caspio
  if (!fileUploadUrl || !token) {
    console.warn('Missing file upload configuration, returning filename only');
    return file.name;
  }

  try {
    console.log('Attempting direct file upload to Caspio...');
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(fileUploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: formData
    });

    console.log('File upload response status:', response.status);
    console.log('File upload response headers:', Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Direct upload failed:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      // Don't fail completely, just return filename
      console.log('File upload failed, continuing with filename only');
      return file.name;
    }

    // Try to parse response
    const responseText = await response.text();
    console.log('File upload raw response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log('Direct upload successful:', responseData);
    } catch (parseError) {
      console.log('Could not parse upload response as JSON, assuming success');
      responseData = { fileUrl: file.name };
    }
    
    return responseData.fileUrl || responseData.data?.fileUrl || file.name;

  } catch (error) {
    console.error('Direct upload error:', error);
    console.log('File upload failed, continuing with filename only');
    return file.name;
  }
};

// Submit data to Caspio with robust response handling
export const submitToCaspio = async (data: PartialExtractedData): Promise<boolean> => {
  const config = getEnvironmentConfig();

  if (!config.token) {
    throw new Error('Caspio access token is not configured');
  }

  if (!config.apiUrl) {
    throw new Error('Caspio API URL is not configured');
  }

  try {
    console.log('Preparing data for Caspio submission...');

    // Format dates
    const formattedData = {
      ...data,
      Date_of_Purchase: data.Date_of_Purchase ? formatDate(data.Date_of_Purchase) : undefined,
      CapEx_Date: data.CapEx_Date ? formatDate(data.CapEx_Date) : undefined,
    };

    // Remove file and undefined values
    const { file, ...dataToSubmit } = formattedData;
    Object.keys(dataToSubmit).forEach(key => {
      if (dataToSubmit[key as keyof typeof dataToSubmit] === undefined) {
        delete dataToSubmit[key as keyof typeof dataToSubmit];
      }
    });

    console.log('Submitting to Caspio:', dataToSubmit);
    console.log('Request details:', {
      url: config.apiUrl,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token.substring(0, 20)}...`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      bodySize: JSON.stringify(dataToSubmit).length
    });

    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(dataToSubmit)
    });

    console.log('Caspio response details:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries()),
      url: response.url,
      redirected: response.redirected,
      type: response.type
    });

    // Get response body as text first
    const responseText = await response.text();
    console.log('Caspio raw response body:', responseText);
    console.log('Response body length:', responseText.length);

    if (!response.ok) {
      console.error('Caspio API error:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });
      
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      if (responseText) {
        try {
          const errorJson = JSON.parse(responseText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
        } catch (e) {
          errorMessage = responseText || errorMessage;
        }
      }
      
      throw new Error(`Caspio API error: ${errorMessage}`);
    }

    // Parse JSON response safely
    let responseData;
    if (responseText.trim() === '') {
      console.log('Empty response from Caspio - assuming success');
      responseData = { success: true, message: 'Empty response (likely success)' };
    } else {
      try {
        responseData = JSON.parse(responseText);
        console.log('Caspio submission successful:', responseData);
      } catch (parseError) {
        console.error('Failed to parse Caspio response as JSON:', parseError);
        console.log('Raw response was:', responseText);
        
        // If status is 200/201 but JSON parsing failed, still consider it success
        if (response.status >= 200 && response.status < 300) {
          console.log('Status indicates success despite JSON parse error');
          responseData = { 
            success: true, 
            message: 'Success (non-JSON response)',
            rawResponse: responseText 
          };
        } else {
          throw new Error(`Invalid JSON response from Caspio: ${responseText}`);
        }
      }
    }

    console.log('Final response data:', responseData);
    return true;

  } catch (error) {
    console.error('Error submitting to Caspio:', error);
    throw error;
  }
};
