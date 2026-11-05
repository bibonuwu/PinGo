import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Манифест лежит в public/manifest.webmanifest (доступен и в dev, и в prod),
// поэтому плагин генерирует только service worker.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,webmanifest}'],
        navigateFallback: '/index.html',
        // /__/ — служебные адреса Firebase Hosting (вход через Google и др.), их нельзя подменять приложением.
        navigateFallbackDenylist: [/^\/__\//],
        cleanupOutdatedCaches: true,
        importScripts: ['/sw-notifications.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 40, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        // Библиотеки — в отдельные чанки: они меняются редко и хорошо кэшируются.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'react';
          if (id.includes('react-router') || id.includes('@remix-run')) return 'router';
          if (id.includes('framer-motion') || id.includes('motion-dom') || id.includes('motion-utils')) return 'motion';
          // Firebase — одним чанком: модули SDK ссылаются друг на друга, раздельные чанки дают цикл импорта.
          if (id.includes('firebase')) return 'firebase';
          return undefined;
        },
      },
    },
  },
});
