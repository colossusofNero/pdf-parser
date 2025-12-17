// lib/pdf-init.ts - More robust PDF.js initialization
import * as pdfjsLib from 'pdfjs-dist';

let initialized = false;

export const initializePDFWorker = async () => {
  if (initialized) {
    return pdfjsLib;
  }

  try {
    console.log('Initializing PDF.js worker...');
    
    // Disable worker completely for maximum compatibility
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    
    // Alternative: Try different worker sources in order of preference
    const workerSources = [
      // CDN version (most reliable)
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.js`,
      `https://unpkg.com/pdfjs-dist@4.10.38/build/pdf.worker.min.js`,
      // Local version (if available)
      '/assets/pdf.worker.js',
      '/pdf.worker.min.js',
      // Bundled version
      `node_modules/pdfjs-dist/build/pdf.worker.min.js`
    ];

    let workerLoaded = false;

    // Try each worker source
    for (const workerSrc of workerSources) {
      try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
        
        // Test if worker loads by creating a simple document
        const testArrayBuffer = new ArrayBuffer(8);
        const loadingTask = pdfjsLib.getDocument({ data: testArrayBuffer });
        
        // Set a timeout to avoid hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Worker test timeout')), 2000);
        });
        
        try {
          await Promise.race([loadingTask.promise, timeoutPromise]);
          console.log(`PDF.js worker loaded successfully from: ${workerSrc}`);
          workerLoaded = true;
          break;
        } catch (testError) {
          console.log(`Worker test failed for ${workerSrc}:`, testError.message);
          continue;
        }
      } catch (error) {
        console.log(`Failed to load worker from ${workerSrc}:`, error.message);
        continue;
      }
    }

    if (!workerLoaded) {
      console.warn('All worker sources failed, disabling worker (will be slower)');
      pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    }

    initialized = true;
    console.log('PDF.js initialization complete');
    
    return pdfjsLib;
  } catch (error) {
    console.error('PDF.js initialization failed:', error);
    
    // Fallback: disable worker entirely
    pdfjsLib.GlobalWorkerOptions.workerSrc = '';
    initialized = true;
    
    return pdfjsLib;
  }
};
