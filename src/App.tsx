import React, { useState } from 'react';
import { FileUpload } from './components/FileUpload';
import { DataPreview } from './components/DataPreview';
import { Header } from './components/Header';
import { extractPdfData, submitToCaspio } from './services/api';
import { ExtractedData } from './types';
import { Toaster, toast } from 'react-hot-toast';

function App() {
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = async (file: File) => {
    setIsProcessing(true);
    try {
      const data = await extractPdfData(file);
      setExtractedData(data);
      toast.success('PDF processed successfully');
    } catch (error) {
      toast.error('Failed to process PDF');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDataEdit = (field: string, value: any) => {
    if (!extractedData) return;

    const updateNestedObject = (obj: any, path: string[], value: any): any => {
      const [current, ...rest] = path;
      if (rest.length === 0) {
        return { ...obj, [current]: value };
      }
      return {
        ...obj,
        [current]: updateNestedObject(obj[current], rest, value)
      };
    };

    const fieldPath = field.split('.');
    const updatedData = updateNestedObject(extractedData, fieldPath, value);
    setExtractedData(updatedData);
  };

  const handleSubmit = async () => {
    if (!extractedData) return;

    try {
      await submitToCaspio(extractedData);
      toast.success('Data submitted to Caspio successfully');
      setExtractedData(null);
    } catch (error) {
      toast.error('Failed to submit data to Caspio');
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-right" />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Header />

        <main className="space-y-8">
          {!extractedData && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <FileUpload onFileSelect={handleFileSelect} />
              {isProcessing && (
                <div className="mt-4 text-center text-gray-600">
                  Processing PDF... Please wait
                </div>
              )}
            </div>
          )}

          {extractedData && (
            <DataPreview
              data={extractedData}
              onSubmit={handleSubmit}
              onEdit={handleDataEdit}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;