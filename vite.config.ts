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
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Content-Security-Policy': `
        default-src 'self';
        script-src 'self' 'unsafe-eval' 'unsafe-inline' blob:;
        style-src 'self' 'unsafe-inline';
        worker-src 'self' blob:;
        connect-src 'self' https://c1acc979.caspio.com;
        img-src 'self' data:;
        font-src 'self';
      `.replace(/\s+/g, ' ').trim(),
    },
    proxy: {
      '/api': {
        target: 'https://c1acc979.caspio.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
    open: true,
  },
  base: './',
});
