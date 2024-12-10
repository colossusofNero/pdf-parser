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

// Helper functions
const excelDateToJSDate = (excelNumber: number): string => {
  const date = new Date((excelNumber - 25569) * 86400 * 1000);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${month}/${day}/${year}`;
};

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

// Token-related variables
let accessToken: string = ''; // Current token
let tokenExpiration: number = 0; // Token expiration timestamp
const clientId = import.meta.env.VITE_CASPIO_CLIENT_ID;
const clientSecret = import.meta.env.VITE_CASPIO_CLIENT_SECRET;
const tokenUrl = import.meta.env.VITE_CASPIO_TOKEN_URL;

// Function to fetch a new token
const fetchNewAccessToken = async (): Promise<void> => {
  if (!clientId || !clientSecret || !tokenUrl) {
    throw new Error('Client ID, Client Secret, or Token URL is not configured.');
  }

  try {
    const body = `grant_type=client_credentials&client_id=${clientId}&client_secret=${clientSecret}`;

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch token: ${response.statusText} ${errorText}`);
    }

    const data = await response.json();
    if (!data.access_token || !data.expires_in) {
      throw new Error('Token response does not include an access token or expiration time.');
    }

    accessToken = data.access_token;
    tokenExpiration = Date.now() + data.expires_in * 1000; // Convert expiration to milliseconds
    console.log('Access token fetched successfully and will expire at:', new Date(tokenExpiration));
  } catch (error) {
    console.error('Error fetching access token:', error);
    throw error;
  }
};

// Function to ensure the token is valid
const ensureValidAccessToken = async (): Promise<void> => {
  if (!accessToken || Date.now() >= tokenExpiration) {
    console.warn('Access token is missing or expired. Fetching a new token...');
    await fetchNewAccessToken();
  }
};

// Handle requests with token refresh logic
const handleRequestWithRetry = async (url: string, options: RequestInit): Promise<Response> => {
  await ensureValidAccessToken();

  let response: Response;

  try {
    const updatedOptions = {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': accessToken, // No 'Bearer' prefix
      },
    };

    response = await fetch(url, updatedOptions);

    if (response.status === 401) {
      console.warn('Access token expired during request. Fetching a new token...');
      await fetchNewAccessToken();

      const retryOptions = {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': accessToken, // No 'Bearer' prefix
        },
      };

      response = await fetch(url, retryOptions);
    }

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Request error:', error);
    throw error;
  }

  return response;
};

// File upload
export const uploadFileToCaspio = async (file: File): Promise<string> => {
  const fileUploadUrl = import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL;

  const formData = new FormData();
  formData.append('file', file);

  const response = await handleRequestWithRetry(fileUploadUrl, {
    method: 'POST',
    headers: {
      'Authorization': accessToken, // No 'Bearer' prefix
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`File upload failed: ${response.statusText} ${errorText}`);
  }

  const responseData = await response.json();
  return responseData.fileUrl || file.name;
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

// Submit data to Caspio
export const submitToCaspio = async (data: PartialExtractedData): Promise<boolean> => {
  try {
    const apiUrl = import.meta.env.VITE_CASPIO_API_URL;

    if (data.Date_of_Purchase) {
      data.Date_of_Purchase = formatDate(data.Date_of_Purchase);
    }

    if (data.CapEx_Date) {
      data.CapEx_Date = formatDate(data.CapEx_Date);
    }

    if (data.file) {
      try {
        const fileUrl = await uploadFileToCaspio(data.file);
        data.Quote_pdf = fileUrl;
      } catch (error) {
        console.error('File upload failed:', error);
        throw new Error('File upload failed during Caspio submission.');
      }
    }

    const response = await handleRequestWithRetry(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': accessToken, // No 'Bearer' prefix
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Caspio submission failed: ${response.status} ${errorText}`);
    }

    return true;
  } catch (error) {
    console.error('Error submitting to Caspio:', error);
    throw error;
  }
};
