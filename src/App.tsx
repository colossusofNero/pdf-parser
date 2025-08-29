// src/App.tsx  [STATIC FILE — replace entire file]
import React, { useState } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import { FileUpload } from './components/FileUpload';
import { Card, CardContent } from './components/ui/card';

// pdf.js ESM + worker (Vite-friendly)
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url';
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

// ==== Local interfaces (static) ====
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

// ==== Helpers (static) ====
const NUMERIC_KEYS = new Set([
  'Purchase_Price','Capital_Improvements_Amount','Building_Value','Know_Land_Value','SqFt_Building',
  'Acres_Land','Year_Built','Bid_Amount_Original','Pay_Upfront','Pay_50_50_Amount','Pay_Over_Time',
  'Rush_Fee','Multiple_Properties_Quote','First_Year_Bonus_Quote','Tax_Year'
]);

const normalizeText = (s: string) =>
  s
    .normalize('NFKC')
    .replace(/\u00A0/g, ' ')
    .replace(/[¦︱∣│┃]/g, '|')
    .replace(/[：﹕]/g, ':')
    .replace(/\s+/g, ' ')
    .trim();

const sanitizeFileName = (text: string): string =>
  text.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();

const generateFileName = (data: ExtractedData): string => {
  const name = sanitizeFileName(data.Name_of_Prospect || 'Unknown');
  const address = sanitizeFileName(data.Address_of_Property || 'Unknown Address');
  return `RCGV_${name}_${address}.pdf`;
};

// ==== Component ====
const App: React.FC = () => {
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Extractor: robust to spacing/Unicode; reads page 1; tolerant regex; filename fallback; no throws
  const extractDataFromPDF = async (file: File): Promise<ExtractedData> => {
    console.log('Starting PDF extraction for:', file.name);
    const arrayBuffer = await file.arrayBuffer();
    // @ts-ignore
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, verbosity: 0 });
    const pdf = await loadingTask.promise;

    const page = await pdf.getPage(1);
    const tc = await page.getTextContent();
    // @ts-ignore join with '' avoids splitting "||" into "| |"
    const raw = (tc.items as any[]).map((it) => it.str || '').join('');
    const allText = normalizeText(raw);
    console.log('Normalized text length:', allText.length);

    // Permit whitespace around pipes and colon
    const pipeRegex = /\|\s*\|\s*([^|:]+?)\s*:\s*([^|]*?)\|\s*\|/g;

    const out: ExtractedData = {};
    let m: RegExpExecArray | null;
    while ((m = pipeRegex.exec(allText)) !== null) {
      const key = m[1]?.trim();
      const val = m[2]?.trim();
      if (!key || !val) continue;
      if (NUMERIC_KEYS.has(key)) {
        const num = parseFloat(val.replace(/[,$]/g, ''));
        if (!Number.isNaN(num)) (out as any)[key] = num;
      } else {
        (out as any)[key] = val;
      }
    }

    // Filename fallback if needed
    if (!out.Name_of_Prospect || !out.Address_of_Property) {
      const base = file.name.replace(/\.pdf$/i, '');
      const m2 = /^RCGV_(.+?)_(.+)$/.exec(base);
      if (m2) {
        out.Name_of_Prospect = out.Name_of_Prospect || m2[1].replace(/_/g, ' ').trim();
        out.Address_of_Property = out.Address_of_Property || m2[2].replace(/_/g, ' ').trim();
      }
    }

    console.log('Final extracted data:', out);
    return { ...out, file };
  };

  // Submit direct to Caspio using client env vars (static)
  const submitToCaspio = async (data: ExtractedData): Promise<void> => {
    console.log('Starting Caspio submission...');
    const token = import.meta.env.VITE_CASPIO_ACCESS_TOKEN;
    const apiUrl = import.meta.env.VITE_CASPIO_API_URL;
    if (!token || !apiUrl) {
      throw new Error('Missing Caspio configuration. Check VITE_CASPIO_ACCESS_TOKEN and VITE_CASPIO_API_URL');
    }
    const { file, ...submitData } = data;
    const cleanedSubmitData = Object.fromEntries(Object.entries(submitData).filter(([, v]) => v !== undefined));
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(cleanedSubmitData)
    });
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Caspio submission failed: ${response.status} - ${errorText}`);
    }
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
    if (!extractedData.Name_of_Prospect || !extractedData.Address_of_Property) {
      toast.error('Add Prospect Name and Property Address before submitting');
      return;
    }
    setIsLoading(true);
    try {
      const fileName = generateFileName(extractedData);
      const submissionData: ExtractedData = {
        ...extractedData,
        Contact_Name_First: userData.firstName.trim(),
        Contact_Name_Last: userData.lastName.trim(),
        Contact_Phone: userData.smsPhone?.trim() || '',
        Email_from_App: userData.Email_from_App.trim().toLowerCase(),
        Quote_pdf: `/${fileName}`
      };
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

  // Inline editor (static)
  const DataDisplay: React.FC<{ data: ExtractedData }> = ({ data }) => {
    const formatValue = (value: any): string => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'number') return value.toLocaleString();
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
                  <p className="text-sm text-blue-700"><strong>Original:</strong> {selectedFile?.name}</p>
                  <p className="text-sm text-blue-700"><strong>Caspio filename:</strong> {generateFileName(extractedData)}</p>
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
