// App.tsx - Simple version to isolate the function error
import React, { useState } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { FileUpload } from './components/FileUpload';
import { PdfDataDisplay } from './components/PdfDataDisplay';
import { Card, CardContent } from './components/ui/card';

// Define types locally to avoid import issues
interface ExtractedData {
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

interface UserData {
  firstName: string;
  lastName: string;
  Email_from_App: string;
  smsPhone?: string;
}

const App: React.FC = () => {
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Simple filename generation - no external function calls
  const createFileName = (data: ExtractedData): string => {
    const name = (data.Name_of_Prospect || 'Unknown').replace(/[<>:"/\\|?*]/g, '').trim();
    const address = (data.Address_of_Property || 'Unknown Address').replace(/[<>:"/\\|?*]/g, '').trim();
    return `RCGV_${name}_${address}.pdf`;
  };

  // Extract data from PDF using client-side parsing with CDN worker
  const extractDataFromPDF = async (file: File): Promise<ExtractedData> => {
    try {
      // Initialize PDF.js
      const pdfjsLib = await import('pdfjs-dist');
      
      // Use CDN worker instead of local file
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.js';

      console.log('PDF.js initialized with CDN worker');

      // Read file
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;

      if (pdf.numPages === 0) {
        throw new Error('The PDF file appears to be empty.');
      }

      // Extract text from first page
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();

      // Look for metadata in the text
      const fullText = textContent.items
        .map((item: any) => item.str || '')
        .join(' ');

      console.log('PDF text extracted, length:', fullText.length);
      console.log('First 500 chars:', fullText.substring(0, 500));

      // Parse the metadata row format: ||key:value||key:value||
      const metadataRegex = /\|\|([^|]+?:[^|]+?)\|\|/g;
      const matches = Array.from(fullText.matchAll(metadataRegex));
      
      console.log('Found metadata matches:', matches.length);

      const extractedData: ExtractedData = {};

      matches.forEach((match) => {
        const field = match[1];
        const parts = field.split(':');
        if (parts.length === 2) {
          const [key, value] = parts.map(s => s.trim());
          if (key && value) {
            console.log(`Parsing field: ${key} = ${value}`);
            
            // Convert to appropriate type
            if (['Purchase_Price', 'Capital_Improvements_Amount', 'Building_Value', 'Know_Land_Value', 
                 'SqFt_Building', 'Acres_Land', 'Year_Built', 'Bid_Amount_Original', 'Pay_Upfront', 
                 'Pay_50_50_Amount', 'Pay_Over_Time', 'Rush_Fee', 'Multiple_Properties_Quote', 
                 'First_Year_Bonus_Quote', 'Tax_Year'].includes(key)) {
              const numValue = parseFloat(value.replace(/[,$]/g, ''));
              if (!isNaN(numValue)) {
                (extractedData as any)[key] = numValue;
              }
            } else {
              (extractedData as any)[key] = value;
            }
          }
        }
      });

      console.log('Final extracted data:', extractedData);
      
      // Ensure we have required fields
      if (!extractedData.Name_of_Prospect || !extractedData.Address_of_Property) {
        throw new Error('Could not extract required fields (Name_of_Prospect, Address_of_Property) from PDF');
      }

      return { ...extractedData, file };

    } catch (error) {
      console.error('Client-side PDF extraction error:', error);
      throw new Error(`Failed to extract PDF data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Simple file upload - just log for now since serverless isn't working
  const uploadFile = async (file: File): Promise<void> => {
    console.log('File upload requested for:', file.name);
    // Skip actual upload since serverless endpoints aren't working
    // Just log that it would happen
  };

  // Simple submission - direct to Caspio without serverless
  const submitData = async (data: ExtractedData): Promise<void> => {
    const { file, ...dataToSubmit } = data;
    
    console.log('Direct submission to Caspio (bypassing serverless)');
    console.log('Data to submit:', dataToSubmit);

    // Get config from environment
    const token = import.meta.env.VITE_CASPIO_ACCESS_TOKEN;
    const apiUrl = import.meta.env.VITE_CASPIO_API_URL;

    if (!token || !apiUrl) {
      throw new Error('Missing Caspio configuration in environment variables');
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(dataToSubmit)
    });

    console.log('Caspio response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Caspio error:', errorText);
      throw new Error(`Caspio submission failed: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log('Caspio success response:', responseText);
  };

  const handleFileUploadAndUserData = async (
    file: File,
    userInputData: UserData
  ) => {
    setIsLoading(true);
    try {
      const extractedPdfData = await extractDataFromPDF(file);
      setExtractedData(extractedPdfData);
      setUserData(userInputData);
      setSelectedFile(file);
      toast.success('PDF data extracted successfully');
    } catch (error) {
      console.error('Error processing data:', error);
      toast.error('Failed to extract PDF data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitToCaspio = async () => {
    if (!extractedData || !userData || !selectedFile) {
      toast.error('Please upload PDF and fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      // Generate filename using extracted data
      const fileName = createFileName(extractedData);
      console.log('Generated filename:', fileName);

      // Upload file
      await uploadFile(selectedFile);

      // Prepare submission data
      const submissionData: ExtractedData = {
        ...extractedData,
        Contact_Name_First: userData.firstName.trim(),
        Contact_Name_Last: userData.lastName.trim(),
        Contact_Phone: userData.smsPhone?.trim() || '',
        Email_from_App: userData.Email_from_App.trim().toLowerCase(),
        Quote_pdf: `/${fileName}`
      };

      console.log('Submitting data:', submissionData);

      await submitData(submissionData);
      toast.success('Data successfully submitted to Caspio!');
      
      // Reset form
      setExtractedData(null);
      setUserData(null);
      setSelectedFile(null);
    } catch (error) {
      console.error('Error submitting to Caspio:', error);
      toast.error(`Failed to submit data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditData = (field: string, value: any) => {
    if (!extractedData) return;
    
    setExtractedData({
      ...extractedData,
      [field]: value
    });
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            RCG Valuation PDF Processor
          </h1>
          <p className="text-gray-600">
            Upload your cost segregation quote PDF to extract and submit data to Caspio
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {!extractedData ? (
            <Card>
              <CardContent className="p-6">
                <FileUpload 
                  onFileSelect={handleFileUploadAndUserData}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-medium text-blue-800 mb-2">File Information</h3>
                  <p className="text-sm text-blue-700">
                    <strong>Original file:</strong> {selectedFile?.name || 'Unknown'}
                  </p>
                  <p className="text-sm text-blue-700">
                    <strong>Generated Caspio filename:</strong> {createFileName(extractedData)}
                  </p>
                  <p className="text-sm text-blue-600 mt-1">
                    This filename is generated from the prospect name and property address in the PDF
                  </p>
                </div>
                
                <PdfDataDisplay 
                  data={extractedData}
                  onEdit={handleEditData}
                  onSubmit={handleSubmitToCaspio}
                  isProcessing={isLoading}
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <Toaster position="top-right" />
    </div>
  );
};

export default App;
