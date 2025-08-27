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

// Date formatting
const formatDate = (dateString?: string): string => {
  if (!dateString) return '';
  try {
    if (/^\d+$/.test(dateString)) {
      const excelNumber = parseInt(dateString);
      const date = new Date((excelNumber - 25569) * 86400 * 1000);
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }
    const parts = dateString.split('/');
    if (parts.length === 3) {
      const month = parts[0].padStart(2, '0');
      const day = parts[1].padStart(2, '0');
      const year = parts[2];
      return `${month}/${day}/${year}`;
    }
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }
    throw new Error('Unsupported date format');
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
    const extractedData = await parsePDF(file);
    return { ...extractedData, file, Quote_pdf: file.name };
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw error;
  }
};

// File upload function
export const uploadFileToCaspio = async (file: File): Promise<string> => {
  console.log('File upload requested for:', file.name);
  return file.name;
};

// Submit data to Caspio with comprehensive diagnostic logging
export const submitToCaspio = async (data: PartialExtractedData): Promise<boolean> => {
  const config = {
    token: import.meta.env.VITE_CASPIO_ACCESS_TOKEN,
    apiUrl: import.meta.env.VITE_CASPIO_API_URL,
    fileUploadUrl: import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL
  };

  console.log('🔍 CASPIO DIAGNOSTIC START');
  console.log('📋 Environment Configuration:', {
    hasToken: !!config.token,
    tokenLength: config.token?.length || 0,
    tokenStart: config.token?.substring(0, 15) || 'MISSING',
    tokenEnd: config.token?.substring(-10) || 'MISSING',
    apiUrl: config.apiUrl || 'MISSING',
    timestamp: new Date().toISOString()
  });

  if (!config.token) {
    throw new Error('❌ Caspio access token is not configured');
  }

  if (!config.apiUrl) {
    throw new Error('❌ Caspio API URL is not configured');
  }

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

    console.log('📦 Submission Data Analysis:', {
      totalFields: Object.keys(dataToSubmit).length,
      requiredFields: {
        Name_of_Prospect: dataToSubmit.Name_of_Prospect || 'MISSING',
        Address_of_Property: dataToSubmit.Address_of_Property || 'MISSING',
        Purchase_Price: dataToSubmit.Purchase_Price || 'MISSING',
        Email_from_App: dataToSubmit.Email_from_App || 'MISSING'
      },
      payloadSize: JSON.stringify(dataToSubmit).length
    });

    console.log('📋 FULL PAYLOAD TO CASPIO:');
    console.log(JSON.stringify(dataToSubmit, null, 2));

    // Make the request with detailed logging
    console.log('🌐 Making request to:', config.apiUrl);
    
    const startTime = Date.now();
    const response = await fetch(config.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dataToSubmit)
    });
    const endTime = Date.now();

    console.log('📡 CASPIO RESPONSE ANALYSIS:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      redirected: response.redirected,
      type: response.type,
      url: response.url,
      requestDuration: `${endTime - startTime}ms`,
      timestamp: new Date().toISOString()
    });

    console.log('📋 RESPONSE HEADERS:');
    response.headers.forEach((value, name) => {
      console.log(`  ${name}: ${value}`);
    });

    // Get response body with detailed analysis
    const responseText = await response.text();
    
    console.log('📄 RESPONSE BODY ANALYSIS:', {
      contentLength: responseText.length,
      isEmpty: responseText.trim() === '',
      firstChars: responseText.substring(0, 100),
      containsJSON: responseText.trim().startsWith('{') || responseText.trim().startsWith('['),
      containsHTML: responseText.includes('<html>') || responseText.includes('<body>'),
      containsError: responseText.toLowerCase().includes('error')
    });

    console.log('📋 FULL RESPONSE BODY:');
    console.log(responseText || '(EMPTY)');

    // Analyze the response
    if (!response.ok) {
      console.error('❌ CASPIO REJECTION - Request was not successful');
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      
      if (responseText) {
        try {
          const errorJson = JSON.parse(responseText);
          errorMessage = errorJson.message || errorJson.error || errorMessage;
          console.log('📋 PARSED ERROR:', errorJson);
        } catch (e) {
          console.log('📋 ERROR RESPONSE NOT JSON');
          errorMessage = responseText;
        }
      }
      
      throw new Error(`Caspio API rejected request: ${errorMessage}`);
    }

    // Handle successful but empty response
    if (responseText.trim() === '') {
      console.log('⚠️  EMPTY SUCCESS RESPONSE - This might indicate an issue');
      console.log('🔍 POTENTIAL CAUSES:');
      console.log('  1. Authentication succeeded but write failed silently');
      console.log('  2. Data format was rejected but no error was returned');
      console.log('  3. Required fields are missing');
      console.log('  4. Token has read-only permissions');
      
      // For diagnostic purposes, let's NOT assume this is success
      throw new Error('Caspio returned empty response - data may not have been saved. Check Caspio directly.');
    }

    // Try to parse successful response
    try {
      const responseData = JSON.parse(responseText);
      console.log('✅ CASPIO SUCCESS - Data parsed:', responseData);
      
      // Check if the response indicates actual success
      if (responseData.Result && Array.isArray(responseData.Result)) {
        console.log(`✅ SUCCESS CONFIRMED - ${responseData.Result.length} record(s) created`);
        return true;
      } else if (responseData.success || responseData.Success) {
        console.log('✅ SUCCESS CONFIRMED - Success flag present');
        return true;
      } else {
        console.log('⚠️  SUCCESS UNCLEAR - Response format unexpected');
        console.log('📋 Response data:', responseData);
        return true; // Assume success if we got valid JSON
      }
    } catch (parseError) {
      console.log('✅ SUCCESS - Non-JSON response but HTTP 200');
      console.log('📋 Response was:', responseText);
      return true;
    }

  } catch (error) {
    console.error('💥 CASPIO SUBMISSION FAILED');
    console.error('📋 Error details:', error);
    console.log('🔍 DIAGNOSTIC COMPLETE - CHECK LOGS ABOVE');
    throw error;
  }
};
