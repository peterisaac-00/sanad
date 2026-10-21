import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  const target = process.env.BACKEND_URL || 'http://localhost:5000';
  // Anything the Express app serves from the root must be proxied here, or the
  // dev server answers it with index.html (200 HTML), which the browser draws as
  // a broken image. `/api` is the JSON surface, `/uploads` is stored media.
  const proxy = {
    '/api': { target, changeOrigin: true },
    '/uploads': { target, changeOrigin: true },
  };

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy,
    },
    // `vite preview` serves the production bundle without Express, so it needs
    // the same wiring to stay faithful to a real deployment.
    preview: { proxy },
  };
});
