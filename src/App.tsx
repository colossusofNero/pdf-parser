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

  // DEBUG FUNCTION - Add this temporarily
  const debugEnvironment = () => {
    console.log('=== ENVIRONMENT DEBUG ===');
    console.log('Environment mode:', import.meta.env.MODE);
    console.log('Is production:', import.meta.env.PROD);
    console.log('Is development:', import.meta.env.DEV);
    
    // Check specific variables
    const token = import.meta.env.VITE_CASPIO_ACCESS_TOKEN;
    const apiUrl = import.meta.env.VITE_CASPIO_API_URL;
    const fileUrl = import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL;
    
    console.log('VITE_CASPIO_ACCESS_TOKEN:', token ? `SET (${token.length} chars)` : 'NOT SET');
    console.log('VITE_CASPIO_API_URL:', apiUrl ? `SET (${apiUrl})` : 'NOT SET');
    console.log('VITE_CASPIO_FILE_UPLOAD_URL:', fileUrl ? `SET (${fileUrl})` : 'NOT SET');
    
    if (token) {
      console.log('Token preview:', token.substring(0, 20) + '...');
    }
    
    console.log('All env keys:', Object.keys(import.meta.env));
    console.log('=== END ENV DEBUG ===');
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
      // Debug environment before submission
      debugEnvironment();

      // First, upload the file
      const fileName = `RCGV_${userData.firstName} ${userData.lastName}_${extractedData.Address_of_Property}.pdf`;
      await uploadFileToCaspio(selectedFile);

      // Create submission data without the file object
      const { file, ...restExtractedData } = extractedData;
      const submissionData: PartialExtractedData = {
        ...restExtractedData,
        Contact_Name_First: userData.firstName.trim(),
        Contact_Name_Last: userData.lastName.trim(),
        Contact_Phone: userData.smsPhone?.trim() || '',
        Email_from_App: userData.Email_from_App.trim().toLowerCase(),
        Quote_pdf: `/${fileName}` // Include the forward slash
      };

      // Log the data being submitted to verify fields are present
      console.log('Submitting data:', submissionData);

      await submitToCaspio(submissionData);
      toast.success('Data successfully submitted to Caspio!');
      
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
        
        {/* TEMPORARY DEBUG SECTION */}
        <div className="max-w-4xl mx-auto mb-6">
          <div className="p-4 bg-yellow-100 border border-yellow-400 rounded">
            <h3 className="font-bold mb-2 text-yellow-800">🔍 Debug Panel (Remove in production)</h3>
            <button 
              onClick={debugEnvironment}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 mr-2"
            >
              Check Environment
            </button>
            <p className="text-sm mt-2 text-yellow-700">
              Click button → Open browser console (F12) → Check environment variables
            </p>
          </div>
        </div>
        
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
