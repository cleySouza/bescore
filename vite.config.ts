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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        manifest: {
          name: 'bescore',
          short_name: 'bescore',
          // `version` não está no tipo do plugin mas é suportado pela spec do manifest
          ...({ version: pkg.version } as any),
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#111827',
          icons: [
            {
              src: '/favicon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any',
            },
          ],
        },
        devOptions: {
          enabled: true,
        },
        workbox: {
          // Novo SW assume controlo imediatamente, sem esperar que o utilizador
          // feche todas as abas — elimina a tela branca por SW antigo em produção.
          skipWaiting: true,
          clientsClaim: true,
          globPatterns: ['**/*.{js,css,html,svg,png,ico,webp,woff2}'],
          runtimeCaching: [
            {
              urlPattern: ({ url }) => /\/auth\/v1\//.test(url.pathname),
              handler: 'NetworkOnly',
            },
          ],
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
