import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs';

export const initializePDFWorker = async () => {
  try {
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      // Set up the worker directly from the imported module
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    }
    return pdfjsLib;
  } catch (error) {
    console.error('Error initializing PDF.js worker:', error);
    throw new Error('Failed to initialize PDF processor');
  }
};