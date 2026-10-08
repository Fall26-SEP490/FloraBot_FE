import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  site: process.env.SITE_URL || 'https://florabot.example',
  integrations: [react(), sitemap()],
  build: { inlineStylesheets: 'always' },
  vite: {
    plugins: [tailwindcss()],
    // Leaflet's default entry is CommonJS; its shipped ESM build supports tree shaking.
    resolve: { alias: [{ find: /^leaflet$/, replacement: 'leaflet/dist/leaflet-src.esm.js' }] },
    server: { proxy: { '/api': process.env.API_PROXY_TARGET || 'http://127.0.0.1:5080' } },
  },
});
