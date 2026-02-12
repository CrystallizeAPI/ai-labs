import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    open: true,
    allowedHosts: ['.ngrok-free.app', '.ngrok-free.dev'],
    proxy: {
      '/api/core': {
        target: 'https://api.crystallize.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/core/, ''),
      },
      '/api/s3-upload': {
        target: 'https://crystallize-mass-operations-production.s3.eu-central-1.amazonaws.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/s3-upload/, ''),
      },
    },
  },
})
