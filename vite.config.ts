import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const strapiTarget = env.VITE_STRAPI_URL || 'http://localhost:1337'

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'auto',
        manifest: false,
        devOptions: {
          enabled: true,
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2}'],
        },
      }),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
    },
    server: {
      host: true,
      proxy: {
        '/strapi': {
          target: strapiTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/strapi/, ''),
        },
      },
      watch: {
        // Polling deixa o auto-refresh estável mesmo com FS watchers instáveis.
        usePolling: true,
        interval: 120,
      },
    },
  }
})
