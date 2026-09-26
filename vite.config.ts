import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Rutas relativas: la app funciona igual servida en la raíz de un dominio
  // (Netlify) o en una subcarpeta de proyecto (GitHub Pages), sin reconfigurar nada.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // El registro se hace a mano con el hook useRegisterSW (src/components/EstadoApp.tsx),
      // para poder mostrar en la interfaz si hay actualización disponible. Sin esto, el plugin
      // también inyectaría su propio script de registro y quedarían dos registros duplicados.
      injectRegister: false,
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Visitas Técnicas',
        short_name: 'Visitas',
        description: 'Gestión de visitas técnicas industriales: planificación, ejecución y cierre.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
})
