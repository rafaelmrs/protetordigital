import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://segurancaonline.com.br',
  integrations: [
    tailwind(),
    react(),
    mdx(),
    sitemap(),
  ],
  output: 'static',
  vite: {
    define: {
      'process.env.PUBLIC_WORKER_URL': JSON.stringify(process.env.PUBLIC_WORKER_URL || 'https://your-worker.workers.dev'),
      'process.env.PUBLIC_GA_ID': JSON.stringify(process.env.PUBLIC_GA_ID || ''),
      'process.env.PUBLIC_ADSENSE_ID': JSON.stringify(process.env.PUBLIC_ADSENSE_ID || ''),
    }
  }
});
