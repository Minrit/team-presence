import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8080',
      '/health': 'http://localhost:8080',
      // SSE: pass through to server, keep stream open.
      '/sse': { target: 'http://localhost:8080', changeOrigin: false },
      // WS upgrade for /ws/collector (collector hits server direct; this is
      // here so browser tests can reach it through vite if needed).
      '/ws': { target: 'ws://localhost:8080', ws: true, changeOrigin: false },
    },
  },
})
