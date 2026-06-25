import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    open: true,
    proxy: {
      // Proxy /api/nvidia requests to the NVIDIA NIM API to avoid CORS issues.
      // The browser calls localhost:5173/api/nvidia/... → Vite forwards to integrate.api.nvidia.com/...
      '/api/nvidia': {
        target: 'https://integrate.api.nvidia.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nvidia/, ''),
        secure: true,
      },
    },
  },
})
