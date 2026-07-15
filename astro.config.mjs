import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://pasttimeball.com',
  trailingSlash: 'ignore',
  integrations: [sitemap()],
});
