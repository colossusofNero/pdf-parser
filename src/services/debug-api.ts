// Create this as services/debug-api.ts temporarily
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

// HARDCODED VALUES FOR DEBUGGING - REMOVE IN PRODUCTION
const DEBUG_CONFIG = {
  token: '8rjRGhIr1nKCkk2zem-L4MreLMUystVE-UvYl2YwWfufOgd_tk2fRtbTrIr8Xu9-iLD5gjyEMPyeUl9mPGAFaNxCYUzYuyqm1yaE7Ez7dgTflSR9ndgZe8YM--RNekuUC_f_w1l3v56sepjOiSFedz0UaU4LFVAHdGKtVci0fgY_ns_gpC7V9HL6Sc0_h5PFSwWgPXchZv6ckT9zSLUAp2EUoAVpVpXo19nN6qxT3wT7oMKLEEWNZE0J6SkRNJjuv_ExRTw6FboCDZx8gdzzs7JBfm7OCpJlbjYIpcYpZsG6B6AxvW3BFtGKCzu5nZmi_kal3KJ5ktBTsBnHSrCnhOAW4DfApXf6QCY8_pWVt8sG6VG_O8yQkMFSit4Iufmmb8r8wNWhKpyqo4B6XeAhjretTBfq-t1s3NvU3In-GRM',
  apiUrl: 'https://c1acc979.caspio.com/rest/v2/tables/A_New_Property_tbl/records',
  fileUploadUrl: 'https://c1acc979.caspio.com/rest/v2/files'
};

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

export const extractPdfData = async (file: File): Promise<PartialExtractedData> => {
  if (!file) {
    throw new Error('No file provided');
  }

  try {
    console.log('Extracting data from PDF:', file.name);
    const extractedData = await parsePDF(file);
    return { ...extractedData, file, Quote_pdf: file.name };
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw error;
  }
};

export const uploadFileToCaspio = async (file: File): Promise<string> => {
  console.log('File upload requested for:', file.name);
  // For now, just return the filename - skip actual upload
  return file.name;
};

export const submitToCaspio = async (data: PartialExtractedData): Promise<boolean> => {
  console.log('=== DEBUG CASPIO SUBMISSION ===');
  
  // Try to get environment variables first
  let config = {
    token: '',
    apiUrl: '',
    fileUploadUrl: ''
  };

  try {
    config.token = import.meta.env.VITE_CASPIO_ACCESS_TOKEN || '';
    config.apiUrl = import.meta.env.VITE_CASPIO_API_URL || '';
    config.fileUploadUrl = import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL || '';
  } catch (error) {
    console.log('Failed to access import.meta.env:', error);
  }

  console.log('Environment config:', {
    hasEnvToken: !!config.token,
    hasEnvApiUrl: !!config.apiUrl,
    envTokenLength: config.token.length,
    envApiUrl: config.apiUrl
  });

  // If no environment variables, use hardcoded values
  if (!config.token || !config.apiUrl) {
    console.log('Using hardcoded DEBUG_CONFIG values');
    config = DEBUG_CONFIG;
  }

  console.log('Final config:', {
    hasToken: !!config.token,
    hasApiUrl: !!config.apiUrl,
    tokenStart: config.token.substring(0, 20),
    apiUrl: config.apiUrl
  });

  if (!config.token) {
    throw new Error('Caspio access token is not configured');
  }

  if (!config.apiUrl) {
    throw new Error('Caspio API URL is not configured');
  }

  try {
    // Format the data
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

    console.log('Submitting to Caspio:', {
      url: config.apiUrl,
      fieldCount: Object.keys(dataToSubmit).length,
      hasRequiredFields: !!(dataToSubmit.Name_of_Prospect && dataToSubmit.Address_of_Property)
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

    console.log('Caspio response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Caspio API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      
      throw new Error(`Caspio API error (${response.status}): ${errorText}`);
    }

    const responseData = await response.json();
    console.log('Caspio submission successful:', responseData);
    console.log('=== END DEBUG SUBMISSION ===');
    return true;

  } catch (error) {
    console.error('Error submitting to Caspio:', error);
    throw error;
  }
};
