import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'] // Atrapa todos los archivos para modo offline
      },
      manifest: {
        name: 'Panel Electoral Calima',
        short_name: 'Electoral',
        description: 'Gestión territorial de campaña',
        theme_color: '#0f172a',
        background_color: '#f1f5f9',
        display: 'standalone',
        // Nota: Más adelante podemos agregar los íconos de la campaña aquí
        icons: [
          {
            src: 'https://cdn-icons-png.flaticon.com/512/3256/3256114.png', // Ícono temporal
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
})