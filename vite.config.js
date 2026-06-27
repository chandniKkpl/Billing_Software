import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: { enabled: true },
      manifest: {
        name: 'Cosmo Store Billing',
        short_name: 'BillingApp',
        description: 'Offline-capable Billing Software',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'wintogether_logo.png', // Fallback icon using existing logo
            sizes: '192x192',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}']
      }
    })
  ],
  base: command === 'serve' ? '/' : '/Billing_Software/',
}))
