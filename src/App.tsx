// App.tsx - Fixed with correct filename format from PDF data
import React, { useState } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { FileUpload } from './components/FileUpload';
import { PdfDataDisplay } from './components/PdfDataDisplay';
import { 
  extractPdfData, 
  submitToCaspio,
  uploadFileToCaspio,
  type PartialExtractedData 
} from './services/api';
import { Card, CardContent } from './components/ui/card';

interface UserData {
  firstName: string;
  lastName: string;
  Email_from_App: string;
  smsPhone?: string;
}

const App: React.FC = () => {
  const [extractedData, setExtractedData] = useState<PartialExtractedData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Helper function to sanitize filename
  const sanitizeFileName = (text: string): string => {
    return text
      .replace(/[<>:"/\\|?*]/g, '') // Remove illegal filename characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  // Helper function to generate proper filename from PDF data
  const generateFileName = (extractedData: PartialExtractedData): string => {
    const prospectName = sanitizeFileName(extractedData.Name_of_Prospect || 'Unknown');
    const address = sanitizeFileName(extractedData.Address_of_Property || 'Unknown Address');
    
    return `RCGV_${prospectName}_${address}.pdf`;
  };

  const handleFileUploadAndUserData = async (
    file: File,
    userInputData: UserData
  ) => {
    setIsLoading(true);
    try {
      const extractedPdfData = await extractPdfData(file);
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
      // Generate filename using the EXTRACTED PDF data (not user input)
      const fileName = generateFileName(extractedData);
      console.log('Generated filename:', fileName);

      // First, upload the file with the correct name
      await uploadFileToCaspio(selectedFile);

      // Create submission data without the file object
      const { file, ...restExtractedData } = extractedData;
      const submissionData: PartialExtractedData = {
        ...restExtractedData,
        // Use user input for contact fields
        Contact_Name_First: userData.firstName.trim(),
        Contact_Name_Last: userData.lastName.trim(),
        Contact_Phone: userData.smsPhone?.trim() || '',
        Email_from_App: userData.Email_from_App.trim().toLowerCase(),
        // Use the filename generated from extracted PDF data
        Quote_pdf: `/${fileName}` // Include the forward slash
      };

      // Log the data being submitted to verify fields are present
      console.log('Submitting data with filename:', submissionData.Quote_pdf);
      console.log('Full submission data:', submissionData);

      await submitToCaspio(submissionData);
      toast.success('Data successfully submitted to Caspio!');
      
      // Reset form after successful submission
      setExtractedData(null);
      setUserData(null);
      setSelectedFile(null);
    } catch (error) {
      console.error('Error submitting to Caspio:', error);
      toast.error('Failed to submit data to Caspio');
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
                  onFileUpload={handleFileUploadAndUserData}
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
                    <strong>Generated Caspio filename:</strong> {generateFileName(extractedData)}
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
