import * as pdfjsLib from 'pdfjs-dist';
import { ExtractedData } from '../types';

// Set up PDF.js worker using CDN
const PDFJS_VERSION = '3.11.174';
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;

// Define the correct types for PDF.js text content
interface TextMarkedContent {
  str: string;
  dir: string;
  width: number;
  height: number;
  transform: number[];
  fontName: string;
}

const parseWhiteTextMetadata = (text: string): Partial<ExtractedData> => {
  const data: Partial<ExtractedData> = {};
  const fields = text.split('||').filter(Boolean);

  fields.forEach(field => {
    const [key, value] = field.split(':');
    if (key && value) {
      switch(key) {
        case 'Name_of_Prospect':
        case 'Address_of_Property':
        case 'Zip_Code':
        case 'Date_of_Purchase':
        case 'Tax_Deadline_Quote':
          data[key] = value.trim();
          break;
        case 'Acres_Land':
        case 'Bid_Amount_Original':
        case 'Pay_Upfront':
        case 'Pay_50_50_Amount':
        case 'Pay_Over_Time':
        case 'Rush_Fee':
          data[key] = parseFloat(value) || 0;
          break;
        case 'Purchase_Price':
        case 'Capital_Improvements_Amount':
        case 'Building_Value':
        case 'Know_Land_Value':
        case 'SqFt_Building':
        case 'Year_Built':
        case 'Multiple_Properties_Quote':
        case 'First_Year_Bonus_Quote':
        case 'Tax_Year':
          data[key] = parseInt(value) || 0;
          break;
      }
    }
  });

  return data;
};

export const parsePDF = async (file: File): Promise<ExtractedData> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    
    const pdf = await loadingTask.promise;
    let extractedData: Partial<ExtractedData> = {
      Name_of_Prospect: '',
      Address_of_Property: '',
      Zip_Code: '',
      Purchase_Price: 0,
      Capital_Improvements_Amount: 0,
      Building_Value: 0,
      Know_Land_Value: 0,
      Date_of_Purchase: '',
      SqFt_Building: 0,
      Acres_Land: 0,
      Year_Built: 0,
      Bid_Amount_Original: 0,
      Pay_Upfront: 0,
      Pay_50_50_Amount: 0,
      Pay_Over_Time: 0,
      Rush_Fee: 0,
      Multiple_Properties_Quote: 0,
      First_Year_Bonus_Quote: 0,
      Tax_Year: 0,
      Tax_Deadline_Quote: ''
    };

    // Get the last page where metadata should be
    const lastPage = await pdf.getPage(pdf.numPages);
    const textContent = await lastPage.getTextContent();
    
    // Look for metadata in white text
    const whiteTextItems = (textContent as any).items.find((item: TextMarkedContent) => 
      item.str && item.str.includes('||Name_of_Prospect:')
    );

    if (whiteTextItems) {
      const metadataString = whiteTextItems.str;
      const parsedData = parseWhiteTextMetadata(metadataString);
      extractedData = { ...extractedData, ...parsedData };
    } else {
      throw new Error('No metadata found in PDF');
    }

    // Validate required fields
    const requiredFields = [
      'Name_of_Prospect',
      'Address_of_Property',
      'Purchase_Price'
    ];
    
    const missingFields = requiredFields.filter(field => 
      !extractedData[field as keyof ExtractedData]
    );

    if (missingFields.length > 0) {
      throw new Error(`Required fields missing: ${missingFields.join(', ')}`);
    }

    return extractedData as ExtractedData;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to parse PDF file');
  }
};