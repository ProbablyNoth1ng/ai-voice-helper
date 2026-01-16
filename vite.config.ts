import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  root: './src/frontend',
  publicDir: '../../public',
  base: './', 
  build: {
    outDir: '../../dist-frontend',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src/frontend')
    }
  },
  server: {
    port: 5173,
    strictPort: true,
    open: false
  }
});