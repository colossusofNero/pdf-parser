// App.tsx - Production-ready version with comprehensive error handling
import React, { useState, useEffect } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { FileUpload } from './components/FileUpload';
import { PdfDataDisplay } from './components/PdfDataDisplay';
import { HealthCheck } from './components/HealthCheck';
import { 
  extractPdfData, 
  submitToCaspio,
  uploadFileToCaspio,
  type PartialExtractedData 
} from './services/api';
import { Card, CardContent } from './components/ui/card';
import { AlertTriangle, RefreshCw, Shield } from 'lucide-react';

interface UserData {
  firstName: string;
  lastName: string;
  Email_from_App: string;
  smsPhone?: string;
}

interface AppState {
  extractedData: PartialExtractedData | null;
  userData: UserData | null;
  selectedFile: File | null;
  isLoading: boolean;
  processingStep: string;
  systemHealth: 'healthy' | 'warning' | 'error';
  lastSuccess: string | null;
  errorCount: number;
}

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    extractedData: null,
    userData: null,
    selectedFile: null,
    isLoading: false,
    processingStep: '',
    systemHealth: 'healthy',
    lastSuccess: null,
    errorCount: 0
  });

  // Error boundary and recovery
  const [hasError, setHasError] = useState(false);
  const [errorInfo, setErrorInfo] = useState<string>('');

  // System monitoring
  useEffect(() => {
    // Check for system changes that might break the app
    const checkSystemStability = () => {
      try {
        // Check if critical environment variables are still available
        const criticalVars = ['VITE_CASPIO_ACCESS_TOKEN', 'VITE_CASPIO_API_URL'];
        const missingVars = criticalVars.filter(v => !import.meta.env[v]);
        
        if (missingVars.length > 0) {
          console.error('🚨 Critical environment variables lost:', missingVars);
          toast.error('System configuration error detected. Please refresh the page.');
        }

        // Check if we can still access required APIs
        if (typeof fetch !== 'function') {
          throw new Error('Fetch API not available');
        }

        // Log system stats for monitoring
        console.log('📊 System Status:', {
          timestamp: new Date().toISOString(),
          memoryUsage: (performance as any).memory?.usedJSHeapSize || 'unknown',
          errorCount: state.errorCount,
          lastSuccess: state.lastSuccess,
          userAgent: navigator.userAgent
        });

      } catch (error) {
        console.error('🚨 System stability check failed:', error);
      }
    };

    // Run stability check periodically
    const stabilityInterval = setInterval(checkSystemStability, 30000); // Every 30 seconds

    return () => clearInterval(stabilityInterval);
  }, [state.errorCount, state.lastSuccess]);

  // Global error handler
  useEffect(() => {
    const handleGlobalError = (event: ErrorEvent) => {
      console.error('🚨 Global error caught:', event.error);
      setHasError(true);
      setErrorInfo(event.error?.message || 'Unknown error');
      
      setState(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
      
      toast.error('An unexpected error occurred. The system is attempting to recover.');
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('🚨 Unhandled promise rejection:', event.reason);
      setState(prev => ({ ...prev, errorCount: prev.errorCount + 1 }));
      
      // Don't show toast for every unhandled rejection (might be noisy)
      if (!event.reason?.message?.includes('AbortError')) {
        toast.error('A background process failed. Please try again.');
      }
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  const resetError = () => {
    setHasError(false);
    setErrorInfo('');
    setState(prev => ({ ...prev, errorCount: 0 }));
  };

  const updateProcessingStep = (step: string) => {
    setState(prev => ({ ...prev, processingStep: step }));
    console.log(`📋 Processing Step: ${step}`);
  };

  const handleFileUploadAndUserData = async (
    file: File,
    userInputData: UserData
  ) => {
    const operationId = Date.now().toString(36);
    console.log(`🚀 Starting file processing [${operationId}]`);

    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      processingStep: 'Initializing...'
    }));

    try {
      updateProcessingStep('Validating file...');
      
      // Additional file validation
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        throw new Error('File must have a .pdf extension');
      }

      const fileBuffer = await file.arrayBuffer();
      if (fileBuffer.byteLength === 0) {
        throw new Error('File appears to be empty or corrupted');
      }

      updateProcessingStep('Extracting data from PDF...');
      const extractedPdfData = await extractPdfData(file);
      
      // Validate extracted data
      if (!extractedPdfData || Object.keys(extractedPdfData).length === 0) {
        throw new Error('No data could be extracted from the PDF');
      }

      updateProcessingStep('Processing complete');
      
      setState(prev => ({
        ...prev,
        extractedData: extractedPdfData,
        userData: userInputData,
        selectedFile: file,
        isLoading: false,
        processingStep: '',
        lastSuccess: new Date().toISOString()
      }));
      
      toast.success('✅ PDF data extracted successfully');
      console.log(`✅ File processing completed [${operationId}]`);

    } catch (error) {
      console.error(`❌ File processing failed [${operationId}]:`, error);
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        processingStep: '',
        errorCount: prev.errorCount + 1
      }));
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error(`Failed to extract PDF data: ${errorMessage}`);
      
      // Log detailed error info for debugging
      console.error('📊 Error Details:', {
        operationId,
        errorMessage,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
      });
    }
  };

  const handleSubmitToCaspio = async () => {
    if (!state.extractedData || !state.userData || !state.selectedFile) {
      toast.error('Please upload PDF and fill in all required fields');
      return;
    }

    const submissionId = Date.now().toString(36);
    console.log(`🚀 Starting Caspio submission [${submissionId}]`);

    setState(prev => ({ 
      ...prev, 
      isLoading: true, 
      processingStep: 'Preparing submission...'
    }));

    try {
      updateProcessingStep('Uploading file to Caspio...');
      
      // Create submission data
      const { file, ...restExtractedData } = state.extractedData;
      const submissionData: PartialExtractedData = {
        ...restExtractedData,
        Contact_Name_First: state.userData.firstName.trim(),
        Contact_Name_Last: state.userData.lastName.trim(),
        Contact_Phone: state.userData.smsPhone?.trim() || '',
        Email_from_App: state.userData.Email_from_App.trim().toLowerCase(),
      };

      // Add file reference
      if (state.selectedFile) {
        const fileName = `RCGV_${state.userData.firstName}_${state.userData.lastName}_${restExtractedData.Address_of_Property}`.replace(/[^a-zA-Z0-9_-]/g, '_') + '.pdf';
        submissionData.Quote_pdf = fileName;
      }

      updateProcessingStep('Submitting data to Caspio...');
      await submitToCaspio(submissionData);

      updateProcessingStep('Submission successful!');
      
      setState(prev => ({
        ...prev,
        isLoading: false,
        processingStep: '',
        lastSuccess: new Date().toISOString(),
        // Reset form after successful submission
        extractedData: null,
        userData: null,
        selectedFile: null
      }));
      
      toast.success('🎉 Data successfully submitted to Caspio!');
      console.log(`✅ Caspio submission completed [${submissionId}]`);

    } catch (error) {
      console.error(`❌ Caspio submission failed [${submissionId}]:`, error);
      
      setState(prev => ({ 
        ...prev, 
        isLoading: false, 
        processingStep: '',
        errorCount: prev.errorCount + 1
      }));
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown submission error';
      toast.error(`Failed to submit: ${errorMessage}`);
      
      // Log detailed submission error
      console.error('📊 Submission Error Details:', {
        submissionId,
        errorMessage,
        fieldCount: Object.keys(state.extractedData || {}).length,
        hasFile: !!state.selectedFile,
        timestamp: new Date().toISOString()
      });
    }
  };

  const handleHealthChange = (healthStatus: any) => {
    setState(prev => ({ 
      ...prev, 
      systemHealth: healthStatus.overall 
    }));

    // Show warnings for system health issues
    if (healthStatus.overall === 'error') {
      toast.error('System health check failed. Some features may not work properly.');
    } else if (healthStatus.overall === 'warning') {
      toast('System health warnings detected. Monitor for issues.', { icon: '⚠️' });
    }
  };

  // Error boundary UI
  if (hasError) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-lg border border-red-200">
          <div className="flex items-center space-x-3 mb-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <h1 className="text-xl font-bold text-red-700">Application Error</h1>
          </div>
          <p className="text-gray-600 mb-4">
            The application encountered an unexpected error and needs to recover.
          </p>
          <div className="bg-red-50 p-3 rounded text-sm text-red-700 mb-4">
            <strong>Error:</strong> {errorInfo}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={resetError}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reset Application</span>
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Full Refresh
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Toaster 
        position="top-right" 
        toastOptions={{
          duration: 4000,
          style: {
            maxWidth: '500px',
          },
        }}
      />
      
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center mb-8">
          <Shield className="w-8 h-8 text-blue-600 mr-3" />
          <h1 className="text-3xl font-bold text-center">PDF Data Extractor</h1>
        </div>
        
        <div className="max-w-4xl mx-auto space-y-6">
          {/* System Health Monitor */}
          <HealthCheck onHealthChange={handleHealthChange} />
          
          {/* Show processing status */}
          {state.isLoading && state.processingStep && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-3">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
                  <span className="text-sm font-medium">{state.processingStep}</span>
                </div>
              </CardContent>
            </Card>
          )}

          {/* File upload section */}
          {!state.extractedData && (
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold mb-4">Upload PDF & Enter Information</h2>
                <FileUpload 
                  onFileSelect={handleFileUploadAndUserData}
                  isLoading={state.isLoading}
                />
              </CardContent>
            </Card>
          )}

          {/* Data display and submission */}
          {state.extractedData && (
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <h2 className="text-xl font-semibold mb-4">Extracted Data</h2>
                  <PdfDataDisplay data={state.extractedData} />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <button
                    onClick={handleSubmitToCaspio}
                    disabled={state.isLoading}
                    className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center justify-center space-x-2"
                  >
                    {state.isLoading ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <span>Submit to Caspio</span>
                    )}
                  </button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* System status footer */}
          <div className="text-center text-sm text-gray-500">
            <p>
              System Status: <span className={`font-medium ${
                state.systemHealth === 'healthy' ? 'text-green-600' :
                state.systemHealth === 'warning' ? 'text-yellow-600' : 'text-red-600'
              }`}>
                {state.systemHealth === 'healthy' ? 'Operational' :
                 state.systemHealth === 'warning' ? 'Minor Issues' : 'Critical Issues'}
              </span>
              {state.lastSuccess && (
                <span className="ml-4">
                  Last Success: {new Date(state.lastSuccess).toLocaleString()}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
