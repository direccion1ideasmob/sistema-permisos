import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'public',
      filename: 'sw.js',
      registerType: 'autoUpdate',
      injectManifest: {
        injectionPoint: undefined
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        start_url: '/',
        scope: '/',
        display: 'standalone',
        name: 'RH ACCESOS & SALIDAS',
        short_name: 'ACCESOS',
        description: 'Sistema de Permisos y Pases de Salida',
        theme_color: '#000000',
        background_color: '#ffffff',
        orientation: 'portrait',
        icons: [
          {
            src: '/LogoVerde-removebg-preview.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/LogoVerde-removebg-preview.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ]
});