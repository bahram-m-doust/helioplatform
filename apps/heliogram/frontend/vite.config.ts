import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Public base path. In production the community app is served under
// /heliogram/ by the root nginx, so HTML/asset URLs must be rewritten
// accordingly. Dev keeps '/' so `vite dev` continues to work unchanged.
const basePath = process.env.HELIOGRAM_BASE_PATH ?? '/'

export default defineConfig({
  base: basePath,
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5050,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8010',
        changeOrigin: true,
      },
      '/sse': {
        target: 'http://127.0.0.1:8010',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
