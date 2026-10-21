/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages serves the app from /<repo>/; the deploy workflow sets BASE_PATH accordingly.
const base = process.env.BASE_PATH ?? '/'

// Route matchers are serialized into the generated service worker, so they must be self-contained
// (a RegExp, not a closure over `base`).
const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&')
const origin = '^https?://[^/]+'
const mediaRoute = new RegExp(`${origin}${escapeRegExp(base)}media/`)
const contentRoute = new RegExp(`${origin}${escapeRegExp(base)}content/[^?#]+\\.json(?:[?#]|$)`)

export default defineConfig({
  base,
  build: {
    // One chunk (~180 kB gzipped) precached at install: splitting would not reduce what is
    // downloaded, so the warning threshold is raised rather than the bundle split.
    chunkSizeWarningLimit: 700,
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      // Registration is done by the update banner via `virtual:pwa-register/react`.
      injectRegister: false,
      manifest: {
        name: 'Muse — la culture, quelques minutes par jour',
        short_name: 'Muse',
        description:
          'Apprendre à reconnaître la musique classique et la peinture par courtes sessions.',
        lang: 'fr',
        display: 'standalone',
        orientation: 'portrait',
        start_url: base,
        scope: base,
        theme_color: '#f6f2ea',
        background_color: '#f6f2ea',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        // Course media and content are cached at runtime (and downloaded on demand for offline use).
        globIgnores: ['media/**', 'content/**'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: mediaRoute,
            handler: 'CacheFirst',
            options: {
              cacheName: 'muse-media',
              cacheableResponse: { statuses: [0, 200] },
              // Safari requests audio with Range headers; serve partial content from the cache.
              rangeRequests: true,
            },
          },
          {
            urlPattern: contentRoute,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'muse-content',
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
})
