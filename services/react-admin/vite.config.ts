import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@auditsys/shared': path.resolve(__dirname, '../../packages/shared/src')
    }
  },
  server: {
    proxy: {
      '/api/audits': {
        target: process.env.VITE_DJANGO_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api/anomalies': {
        target: process.env.VITE_DJANGO_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
      '/api/bookings': {
        target: process.env.VITE_FASTIFY_URL || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/api/invoices': {
        target: process.env.VITE_FASTIFY_URL || 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
      '/api/evidence': {
        target: process.env.VITE_FASTIFY_URL || 'http://127.0.0.1:3000',
        changeOrigin: true,
      }
    }
  }
});
