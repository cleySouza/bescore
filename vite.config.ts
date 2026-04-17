import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/strapi': {
        target: 'http://localhost:1337',
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
})
