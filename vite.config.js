import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon-32x32.png', 'apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Mitrakami Superapp',
        short_name: 'Mitrakami',
        description: 'Aplikasi pembayaran digital dan PPOB Mitrakami.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f2f4f8',
        theme_color: '#d98e04',
        lang: 'id-ID',
        icons: [
          {
            src: '/icons/pwa-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any',
          },
          {
            src: '/icons/maskable.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
})
