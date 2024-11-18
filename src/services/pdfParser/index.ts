import { ExtractedData } from '../../types';
import { PDFParserOptions, ValidationError } from './types';
import { extractMetadataRow } from './metadata';
import { validateRequiredFields, validateFieldFormats } from './validators';
import { initializePDFWorker } from '../../lib/pdf-init';

export const parsePDF = async (
  file: File,
  options: PDFParserOptions = { validateFields: true, throwOnMissingFields: true }
): Promise<ExtractedData> => {
  try {
    const pdfjsLib = await initializePDFWorker();

    if (!file.type.includes('pdf')) {
      throw new Error('Invalid file type. Please upload a PDF file.');
    }

    const arrayBuffer = await file.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('Empty or invalid PDF file.');
    }

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    if (pdf.numPages === 0) {
      throw new Error('The PDF file appears to be empty.');
    }

    let extractedData: ExtractedData | null = null;
    let errors: ValidationError[] = [];

    // Process each page until we find valid metadata
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        if (!textContent || !textContent.items || textContent.items.length === 0) {
          continue;
        }

        const data = extractMetadataRow(textContent);

        if (options.validateFields) {
          const validationErrors = [
            ...validateRequiredFields(data),
            ...validateFieldFormats(data)
          ];

          if (validationErrors.length > 0) {
            errors = validationErrors;
            if (options.throwOnMissingFields) {
              throw new Error(
                'Validation errors: ' + 
                validationErrors.map(e => `${e.field}: ${e.message}`).join(', ')
              );
            }
            continue;
          }
        }

        extractedData = data;
        break;
      } catch (error) {
        console.error(`Error processing page ${i}:`, error);
        continue;
      }
    }

    if (!extractedData) {
      throw new Error(
        errors.length > 0
          ? `Validation errors: ${errors.map(e => `${e.field}: ${e.message}`).join(', ')}`
          : 'No valid metadata found in the PDF.'
      );
    }

    return extractedData;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to parse PDF file');
  }
};