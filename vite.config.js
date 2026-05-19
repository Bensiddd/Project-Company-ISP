import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import http from 'http'

const agent = new http.Agent({ keepAlive: true })

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        agent
      }
    }
  }
})