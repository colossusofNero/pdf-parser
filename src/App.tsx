// App.tsx - Complete fix for all identified issues
import React, { useState } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { FileUpload } from './components/FileUpload';
import { Card, CardContent } from './components/ui/card';

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url';

// Local interface definitions to avoid import conflicts
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

  // Filename generation (local to avoid import issues)
  const sanitizeFileName = (text: string): string => {
    return text
      .replace(/[<>:"/\\|?*]/g, '') // Remove illegal characters
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  };

  const generateFileName = (data: ExtractedData): string => {
    const name = sanitizeFileName(data.Name_of_Prospect || 'Unknown');
    const address = sanitizeFileName(data.Address_of_Property || 'Unknown Address');
    return `RCGV_${name}_${address}.pdf`;
  };

 const extractDataFromPDF = async (file: File): Promise<ExtractedData> => {
  try {
    console.log('Starting PDF extraction for:', file.name);

    const arrayBuffer = await file.arrayBuffer();
    // @ts-ignore
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      verbosity: 0
    });

    const pdf = await loadingTask.promise;
    console.log(`PDF loaded successfully, ${pdf.numPages} pages`);

    const page = await pdf.getPage(1);
    const textContent = await page.getTextContent();

    const fullText = textContent.items
      // @ts-ignore
      .map((item: any) => item.str || '')
      .join(' ');

    console.log('Extracted text length:', fullText.length);

    const extractedData: ExtractedData = {};
    const metadataRegex = /\|\|([^|:]+):([^|]*)\|\|/g;
    let match;
    while ((match = metadataRegex.exec(fullText)) !== null) {
      const [, key, value] = match;
      const cleanKey = key.trim();
      const cleanValue = value.trim();
      if (cleanKey && cleanValue) {
        if (
          [
            'Purchase_Price',
            'Capital_Improvements_Amount',
            'Building_Value',
            'Know_Land_Value',
            'SqFt_Building',
            'Acres_Land',
            'Year_Built',
            'Bid_Amount_Original',
            'Pay_Upfront',
            'Pay_50_50_Amount',
            'Pay_Over_Time',
            'Rush_Fee',
            'Multiple_Properties_Quote',
            'First_Year_Bonus_Quote',
            'Tax_Year'
          ].includes(cleanKey)
        ) {
          const numValue = parseFloat(cleanValue.replace(/[,$]/g, ''));
          if (!isNaN(numValue)) (extractedData as any)[cleanKey] = numValue;
        } else {
          (extractedData as any)[cleanKey] = cleanValue;
        }
      }
    }

    if (!extractedData.Name_of_Prospect || !extractedData.Address_of_Property) {
      throw new Error('Required fields missing from PDF: Name_of_Prospect or Address_of_Property');
    }

    return { ...extractedData, file };
  } catch (error) {
    console.error('PDF extraction failed:', error);
    throw new Error(`Failed to extract PDF data: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
      const pdfjsLib = await import('pdfjs-dist');
      // Use CDN worker to avoid deployment issues
      // @ts-ignore
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
      console.log('PDF.js loaded, processing file...');

      const arrayBuffer = await file.arrayBuffer();
      // @ts-ignore
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        verbosity: 0
      });

      const pdf = await loadingTask.promise;
      console.log(`PDF loaded successfully, ${pdf.numPages} pages`);

      // Extract text from first page
      const page = await pdf.getPage(1);
      const textContent = await page.getTextContent();

      const fullText = textContent.items
        // @ts-ignore
        .map((item: any) => item.str || '')
        .join(' ');

      console.log('Extracted text length:', fullText.length);

      // Enhanced metadata parsing
      const extractedData: ExtractedData = {};

      // Look for the metadata pattern: ||key:value||
      const metadataRegex = /\|\|([^|:]+):([^|]*)\|\|/g;
      let match;

      console.log('Parsing metadata...');
      while ((match = metadataRegex.exec(fullText)) !== null) {
        const [, key, value] = match;
        const cleanKey = key.trim();
        const cleanValue = value.trim();

        console.log(`Found: ${cleanKey} = ${cleanValue}`);

        if (cleanKey && cleanValue) {
          if (
            [
              'Purchase_Price',
              'Capital_Improvements_Amount',
              'Building_Value',
              'Know_Land_Value',
              'SqFt_Building',
              'Acres_Land',
              'Year_Built',
              'Bid_Amount_Original',
              'Pay_Upfront',
              'Pay_50_50_Amount',
              'Pay_Over_Time',
              'Rush_Fee',
              'Multiple_Properties_Quote',
              'First_Year_Bonus_Quote',
              'Tax_Year'
            ].includes(cleanKey)
          ) {
            const numValue = parseFloat(cleanValue.replace(/[,$]/g, ''));
            if (!isNaN(numValue)) {
              (extractedData as any)[cleanKey] = numValue;
            }
          } else {
            (extractedData as any)[cleanKey] = cleanValue;
          }
        }
      }

      console.log('Final extracted data:', extractedData);

      if (!extractedData.Name_of_Prospect || !extractedData.Address_of_Property) {
        throw new Error('Required fields missing from PDF: Name_of_Prospect or Address_of_Property');
      }

      return { ...extractedData, file };
    } catch (error) {
      console.error('PDF extraction failed:', error);
      throw new Error(`Failed to extract PDF data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Direct Caspio submission (bypass serverless issues)
  const submitToCaspio = async (data: ExtractedData): Promise<void> => {
    console.log('Starting Caspio submission...');
    const token = import.meta.env.VITE_CASPIO_ACCESS_TOKEN;
    const apiUrl = import.meta.env.VITE_CASPIO_API_URL;

    if (!token || !apiUrl) {
      throw new Error('Missing Caspio configuration. Check VITE_CASPIO_ACCESS_TOKEN and VITE_CASPIO_API_URL');
    }

    const { file, ...submitData } = data;

    // Remove any undefined values without unsafe index deletes
    const cleanedSubmitData = Object.fromEntries(
      Object.entries(submitData).filter(([, v]) => v !== undefined)
    );

    console.log('Submitting to Caspio:', cleanedSubmitData);
    console.log('API URL:', apiUrl);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify(cleanedSubmitData)
    });

    console.log('Caspio response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Caspio error response:', errorText);
      throw new Error(`Caspio submission failed: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log('Caspio success response:', responseText || '(empty response)');
  };

  const handleFileUploadAndUserData = async (file: File, userInputData: UserData) => {
    setIsLoading(true);
    try {
      console.log('Processing file and user data...');
      const extractedPdfData = await extractDataFromPDF(file);
      setExtractedData(extractedPdfData);
      setUserData(userInputData);
      setSelectedFile(file);
      toast.success('PDF data extracted successfully');
    } catch (error) {
      console.error('Error processing data:', error);
      toast.error(`Failed to extract PDF data: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
      const fileName = generateFileName(extractedData);
      console.log('Generated filename:', fileName);

      const submissionData: ExtractedData = {
        ...extractedData,
        Contact_Name_First: userData.firstName.trim(),
        Contact_Name_Last: userData.lastName.trim(),
        Contact_Phone: userData.smsPhone?.trim() || '',
        Email_from_App: userData.Email_from_App.trim().toLowerCase(),
        Quote_pdf: `/${fileName}`
      };

      console.log('Final submission data:', submissionData);

      await submitToCaspio(submissionData);
      toast.success('Data successfully submitted to Caspio!');

      setExtractedData(null);
      setUserData(null);
      setSelectedFile(null);
    } catch (error) {
      console.error('Submission error:', error);
      toast.error(`Failed to submit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditData = (field: string, value: any) => {
    if (!extractedData) return;
    setExtractedData({ ...extractedData, [field]: value });
  };

  // Simple data display component (inline to avoid interface issues)
  const DataDisplay: React.FC<{ data: ExtractedData }> = ({ data }) => {
    const formatValue = (value: any): string => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'number') {
        return value.toLocaleString();
      }
      return value.toString();
    };

    const fields = [
      { key: 'Name_of_Prospect', label: 'Prospect Name' },
      { key: 'Address_of_Property', label: 'Property Address' },
      { key: 'Zip_Code', label: 'Zip Code' },
      { key: 'Purchase_Price', label: 'Purchase Price' },
      { key: 'Building_Value', label: 'Building Value' },
      { key: 'Know_Land_Value', label: 'Land Value' },
      { key: 'Date_of_Purchase', label: 'Purchase Date' },
      { key: 'SqFt_Building', label: 'Building Sq Ft' },
      { key: 'Acres_Land', label: 'Land Acres' },
      { key: 'Type_of_Property_Quote', label: 'Property Type' },
      { key: 'Bid_Amount_Original', label: 'Original Bid' },
      { key: 'Pay_Upfront', label: 'Upfront Payment' },
      { key: 'Tax_Year', label: 'Tax Year' }
    ];

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Extracted Data</h3>
        <div className="grid grid-cols-2 gap-4">
          {fields.map(({ key, label }) => (
            <div key={key} className="space-y-1">
              <label className="text-sm font-medium text-gray-600">{label}:</label>
              <input
                type="text"
                value={formatValue((data as any)[key])}
                onChange={(e) => handleEditData(key, e.target.value)}
                className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                disabled={isLoading}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">RCG Valuation PDF Processor</h1>
          <p className="text-gray-600">Upload your cost segregation quote PDF to extract and submit data to Caspio</p>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {!extractedData ? (
            <Card>
              <CardContent className="p-6">
                <FileUpload onFileSelect={handleFileUploadAndUserData} isLoading={isLoading} />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h3 className="font-medium text-blue-800 mb-2">File Information</h3>
                  <p className="text-sm text-blue-700">
                    <strong>Original:</strong> {selectedFile?.name}
                  </p>
                  <p className="text-sm text-blue-700">
                    <strong>Caspio filename:</strong> {generateFileName(extractedData)}
                  </p>
                </div>

                <DataDisplay data={extractedData} />

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={handleSubmitToCaspio}
                    disabled={isLoading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {isLoading ? 'Submitting...' : 'Submit to Caspio'}
                  </button>
                </div>
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
