// services/api.ts - Updated for Google Sheets integration
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

// Helper function to sanitize filename
const sanitizeFileName = (text: string): string => {
  return text
    .replace(/[<>:"/\\|?*]/g, '') // Remove illegal filename characters
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
};

// Helper function to generate proper filename from PDF data
export const generateFileName = (extractedData: PartialExtractedData): string => {
  const prospectName = sanitizeFileName(extractedData.Name_of_Prospect || 'Unknown');
  const address = sanitizeFileName(extractedData.Address_of_Property || 'Unknown Address');
  
  return `RCGV_${prospectName}_${address}.pdf`;
};

// Get environment config for Google Sheets
const getEnvironmentConfig = () => {
  try {
    const googleSheetsUrl = import.meta.env.VITE_GOOGLE_SHEETS_URL || '';
    const googleApiKey = import.meta.env.VITE_GOOGLE_API_KEY || '';
    const spreadsheetId = import.meta.env.VITE_GOOGLE_SPREADSHEET_ID || '';
    
    console.log('Google Sheets Environment Variables:', {
      hasGoogleSheetsUrl: !!googleSheetsUrl,
      hasGoogleApiKey: !!googleApiKey,
      hasSpreadsheetId: !!spreadsheetId,
      isDev: import.meta.env.DEV,
      isProd: import.meta.env.PROD,
      mode: import.meta.env.MODE
    });
    
    return { googleSheetsUrl, googleApiKey, spreadsheetId };
  } catch (error) {
    console.error('Failed to access environment variables:', error);
    return { googleSheetsUrl: '', googleApiKey: '', spreadsheetId: '' };
  }
};

// Date formatting helper for Google Sheets
const formatDateForGoogleSheets = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      // Google Sheets prefers MM/DD/YYYY format
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

// Upload file to Google Drive (placeholder - requires Google Drive API setup)
export const uploadFileToGoogleDrive = async (file: File): Promise<string> => {
  if (!file) {
    throw new Error('No file provided');
  }

  console.log('File upload to Google Drive not yet implemented');
  console.log('Returning filename for now:', file.name);
  
  // TODO: Implement Google Drive API integration
  // For now, just return the filename
  return file.name;
};

// Submit data to Google Sheets
export const submitToGoogleSheets = async (data: PartialExtractedData): Promise<boolean> => {
  const config = getEnvironmentConfig();

  if (!config.googleSheetsUrl && !config.spreadsheetId) {
    throw new Error('Google Sheets configuration is missing. Please set VITE_GOOGLE_SHEETS_URL or VITE_GOOGLE_SPREADSHEET_ID');
  }

  try {
    console.log('Preparing data for Google Sheets submission...');

    // Format dates for Google Sheets
    const formattedData = {
      ...data,
      Date_of_Purchase: data.Date_of_Purchase ? formatDateForGoogleSheets(data.Date_of_Purchase) : '',
      CapEx_Date: data.CapEx_Date ? formatDateForGoogleSheets(data.CapEx_Date) : '',
    };

    // Remove file and undefined values
    const { file, ...dataToSubmit } = formattedData;
    Object.keys(dataToSubmit).forEach(key => {
      if (dataToSubmit[key as keyof typeof dataToSubmit] === undefined) {
        delete dataToSubmit[key as keyof typeof dataToSubmit];
      }
    });

    console.log('Submitting to Google Sheets:', dataToSubmit);

    // Convert data to array format for Google Sheets API
    const rowData = [
      dataToSubmit.Name_of_Prospect || '',
      dataToSubmit.Address_of_Property || '',
      dataToSubmit.Zip_Code || '',
      dataToSubmit.Purchase_Price || 0,
      dataToSubmit.Capital_Improvements_Amount || 0,
      dataToSubmit.Building_Value || 0,
      dataToSubmit.Know_Land_Value || 0,
      dataToSubmit.Date_of_Purchase || '',
      dataToSubmit.SqFt_Building || 0,
      dataToSubmit.Acres_Land || 0,
      dataToSubmit.Year_Built || 0,
      dataToSubmit.Bid_Amount_Original || 0,
      dataToSubmit.Pay_Upfront || 0,
      dataToSubmit.Pay_50_50_Amount || 0,
      dataToSubmit.Pay_Over_Time || 0,
      dataToSubmit.Rush_Fee || 0,
      dataToSubmit.Multiple_Properties_Quote || 0,
      dataToSubmit.First_Year_Bonus_Quote || 0,
      dataToSubmit.Tax_Year || 0,
      dataToSubmit.Tax_Deadline_Quote || '',
      dataToSubmit.Contact_Name_First || '',
      dataToSubmit.Contact_Name_Last || '',
      dataToSubmit.Contact_Phone || '',
      dataToSubmit.Email_from_App || '',
      dataToSubmit.Quote_pdf || '',
      dataToSubmit.CapEx_Date || '',
      dataToSubmit.Type_of_Property_Quote || ''
    ];

    let response;

    if (config.googleSheetsUrl) {
      // Use Google Apps Script Web App URL
      console.log('Using Google Apps Script Web App URL');
      response = await fetch(config.googleSheetsUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [rowData] })
      });
    } else if (config.googleApiKey && config.spreadsheetId) {
      // Use Google Sheets API directly
      console.log('Using Google Sheets API directly');
      const sheetsApiUrl = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/Sheet1:append?valueInputOption=RAW&key=${config.googleApiKey}`;
      
      response = await fetch(sheetsApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          values: [rowData]
        })
      });
    } else {
      throw new Error('No valid Google Sheets configuration found');
    }

    console.log('Google Sheets response details:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      headers: Object.fromEntries(response.headers.entries())
    });

    const responseText = await response.text();
    console.log('Google Sheets raw response:', responseText);

    if (!response.ok) {
      console.error('Google Sheets API error:', {
        status: response.status,
        statusText: response.statusText,
        body: responseText
      });
      
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      if (responseText) {
        try {
          const errorJson = JSON.parse(responseText);
          errorMessage = errorJson.error?.message || errorJson.message || errorMessage;
        } catch (e) {
          errorMessage = responseText || errorMessage;
        }
      }
      
      throw new Error(`Google Sheets API error: ${errorMessage}`);
    }

    // Parse response
    let responseData;
    if (responseText.trim() === '') {
      console.log('Empty response from Google Sheets - assuming success');
      responseData = { success: true };
    } else {
      try {
        responseData = JSON.parse(responseText);
        console.log('Google Sheets submission successful:', responseData);
      } catch (parseError) {
        console.log('Non-JSON response from Google Sheets, assuming success');
        responseData = { success: true, rawResponse: responseText };
      }
    }

    return true;

  } catch (error) {
    console.error('Error submitting to Google Sheets:', error);
    throw error;
  }
};