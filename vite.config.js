import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'] // Esto descarga toda la app en la memoria del celular
      },
      manifest: {
        name: 'Panel Electoral Calima',
        short_name: 'Electoral',
        description: 'Gestión territorial de campaña',
        theme_color: '#0f172a',
        background_color: '#f1f5f9',
        display: 'standalone'
      }
    })
  ]
})