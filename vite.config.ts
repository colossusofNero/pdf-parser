import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          pdfjs: ['pdfjs-dist'],
        },
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: ({ name }) => {
          if (name && name.includes('pdf.worker')) {
            return 'assets/pdf.worker.js';
          }
          return 'assets/[name].[hash].[ext]';
        },
      },
    },
  },
  server: {
    headers: {
      // Completely disable COEP/COOP for PDF.js compatibility
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Cross-Origin-Opener-Policy': 'unsafe-none',
      'Content-Security-Policy': `
        default-src 'self';
        script-src 'self' 'unsafe-eval' 'unsafe-inline' blob: data: https://cdnjs.cloudflare.com;
        style-src 'self' 'unsafe-inline';
        worker-src 'self' blob: data: https://cdnjs.cloudflare.com;
        connect-src 'self' https://c1acc979.caspio.com https://api.caspio.com https://cdnjs.cloudflare.com;
        img-src 'self' data: blob:;
        font-src 'self';
        object-src 'none';
      `.replace(/\s+/g, ' ').trim(),
    },
    proxy: {
      '/api': {
        target: 'https://c1acc979.caspio.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Authorization, Content-Type',
        }
      },
    },
    cors: {
      origin: true,
      credentials: true
    },
    open: true,
  },
  base: './',
  optimizeDeps: {
    exclude: ['pdfjs-dist']
  }
});
