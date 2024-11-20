import React, { useState } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { FileUpload } from './components/FileUpload';
import { PdfDataDisplay } from './components/PdfDataDisplay';
import { 
  extractPdfData, 
  submitToCaspio, 
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

  // Add the formatFileName function inside the component
  const formatFileName = (fileName: string): string => {
    let formattedName = fileName;
    if (!formattedName.startsWith('/')) {
      formattedName = '/' + formattedName;
    }
    if (!formattedName.endsWith('.pdf')) {
      formattedName = formattedName + '.pdf';
    }
    return formattedName;
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
      // Prepare data for submission
      const submissionData: PartialExtractedData = {
        ...extractedData,
        Contact_Name_First: userData.firstName.trim(),
        Contact_Name_Last: userData.lastName.trim(),
        Contact_Phone: userData.smsPhone?.trim() || '',
        Email_from_App: userData.Email_from_App.trim().toLowerCase(),
        file: selectedFile,
        Quote_pdf: formatFileName(selectedFile.name) // Changed from Quote_PDF
      };
  
      // Submit to Caspio
      await submitToCaspio(submissionData);
      toast.success('Data successfully submitted to Caspio!');
  
      // Reset state after successful submission
      setExtractedData(null);
      setUserData(null);
      setSelectedFile(null);
    } catch (error) {
      console.error('Submission error:', error);
      if (error instanceof Error) {
        toast.error(`Failed to submit: ${error.message}`);
      } else {
        toast.error('Failed to submit to Caspio');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster position="top-right" />
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-center mb-8">PDF Data Extractor</h1>

        <div className="max-w-4xl mx-auto space-y-6">
          {!extractedData && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">Upload PDF & Enter Information</h2>
                <FileUpload 
                  onFileSelect={handleFileUploadAndUserData}
                  isLoading={isLoading}
                />
              </CardContent>
            </Card>
          )}

          {extractedData && (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Extracted Data</h2>
                  <PdfDataDisplay data={extractedData} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <button
                    onClick={handleSubmitToCaspio}
                    disabled={isLoading}
                    className="w-full bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
                  >
                    {isLoading ? 'Submitting...' : 'Submit to Caspio'}
                  </button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;