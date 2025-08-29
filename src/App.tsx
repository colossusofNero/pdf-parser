import React, { useState } from 'react';
import { toast, Toaster } from 'react-hot-toast';
import FileUpload from './components/FileUpload';
import { Card, CardContent } from './components/ui/card';

// pdf.js ESM + worker (Vite)
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker&url';
// @ts-ignore
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface ExtractedData {
  Name_of_Prospect?: string;
  Address_of_Property?: string;
  Zip_Code?: number;
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
  CapEx_Date?: string;
  Type_of_Property_Quote?: string;
  Contact_Name_First?: string;
  Contact_Name_Last?: string;
  Contact_Phone?: string;
  Email_from_App?: string;
  Quote_pdf?: string;
  file?: File;
}

interface UserData {
  firstName: string;
  lastName: string;
  Email_from_App: string;
  smsPhone?: string;
}

const REQUIRED_KEYS = [
  'Name_of_Prospect',
  'Address_of_Property',
  'Zip_Code',
  'Purchase_Price',
  'Capital_Improvements_Amount',
  'Building_Value',
  'Know_Land_Value',
  'Date_of_Purchase',
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
  'Tax_Year',
  'Tax_Deadline_Quote',
  'CapEx_Date',
  'Type_of_Property_Quote'
] as const;

const DECIMAL_KEYS = new Set<string>([
  'Capital_Improvements_Amount',
  'Bid_Amount_Original',
  'Pay_Upfront',
  'Pay_50_50_Amount',
  'Pay_Over_Time',
  'Rush_Fee',
  'First_Year_Bonus_Quote',
  'Acres_Land'
]);

const INTEGER_KEYS = new Set<string>([
  'Zip_Code',
  'Purchase_Price',
  'Building_Value',
  'Know_Land_Value',
  'SqFt_Building',
  'Year_Built',
  'Multiple_Properties_Quote',
  'Tax_Year'
]);

const DATE_KEYS = new Set<string>(['Date_of_Purchase', 'CapEx_Date']);

const normalizeAscii = (s: string) =>
  s
    .normalize('NFKC')
    .replace(/\u00A0/g, ' ')
    .replace(/[：﹕]/g, ':')
    .replace(/[¦︱∣│┃]/g, '|')
    .replace(/\s+/g, ' ')
    .trim();

const parseNumberStrict = (raw: string, decimals: boolean) => {
  const cleaned = raw.replace(/[\$,]/g, '');
  if (cleaned === '') return undefined;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return undefined;
  return decimals ? Number(n.toFixed(2)) : Math.trunc(n);
};

const parseDateMDY = (raw: string) => {
  const t = raw.trim();
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(t)) return undefined;
  return t;
};

const sanitizeFileName = (text: string): string =>
  text.replace(/[<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim();

const generateFileName = (data: ExtractedData): string => {
  const name = sanitizeFileName(data.Name_of_Prospect || 'Unknown');
  const address = sanitizeFileName(data.Address_of_Property || 'Unknown Address');
  return `RCGV_${name}_${address}.pdf`;
};

const App: React.FC = () => {
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const extractDataFromPDF = async (file: File): Promise<ExtractedData> => {
    const arrayBuffer = await file.arrayBuffer();
    // @ts-ignore
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer, verbosity: 0 });
    const pdf = await loadingTask.promise;

    const page = await pdf.getPage(1);
    const tc = await page.getTextContent();
    // @ts-ignore
    const raw = (tc.items as any[]).map(it => it.str || '').join('');
    const text = normalizeAscii(raw);

    const segments = text.split('||').map(s => s.trim()).filter(Boolean);
    const kv: Record<string, string> = {};
    for (const seg of segments) {
      const idx = seg.indexOf(':');
      if (idx <= 0) continue;
      const key = seg.slice(0, idx).trim();
      const value = seg.slice(idx + 1).trim();
      if (!key || value === '') continue;
      kv[key] = value;
    }

    const missing: string[] = [];
    const badFormat: string[] = [];
    const out: ExtractedData = {};

    for (const key of REQUIRED_KEYS) {
      const rawVal = kv[key];
      if (rawVal == null || rawVal === '') {
        missing.push(key);
        continue;
      }
      if (INTEGER_KEYS.has(key)) {
        const n = parseNumberStrict(rawVal, false);
        if (n == null) badFormat.push(`${key} expects integer, got "${rawVal}"`);
        else (out as any)[key] = n;
        continue;
      }
      if (DECIMAL_KEYS.has(key)) {
        const n = parseNumberStrict(rawVal, true);
        if (n == null) badFormat.push(`${key} expects decimal, got "${rawVal}"`);
        else (out as any)[key] = n;
        continue;
      }
      if (DATE_KEYS.has(key)) {
        const d = parseDateMDY(rawVal);
        if (!d) badFormat.push(`${key} expects mm/dd/yyyy, got "${rawVal}"`);
        else (out as any)[key] = d;
        continue;
      }
      (out as any)[key] = rawVal;
    }

    if (missing.length || badFormat.length) {
      const msg =
        (missing.length ? `Missing: ${missing.join(', ')}. ` : '') +
        (badFormat.length ? `Bad format: ${badFormat.join(' | ')}.` : '');
      throw new Error(msg.trim());
    }

    return { ...out, file };
  };

  const submitToCaspio = async (data: ExtractedData): Promise<void> => {
    // TODO: integrate with proper OAuth token flow as shown earlier
    const token = import.meta.env.VITE_CASPIO_ACCESS_TOKEN;
    const apiUrl = import.meta.env.VITE_CASPIO_API_URL;
    if (!token || !apiUrl) throw new Error('Missing Caspio configuration');
    const { file, ...record } = data;
    const payload = Object.fromEntries(Object.entries(record).filter(([, v]) => v !== undefined));
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Caspio submission failed: ${res.status} ${text}`);
    }
  };

  const handleFileUploadAndUserData = async (file: File, userInputData: UserData) => {
    setIsLoading(true);
    try {
      const extractedPdfData = await extractDataFromPDF(file);
      setExtractedData(extractedPdfData);
      setUserData(userInputData);
      setSelectedFile(file);
      toast.success('PDF data extracted successfully');
    } catch (error) {
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
      toast.error(`Failed to submit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditData = (field: string, value: any) => {
    if (!extractedData) return;
    setExtractedData({ ...extractedData, [field]: value });
  };

  const DataDisplay: React.FC<{ data: ExtractedData }> = ({ data }) => {
    const formatValue = (value: any): string => {
      if (value === null || value === undefined) return '';
      return value.toString();
    };
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Extracted Data</h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.keys(data).map((key) => (
            <div key={key} className="space-y-1">
              <label className="text-sm font-medium text-gray-600">{key}:</label>
              <input
                type="text"
                value={formatValue((data as any)[key])}
                onChange={(e) => handleEditData(key, e.target.value)}
                className="w-full p-2 border border-gray-300 rounded"
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
        <h1 className="text-3xl font-bold mb-4 text-center">RCG Valuation PDF Processor</h1>
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
                <p className="mb-4"><strong>Original file:</strong> {selectedFile?.name}</p>
                <p className="mb-4"><strong>Caspio filename:</strong> {generateFileName(extractedData)}</p>
                <DataDisplay data={extractedData} />
                <div className="mt-6 flex justify-end">
                  <button onClick={handleSubmitToCaspio} disabled={isLoading} className="px-6 py-2 bg-blue-600 text-white rounded-lg">
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
