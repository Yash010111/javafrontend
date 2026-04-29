import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    proxy: {
      '/api': {
        target: 'https://proud-wholeness-production-fc22.up.railway.app',
        changeOrigin: true,
        secure: false,
        headers: {
          origin: 'https://proud-wholeness-production-fc22.up.railway.app'
        },
        rewrite: (path) => path
      }
    }
  }
});
