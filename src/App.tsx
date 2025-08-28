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

  // Simple PDF extraction using serverless
  const extractDataFromPDF = async (file: File): Promise<ExtractedData> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/extract-pdf', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`PDF extraction failed: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const result = await response.json();
    return { ...result.data, file };
  };

  // Simple file upload
  const uploadFile = async (file: File): Promise<void> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/upload-file', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`File upload failed: ${response.status} - ${errorData}`);
    }
  };

  // Simple submission
  const submitData = async (data: ExtractedData): Promise<void> => {
    const { file, ...dataToSubmit } = data;
    
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
