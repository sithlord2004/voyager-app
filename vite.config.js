import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Voyager PWA build config
export default defineConfig({
  // Stamp each build with the time it was built + the deployed commit, so the app
  // can show which version is running (handy for "are we on the same build?").
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
    __COMMIT__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA || '').slice(0, 7))
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: { clientsClaim: true, skipWaiting: true },
      manifest: {
        name: 'Voyager — Travel Hub',
        short_name: 'Voyager',
        description: 'Secure travel documents, trips, weather and more.',
        theme_color: '#0d1117',
        background_color: '#0d1117',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }
        ]
      }
    })
  ]
})
