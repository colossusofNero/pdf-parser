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

// Retry mechanism for failed requests
const retryWithBackoff = async (
  fn: () => Promise<any>, 
  maxRetries: number = 3, 
  baseDelay: number = 1000
): Promise<any> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      
      const delay = baseDelay * Math.pow(2, attempt - 1);
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`, error);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

// Robust environment configuration with validation
const getEnvironmentConfig = () => {
  const config = {
    token: import.meta.env.VITE_CASPIO_ACCESS_TOKEN || '',
    apiUrl: import.meta.env.VITE_CASPIO_API_URL || '',
    fileUploadUrl: import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL || ''
  };

  // Validation
  const errors = [];
  if (!config.token) errors.push('VITE_CASPIO_ACCESS_TOKEN');
  if (!config.apiUrl) errors.push('VITE_CASPIO_API_URL');
  if (!config.fileUploadUrl) errors.push('VITE_CASPIO_FILE_UPLOAD_URL');

  if (errors.length > 0) {
    console.error('Missing environment variables:', errors);
    console.log('Available env vars:', Object.keys(import.meta.env).filter(k => k.startsWith('VITE_CASPIO')));
  }

  console.log('🔧 Environment Configuration:', {
    hasToken: !!config.token,
    tokenLength: config.token.length,
    tokenPreview: config.token ? config.token.substring(0, 10) + '...' : 'MISSING',
    apiUrl: config.apiUrl || 'MISSING',
    fileUploadUrl: config.fileUploadUrl || 'MISSING',
    mode: import.meta.env.MODE,
    timestamp: new Date().toISOString()
  });

  return config;
};

// Robust date formatting with multiple format support
const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  
  try {
    // Handle Excel serial numbers
    if (/^\d+$/.test(dateString)) {
      const excelNumber = parseInt(dateString);
      const date = new Date((excelNumber - 25569) * 86400 * 1000);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }

    // Handle MM/DD/YYYY format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
      const parts = dateString.split('/');
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${month}/${day}/${year}`;
    }

    // Handle ISO dates and other formats
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }

    console.warn('Unsupported date format:', dateString);
    return dateString; // Return as-is if we can't parse it
  } catch (error) {
    console.error('Date formatting error for:', dateString, error);
    return dateString; // Return original value on error
  }
};

// Validate extracted data
const validateExtractedData = (data: PartialExtractedData): string[] => {
  const errors = [];
  
  // Required fields validation
  const requiredFields = ['Name_of_Prospect', 'Address_of_Property', 'Purchase_Price'];
  requiredFields.forEach(field => {
    if (!data[field as keyof PartialExtractedData]) {
      errors.push(`Missing required field: ${field}`);
    }
  });

  // Data type validation
  const numericFields = ['Purchase_Price', 'Capital_Improvements_Amount', 'Building_Value'];
  numericFields.forEach(field => {
    const value = data[field as keyof PartialExtractedData];
    if (value !== undefined && (isNaN(Number(value)) || Number(value) < 0)) {
      errors.push(`Invalid numeric value for ${field}: ${value}`);
    }
  });

  return errors;
};

// Extract data from PDF with enhanced error handling
export const extractPdfData = async (file: File): Promise<PartialExtractedData> => {
  if (!file) {
    throw new Error('No file provided');
  }

  if (!file.type.includes('pdf')) {
    throw new Error('File must be a PDF');
  }

  if (file.size > 10 * 1024 * 1024) { // 10MB limit
    throw new Error('File size must be less than 10MB');
  }

  try {
    console.log('📄 Starting PDF extraction:', {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      timestamp: new Date().toISOString()
    });

    const extractedData = await retryWithBackoff(
      () => parsePDF(file),
      2, // Max 2 retries for PDF parsing
      1000 // 1 second base delay
    );

    // Validate extracted data
    const validationErrors = validateExtractedData(extractedData);
    if (validationErrors.length > 0) {
      console.warn('⚠️ Data validation warnings:', validationErrors);
      // Don't fail completely, just warn
    }

    console.log('✅ PDF extraction successful:', {
      fieldsExtracted: Object.keys(extractedData).length,
      hasRequiredFields: !!(extractedData.Name_of_Prospect && extractedData.Address_of_Property),
      timestamp: new Date().toISOString()
    });

    return { ...extractedData, file, Quote_pdf: file.name };
  } catch (error) {
    console.error('❌ PDF extraction failed:', error);
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Robust file upload with multiple fallback strategies
export const uploadFileToCaspio = async (file: File): Promise<string> => {
  console.log('📤 Starting file upload:', {
    fileName: file.name,
    fileSize: file.size,
    timestamp: new Date().toISOString()
  });

  const config = getEnvironmentConfig();
  
  if (!config.fileUploadUrl || !config.token) {
    console.log('⚠️ File upload not configured, using filename only');
    return file.name;
  }

  try {
    const uploadResult = await retryWithBackoff(async () => {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(config.fileUploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Accept': 'application/json'
        },
        body: formData
      });

      console.log('📡 Upload response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
      }

      const responseText = await response.text();
      
      if (responseText.trim()) {
        try {
          const responseData = JSON.parse(responseText);
          return responseData.fileUrl || responseData.data?.fileUrl || file.name;
        } catch (e) {
          console.log('Upload response not JSON, using filename');
          return file.name;
        }
      }

      return file.name;
    }, 3, 2000); // 3 retries, 2 second base delay

    console.log('✅ File upload successful:', uploadResult);
    return uploadResult;

  } catch (error) {
    console.error('⚠️ File upload failed, continuing with filename:', error);
    return file.name; // Don't fail the entire process
  }
};

