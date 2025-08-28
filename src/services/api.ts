// services/api.ts - Clean version without complex imports
export interface ExtractedData {
  Name_of_Prospect?: string;
  Address_of_Property?: string;
  Zip_Code?: string;
  Purchase_Price?: number;
  Capital_Improvements_Amount?: number;
  Building_Value?: number;
  Know_Land_Value?: number;
  Date_of_Purchase?: string;
  SqFt_Building?: number;
  Acres_Land?: number;
  Year_Built?: number;
  Bid_Amount_Original?: number;
  Pay_Upfront?: number;
  Pay_50_50_Amount?: number;
  Pay_Over_Time?: number;
  Rush_Fee?: number;
  Multiple_Properties_Quote?: number;
  First_Year_Bonus_Quote?: number;
  Tax_Year?: number;
  Tax_Deadline_Quote?: string;
  Contact_Name_First?: string;
  Contact_Name_Last?: string;
  Contact_Phone?: string;
  Email_from_App?: string;
  Quote_pdf?: string;
  CapEx_Date?: string;
  Type_of_Property_Quote?: string;
  file?: File;
}

export type PartialExtractedData = Partial<ExtractedData>;

// Date formatting helper
const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  
  // Remove the "=" prefix if it exists
  const cleanedString = dateString.replace('=', '');
  
  try {
    // Parse the date and format it as MM/DD/YYYY for Caspio
    const date = new Date(cleanedString);
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

// File upload function using serverless endpoint
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

// Record submission function using serverless endpoint
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
