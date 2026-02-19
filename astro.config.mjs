import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import mdx from '@astrojs/mdx';

export default defineConfig({
  site: 'https://protetordigital.com',
  integrations: [
    react(),
    mdx(),
    // Sitemap automático do Astro removido — bugado no Cloudflare Pages.
    // Sitemap manual em /public/sitemap.xml
  ],
  build: {
    assets: '_assets',
  },
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
          },
        },
      },
    },
  },
});
