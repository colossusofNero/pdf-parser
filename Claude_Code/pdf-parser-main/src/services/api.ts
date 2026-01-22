import { ExtractedData } from '../types';

export type PartialExtractedData = Partial<ExtractedData>;

// Updated helper function to format dates correctly
const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  
  // Remove the "=" prefix if it exists
  dateString = dateString.replace('=', '');
  
  try {
    // Parse the date and format it as MM/DD/YYYY
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateString);
      return '';
    }
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}/${date.getFullYear()}`;
  } catch (error) {
    console.error('Error formatting date:', error);
    return '';
  }
};

// Helper function to format API submission data
const formatApiData = (parsedData: PartialExtractedData): PartialExtractedData => {
  const formatted: PartialExtractedData = {
    ...parsedData,
    Date_of_Purchase: parsedData.Date_of_Purchase ? formatDate(parsedData.Date_of_Purchase) : '',
    CapEx_Date: parsedData.CapEx_Date ? formatDate(parsedData.CapEx_Date) : ''
  };

  return formatted;
};

// New Google Sheets submission function
export const submitToGoogleSheets = async (data: PartialExtractedData): Promise<boolean> => {
  try {
    // Create a new object without the file property and format the data
    const { file, ...submitData } = formatApiData(data);

    console.log('Submitting data to Google Sheets');

    const response = await fetch('/api/submit-to-google-sheets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submitData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google Sheets submission failed: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const responseData = await response.json();
    console.log('Google Sheets submission success:', responseData);
    return true;
  } catch (error) {
    console.error('Error submitting to Google Sheets:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown Google Sheets submission error');
  }
};

// Supabase submission function
export const submitToSupabase = async (data: PartialExtractedData): Promise<boolean> => {
  try {
    // Create a new object without the file property and format the data
    const { file, ...submitData } = formatApiData(data);

    console.log('Submitting data to Supabase');

    const response = await fetch('/api/submit-to-supabase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submitData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Supabase submission failed: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const responseData = await response.json();
    console.log('Supabase submission success:', responseData);
    return true;
  } catch (error) {
    console.error('Error submitting to Supabase:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown Supabase submission error');
  }
};

// File upload function using serverless endpoint (keeping Caspio for file storage)
export const uploadFileToCaspio = async (file: File): Promise<string> => {
  if (!file) {
    throw new Error('No file provided');
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    console.log('Uploading file to serverless endpoint');
    
    const response = await fetch('/api/upload-file', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`File upload failed: ${response.status} - ${errorData}`);
    }

    const responseData = await response.json();
    console.log('File upload response:', responseData);
    
    return responseData.data.fileUrl || '';
  } catch (error) {
    console.error('Error uploading file:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown upload error');
  }
};

// Keep original Caspio submission function as backup
export const submitToCaspio = async (data: PartialExtractedData): Promise<boolean> => {
  try {
    // Create a new object without the file property and format the data
    const { file, ...submitData } = formatApiData(data);
    
    console.log('Submitting data to serverless endpoint');
    
    const response = await fetch('/api/submit-to-caspio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(submitData)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Submission failed: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const responseData = await response.json();
    console.log('Submission success response:', responseData);
    return true;
  } catch (error) {
    console.error('Error submitting data:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown submission error');
  }
};

// PDF data extraction function using serverless endpoint
export const extractPdfData = async (file: File): Promise<PartialExtractedData> => {
  if (!file) {
    throw new Error('No file provided');
  }

  try {
    // Create form data with the file
    const formData = new FormData();
    formData.append('file', file);

    // Send to serverless endpoint
    const response = await fetch('/api/extract-pdf', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`PDF extraction failed: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return {
      ...result.data,
      file
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(error instanceof Error ? error.message : 'Unknown extraction error');
  }
};
