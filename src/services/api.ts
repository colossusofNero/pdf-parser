// services/api.ts - Minimal working version without PDF imports
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

// Extract data from PDF using serverless endpoint
export const extractPdfData = async (file: File): Promise<PartialExtractedData> => {
  if (!file) {
    throw new Error('No file provided');
  }

  try {
    console.log('Extracting data from PDF via serverless:', file.name);
    
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
    throw error;
  }
};

// Simple file upload function
export const uploadFileToCaspio = async (file: File): Promise<string> => {
  console.log('File upload requested for:', file.name);
  // For now, just return the filename - actual upload handled by serverless
  return file.name;
};

// Submit data to Caspio
export const submitToCaspio = async (data: PartialExtractedData): Promise<boolean> => {
  try {
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

    console.log('Submitting data:', dataToSubmit);

    // Use serverless endpoint
    const response = await fetch('/api/submit-to-caspio', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dataToSubmit)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Submission failed: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const responseData = await response.json();
    console.log('Submission successful:', responseData);
    return true;
  } catch (error) {
    console.error('Error submitting to Caspio:', error);
    throw error;
  }
};
