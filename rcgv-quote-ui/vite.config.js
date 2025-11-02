// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',          // <— make assets load as ./assets/...
  build: { outDir: 'dist' }
})
