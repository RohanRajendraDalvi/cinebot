import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: {
    allowedHosts: ['cinebot-client.onrender.com'],
    host: '0.0.0.0',
    port: 10000
  }
})
