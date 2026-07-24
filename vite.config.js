import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      // For local dev with `vercel dev` running the API on 3000, or adjust as needed
      '/api': 'http://localhost:3000',
    },
  },
})
