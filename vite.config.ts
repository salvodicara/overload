import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'enforce-app-chunk-size',
      apply: 'build',
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type !== 'chunk') continue;
          const bytes = Buffer.byteLength(output.code);
          if (bytes > 500_000) this.error(`${output.fileName} is ${bytes} B; limit is 500000 B`);
        }
      },
    },
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Never intercept Firebase Auth's reserved /__/* endpoints: serving the
        // SPA there breaks the sign-in popup/redirect handler.
        navigateFallbackDenylist: [/^\/__\//],
        globPatterns: ['**/*.{js,css,html,woff2,png}'],
        globIgnores: ['exercise-media/**'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.origin === self.location.origin &&
              (url.pathname === '/data/exercises.json' ||
                url.pathname === '/data/instructions.it.json'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'exercise-data',
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: /\/exercise-media\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'exercise-media',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      manifest: {
        name: 'Overload',
        short_name: 'Overload',
        description: 'Progressive overload. Nothing else.',
        lang: 'it',
        display: 'standalone',
        background_color: '#0c0e10',
        theme_color: '#0c0e10',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'node',
    exclude: ['**/node_modules/**', '**/dist/**', '.claude/**', 'e2e/**'],
  },
});
