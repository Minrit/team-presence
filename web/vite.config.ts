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
      // Binary distribution (plan 010): forward `curl ${origin}/install.sh | sh`
      // and `/download/*` to the Axum server so the command pasted from the
      // browser-rendered install card actually works in dev.
      '/install.sh': 'http://localhost:8080',
      '/download': 'http://localhost:8080',
    },
  },
})