// Production-ready Caspio submission with comprehensive error handling
export const submitToCaspio = async (data: PartialExtractedData): Promise<boolean> => {
  const config = getEnvironmentConfig();
  const submissionId = Date.now().toString(36); // Unique ID for this submission

  console.log(`🚀 Starting Caspio submission [${submissionId}]:`, {
    timestamp: new Date().toISOString(),
    fieldCount: Object.keys(data).length,
    hasFile: !!data.file
  });

  if (!config.token) {
    throw new Error('❌ Caspio access token is not configured. Please check environment variables.');
  }

  if (!config.apiUrl) {
    throw new Error('❌ Caspio API URL is not configured. Please check environment variables.');
  }

  try {
    // Handle file upload first if needed
    let fileUrl = data.Quote_pdf || '';
    if (data.file && (!fileUrl || fileUrl === data.file.name)) {
      try {
        fileUrl = await uploadFileToCaspio(data.file);
        console.log(`📎 File upload completed [${submissionId}]:`, fileUrl);
      } catch (uploadError) {
        console.warn(`⚠️ File upload failed [${submissionId}], continuing without file:`, uploadError);
        fileUrl = data.file.name; // Use filename as fallback
      }
    }

    // Format and clean data
    const formattedData = {
      ...data,
      Date_of_Purchase: data.Date_of_Purchase ? formatDate(data.Date_of_Purchase) : undefined,
      CapEx_Date: data.CapEx_Date ? formatDate(data.CapEx_Date) : undefined,
      Quote_pdf: fileUrl
    };

    // Remove file object and undefined values
    const { file, ...dataToSubmit } = formattedData;
    Object.keys(dataToSubmit).forEach(key => {
      const value = dataToSubmit[key as keyof typeof dataToSubmit];
      if (value === undefined || value === null || value === '') {
        delete dataToSubmit[key as keyof typeof dataToSubmit];
      }
    });

    // Final validation
    const validationErrors = validateExtractedData(dataToSubmit);
    if (validationErrors.length > 0) {
      console.warn(`⚠️ Validation warnings [${submissionId}]:`, validationErrors);
    }

    console.log(`📦 Prepared submission data [${submissionId}]:`, {
      fieldCount: Object.keys(dataToSubmit).length,
      hasRequiredFields: !!(dataToSubmit.Name_of_Prospect && dataToSubmit.Address_of_Property),
      payloadSize: JSON.stringify(dataToSubmit).length
    });

    // Submit to Caspio with retry logic
    const result = await retryWithBackoff(async () => {
      const response = await fetch(config.apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
          // Removed X-Submission-ID - Caspio doesn't allow custom headers
        },
        body: JSON.stringify(dataToSubmit)
      });

      console.log(`📡 Caspio response [${submissionId}]:`, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        headers: Object.fromEntries(response.headers.entries())
      });

      // Get response body
      const responseText = await response.text();
      console.log(`📄 Response body [${submissionId}]:`, {
        length: responseText.length,
        content: responseText || '(empty)'
      });

      if (!response.ok) {
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

      // Handle successful response
      if (responseText.trim() === '') {
        console.log(`✅ Empty response indicates success [${submissionId}]`);
        return { success: true, message: 'Empty response (success)' };
      }

      try {
        const responseData = JSON.parse(responseText);
        console.log(`✅ Submission successful [${submissionId}]:`, responseData);
        return responseData;
      } catch (parseError) {
        console.log(`✅ Non-JSON success response [${submissionId}]:`, responseText);
        return { success: true, rawResponse: responseText };
      }
    }, 3, 2000); // 3 retries, 2 second base delay

    console.log(`🎉 Caspio submission completed successfully [${submissionId}]`);
    return true;

  } catch (error) {
    console.error(`💥 Caspio submission failed [${submissionId}]:`, error);
    throw error;
  }
};
