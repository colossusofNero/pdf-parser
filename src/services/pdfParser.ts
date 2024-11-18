import * as pdfjsLib from 'pdfjs-dist';
import { ExtractedData, DepreciationRow } from '../types';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface TextItem {
  str: string;
  transform: number[];
}

const extractWhiteFontData = (textContent: { items: TextItem[] }): string[] => {
  return textContent.items
    .filter(item => item.str.trim() && item.transform[0] === 0)
    .map(item => item.str);
};

const parseDepreciationTable = (text: string): DepreciationRow[] => {
  const rows: DepreciationRow[] = [];
  const tableRegex = /(\d{4})\s+(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(\d+)\s+(\d+(?:,\d{3})*(?:\.\d{2})?)/g;
  
  let match;
  while ((match = tableRegex.exec(text)) !== null) {
    rows.push({
      year: parseInt(match[1]),
      firstYearBonusQuote: parseFloat(match[2].replace(/,/g, '')),
      taxYear: parseInt(match[3]),
      totalBidAmount: parseFloat(match[4].replace(/,/g, ''))
    });
  }
  
  return rows;
};

const extractNumericValue = (text: string): number => {
  const match = text.match(/[\d,]+(?:\.\d{2})?/);
  return match ? parseFloat(match[0].replace(/,/g, '')) : 0;
};

const extractDateValue = (text: string): string => {
  const match = text.match(/\d{1,2}\/\d{1,2}\/\d{4}/);
  return match ? match[0] : '';
};

export const parsePDF = async (file: File): Promise<ExtractedData> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    
    const pdf = await loadingTask.promise;
    let extractedData: Partial<ExtractedData> = {
      depreciationTable: [],
      companyName: '',
      propertyType: '',
      address: '',
      purchasePrice: 0,
      capitalImprovements: 0,
      landValue: 0,
      purchaseDate: '',
      buildingSqFt: 0,
      acresLand: 0,
      dueDate: '',
      bidAmount: 0,
      rushFee: 0
    };

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map((item: TextItem) => item.str).join(' ');
      const whiteFontData = extractWhiteFontData(textContent);

      // Extract fields using more specific regex patterns
      const fieldPatterns = {
        companyName: /Company:\s*([^:\n]+)/,
        propertyType: /Property Type:\s*([^:\n]+)/,
        address: /Address:\s*([^:\n]+)/,
        purchasePrice: /Purchase Price:\s*([\d,]+(?:\.\d{2})?)/,
        landValue: /Land Value:\s*([\d,]+(?:\.\d{2})?)/,
        purchaseDate: /Purchase Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/,
        buildingSqFt: /Building SqFt:\s*([\d,]+)/,
        acresLand: /Acres Land:\s*([\d,.]+)/,
        dueDate: /Due Date:\s*(\d{1,2}\/\d{1,2}\/\d{4})/,
        bidAmount: /Bid Amount:\s*([\d,]+(?:\.\d{2})?)/,
        rushFee: /Rush Fee:\s*([\d,]+(?:\.\d{2})?)/
      };

      // Extract values using patterns
      Object.entries(fieldPatterns).forEach(([key, pattern]) => {
        const match = pageText.match(pattern);
        if (match) {
          if (key.includes('Date')) {
            extractedData[key as keyof ExtractedData] = match[1];
          } else if (key.includes('Price') || key.includes('Amount') || key.includes('Value') || key.includes('Fee')) {
            extractedData[key as keyof ExtractedData] = extractNumericValue(match[1]);
          } else if (key.includes('SqFt') || key.includes('Acres')) {
            extractedData[key as keyof ExtractedData] = parseFloat(match[1].replace(/,/g, ''));
          } else {
            extractedData[key as keyof ExtractedData] = match[1].trim();
          }
        }
      });

      // Process white font data
      whiteFontData.forEach(data => {
        if (data.includes('Capital Improvements:')) {
          extractedData.capitalImprovements = extractNumericValue(data);
        }
      });

      // Parse depreciation table if present
      if (pageText.includes('Depreciation Table')) {
        extractedData.depreciationTable = parseDepreciationTable(pageText);
      }
    }

    // Validate required fields
    const requiredFields = ['companyName', 'address', 'purchasePrice'];
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