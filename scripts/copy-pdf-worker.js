import { copyFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const workerSrc = join(__dirname, '../node_modules/pdfjs-dist/build/pdf.worker.min.js');
const publicDir = join(__dirname, '../public');
const workerDest = join(publicDir, 'pdf.worker.min.js');

try {
  // Ensure public directory exists
  mkdirSync(publicDir, { recursive: true });
  
  // Copy worker file
  copyFileSync(workerSrc, workerDest);
  console.log('PDF.js worker file copied successfully');
} catch (error) {
  console.error('Error copying PDF.js worker file:', error);
  process.exit(1);
}