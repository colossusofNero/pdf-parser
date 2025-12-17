import React, { useState } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { FileUpload } from './components/FileUpload';
import { PdfDataDisplay } from './components/PdfDataDisplay';
import { 
  extractPdfData, 
  submitToGoogleSheets,  // Changed from submitToCaspio
  uploadFileToCaspio,     // Keep for file storage
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

  const handleSubmitToGoogleSheets = async () => {
    if (!extractedData || !userData || !selectedFile) {
      toast.error('Please upload PDF and fill in all required fields');
      return;
    }

    setIsLoading(true);
    try {
      // Optional: First upload the file (keeping Caspio for file storage)
      let fileUrl = '';
      try {
        const fileName = `RCGV_${userData.firstName} ${userData.lastName}_${extractedData.Address_of_Property}.pdf`;
        await uploadFileToCaspio(selectedFile);
        fileUrl = `/${fileName}`;
      } catch (fileError) {
        console.warn('File upload failed, continuing with data submission:', fileError);
        // Continue with data submission even if file upload fails
      }

      // Create submission data without the file object
      const { file, ...restExtractedData } = extractedData;
      const submissionData: PartialExtractedData = {
        ...restExtractedData,
        Contact_Name_First: userData.firstName.trim(),
        Contact_Name_Last: userData.lastName.trim(),
        Contact_Phone: userData.smsPhone?.trim() || '',
        Email_from_App: userData.Email_from_App.trim().toLowerCase(),
        Quote_pdf: fileUrl // Include file URL if available
      };

      // Log the data being submitted to verify fields are present
      console.log('Submitting data to Google Sheets:', submissionData);

      await submitToGoogleSheets(submissionData);
      toast.success('Data successfully submitted to Google Sheets!', {
        duration: 4000,
      });
      
      // Reset form after successful submission
      setExtractedData(null);
      setUserData(null);
      setSelectedFile(null);
    } catch (error) {
      console.error('Submission error:', error);
      if (error instanceof Error) {
        toast.error(`Failed to submit: ${error.message}`);
      } else {
        toast.error('Failed to submit to Google Sheets');
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
                    onClick={handleSubmitToGoogleSheets}  // Changed function name
                    disabled={isLoading}
                    className="w-full bg-green-500 text-white py-3 px-4 rounded-lg hover:bg-green-600 disabled:bg-green-300 transition-colors"
                  >
                    {isLoading ? 'Submitting...' : 'Submit to Google Sheets'}
                  </button>
                  
                  {/* Optional: Keep Caspio as backup option */}
                  <button
                    onClick={async () => {
                      if (!extractedData || !userData || !selectedFile) {
                        toast.error('Please upload PDF and fill in all required fields');
                        return;
                      }
                      setIsLoading(true);
                      try {
                        const { submitToCaspio } = await import('./services/api');
                        const { file, ...restExtractedData } = extractedData;
                        const submissionData: PartialExtractedData = {
                          ...restExtractedData,
                          Contact_Name_First: userData.firstName.trim(),
                          Contact_Name_Last: userData.lastName.trim(),
                          Contact_Phone: userData.smsPhone?.trim() || '',
                          Email_from_App: userData.Email_from_App.trim().toLowerCase(),
                        };
                        await submitToCaspio(submissionData);
                        toast.success('Data submitted to Caspio!');
                      } catch (error) {
                        toast.error('Failed to submit to Caspio');
                      } finally {
                        setIsLoading(false);
                      }
                    }}
                    disabled={isLoading}
                    className="w-full mt-2 bg-blue-500 text-white py-3 px-4 rounded-lg hover:bg-blue-600 disabled:bg-blue-300 transition-colors"
                  >
                    {isLoading ? 'Submitting...' : 'Submit to Caspio (Backup)'}
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
