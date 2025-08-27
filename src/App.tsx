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

// DEBUG COMPONENT - Add this temporarily
const EnvDebugger = () => {
  const checkEnv = () => {
    console.log('=== ENVIRONMENT DEBUG ===');
    console.log('import.meta.env.DEV:', import.meta.env.DEV);
    console.log('import.meta.env.PROD:', import.meta.env.PROD);
    console.log('import.meta.env.MODE:', import.meta.env.MODE);
    
    // Check all VITE_ variables
    const allEnv = import.meta.env;
    console.log('All environment variables:', allEnv);
    
    Object.keys(allEnv).forEach(key => {
      if (key.startsWith('VITE_')) {
        console.log(`${key}:`, allEnv[key] ? `[SET - ${String(allEnv[key]).length} chars]` : '[NOT SET]');
      }
    });
    
    // Specific checks
    console.log('VITE_CASPIO_ACCESS_TOKEN:', import.meta.env.VITE_CASPIO_ACCESS_TOKEN ? 'SET' : 'NOT SET');
    console.log('VITE_CASPIO_API_URL:', import.meta.env.VITE_CASPIO_API_URL ? 'SET' : 'NOT SET');
    console.log('VITE_CASPIO_FILE_UPLOAD_URL:', import.meta.env.VITE_CASPIO_FILE_UPLOAD_URL ? 'SET' : 'NOT SET');
    
    // Show actual values (first 20 chars only for security)
    if (import.meta.env.VITE_CASPIO_ACCESS_TOKEN) {
      console.log('Token preview:', String(import.meta.env.VITE_CASPIO_ACCESS_TOKEN).substring(0, 20) + '...');
    }
    if (import.meta.env.VITE_CASPIO_API_URL) {
      console.log('API URL:', import.meta.env.VITE_CASPIO_API_URL);
    }
    
    console.log('=== END ENV DEBUG ===');
  };

  return (
    <div className="p-4 bg-yellow-100 border border-yellow-400 rounded mb-6">
      <h3 className="font-bold mb-2 text-yellow-800">🔍 Environment Debug (Remove this in production)</h3>
      <button 
        onClick={checkEnv}
        className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
      >
        Check Environment Variables
      </button>
      <p className="text-sm mt-2 text-yellow-700">
        Click the button and check the browser console for environment variable status
      </p>
    </div>
  );
};

const App: React.FC = () => {
  const [extractedData, setExtractedData] = useState<PartialExtractedData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

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
        
        {/* ADD THIS DEBUG COMPONENT TEMPORARILY */}
        <EnvDebugger />
        
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
