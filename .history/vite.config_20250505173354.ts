import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Get the server port from environment or use default
const serverPort = process.env.SERVER_PORT || '3001';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Add environment variables support
  define: {
    'process.env': process.env
  },
  // Add proxy configuration for API requests
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${serverPort}`,
        changeOrigin: true,
        secure: false
      }
    },
    // Explicitly set the port to avoid conflicts
    port: 5173,
    strictPort: false,
    // Improve HMR stability
    hmr: {
      overlay: true
    }
  },
  // Properly handle TypeScript files
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom']
  },
  // Improve TS module resolution
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx']
  },
  // Force clear cache on build
  clearScreen: true,
  // Ensure CSS processing is working
  css: {
    postcss: './postcss.config.mjs'
  }
}) 