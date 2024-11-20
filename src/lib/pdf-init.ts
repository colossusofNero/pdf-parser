import * as pdfjsLib from 'pdfjs-dist';

// Use the jsDelivr-hosted worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.8.69/build/pdf.worker.min.mjs';

export const initializePDFWorker = async () => {
  try {
    return pdfjsLib;
  } catch (error) {
    console.error('Error initializing PDF.js worker:', error);
    throw new Error('Failed to initialize PDF processor');
  }
};
