import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwind from '@tailwindcss/vite';
export default defineConfig({
  base: process.env.VITE_BASE_PATH || '/',
  plugins: [react(), tailwind()],
  server: {
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:5080',
        changeOrigin: false,
      },
      '/hub': {
        target: process.env.API_PROXY_TARGET || 'http://127.0.0.1:5080',
        changeOrigin: false,
        ws: true,
      },
    },
  },
});
