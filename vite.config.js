import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'] 
      },
      manifest: {
        id: '/',               // 👈 Identificador único moderno
        start_url: '/',        // 👈 Punto de arranque
        scope: '/',            // 👈 Alcance de la app
        name: 'Electora Panel',
        short_name: 'Electora',
        description: 'Plataforma de gestión territorial',
        theme_color: '#153c5e',
        background_color: '#f4f7f6',
        display: 'standalone',
        orientation: 'portrait', // 👈 Bloquea la app en vertical (opcional pero recomendado)
        icons: [
          {
            src: '/ELECTORA-iso.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: '/ELECTORA-iso.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})