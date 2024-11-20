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
  Email: string;
  Quote_PDF: string; // Changed to string since it's just the filename
  file?: File;  // Separate property for the actual file
}

export type PartialExtractedData = Partial<ExtractedData>;

interface CaspioFileResponse {
  FileName: string;
  FileSize: number;
  ContentType: string;
}

interface ErrorResponse {
  Code: string;
  Message: string;
  Resource: string;
  RequestId: string;
}

export const extractPdfData = async (file: File): Promise<PartialExtractedData> => {
  if (!file) {
    throw new Error('No file provided');
  }

  try {
    const extractedData = await parsePDF(file);
    if (!extractedData) {
      throw new Error('Failed to extract data from PDF');
    }
    return {
      ...extractedData,
      file: file,  // Store the file separately
      Quote_PDF: formatFileName(file.name)  // Store the formatted filename
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to extract PDF data');
  }
};

// Helper function to format file names
const formatFileName = (fileName: string): string => {
  const name = fileName.toLowerCase();
  if (!name.startsWith('/')) {
    fileName = '/' + fileName;
  }
  if (!name.endsWith('.pdf')) {
    fileName = fileName + '.pdf';
  }
  return fileName;
};

const uploadFileToCaspio = async (file: File): Promise<string> => {
  const fileUploadUrl = import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL;
  const apiKey = import.meta.env.VITE_CASPIO_API_KEY;

  const formData = new FormData();
  formData.append('file', file);

  try {
    console.log('Attempting to upload file:', file.name);
    
    const response = await fetch(fileUploadUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
      body: formData,
    });

    // Log the raw response
    const responseText = await response.text();
    console.log('Raw response:', responseText);

    // Check if the response is empty
    if (!responseText) {
      // If no error and no response, assume success with original filename
      console.log('Empty response, using original filename');
      return file.name;
    }

    try {
      // Try to parse the response as JSON
      const responseData = JSON.parse(responseText) as CaspioFileResponse;
      
      if (!response.ok) {
        const errorData = responseData as unknown as ErrorResponse;
        throw new Error(`Caspio File Upload Error: ${errorData.Message || response.statusText}`);
      }

      if (!responseData || !responseData.FileName) {
        console.log('No filename in response, using original filename');
        return file.name;
      }

      console.log('File upload response:', responseData);
      return responseData.FileName;

    } catch (parseError) {
      console.error('Error parsing response:', parseError);
      // If we can't parse the response but the request was successful,
      // fall back to the original filename
      if (response.ok) {
        console.log('Response parse error, using original filename');
        return file.name;
      }
      throw new Error('Failed to parse server response');
    }

  } catch (error) {
    console.error('File Upload Error:', error);
    throw error;
  }
};

export const submitToCaspio = async (data: PartialExtractedData): Promise<boolean> => {
  const apiUrl = import.meta.env.VITE_CASPIO_API_URL;
  const apiKey = import.meta.env.VITE_CASPIO_API_KEY;

  try {
    // First, handle file upload if present
    if (data.file) {
      try {
        await uploadFileToCaspio(data.file);
        // We continue using our formatted filename regardless of upload response
      } catch (uploadError) {
        console.error('File upload error:', uploadError);
        // Continue with submission even if file upload fails
      }
    }

    const mappedData = {
      Name_of_Prospect: data.Name_of_Prospect?.trim(),
      Address_of_Property: data.Address_of_Property?.trim(),
      Zip_Code: data.Zip_Code?.trim(),
      Purchase_Price: data.Purchase_Price ?? 0,
      Capital_Improvements_Amount: data.Capital_Improvements_Amount ?? 0,
      Building_Value: data.Building_Value ?? 0,
      Know_Land_Value: data.Know_Land_Value ?? 0,
      Date_of_Purchase: data.Date_of_Purchase?.trim(),
      SqFt_Building: data.SqFt_Building ?? 0,
      Acres_Land: data.Acres_Land ?? 0,
      Year_Built: data.Year_Built ?? 0,
      Bid_Amount_Original: data.Bid_Amount_Original ?? 0,
      Pay_Upfront: data.Pay_Upfront ?? 0,
      Pay_50_50_Amount: data.Pay_50_50_Amount ?? 0,
      Pay_Over_Time: data.Pay_Over_Time ?? 0,
      Rush_Fee: data.Rush_Fee ?? 0,
      Multiple_Properties_Quote: data.Multiple_Properties_Quote ?? 0,
      First_Year_Bonus_Quote: data.First_Year_Bonus_Quote ?? 0,
      Tax_Year: data.Tax_Year ?? 0,
      Tax_Deadline_Quote: data.Tax_Deadline_Quote?.trim(),
      Contact_Name_First: data.Contact_Name_First?.trim(),
      Contact_Name_Last: data.Contact_Name_Last?.trim(),
      Contact_Phone: data.Contact_Phone?.trim(),
      Email: data.Email?.trim().toLowerCase(),
      Quote_PDF: data.Quote_PDF // Use the formatted filename we created earlier
    };

    console.log('Sending data to Caspio:', JSON.stringify(mappedData, null, 2));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(mappedData),
    });

    if (!response.ok) {
      const errorData = await response.json() as ErrorResponse;
      throw new Error(`Caspio Data Submission Error: ${errorData.Message || response.statusText}`);
    }

    console.log('Data successfully submitted to Caspio');
    return true;
  } catch (error) {
    console.error('Submission Error:', error);
    throw error;
  }
};