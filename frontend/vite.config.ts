/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      // 0.0.0.0 so the dev server is reachable from outside the container.
      host: true,
      port: 3000,
      strictPort: true,
      watch: {
        // Bind-mounted volumes on Windows/macOS don't emit inotify events.
        usePolling: true,
      },
      proxy: {
        // Lets the browser call same-origin `/api/...` in development, so no
        // CORS preflight and cookies stay first-party.
        '/api': {
          target: env.VITE_PROXY_TARGET ?? 'http://localhost:4000',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    preview: {
      host: true,
      port: 3000,
    },

    build: {
      outDir: 'dist',
      sourcemap: mode !== 'production',
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          // Keep the big, rarely-changing vendors in their own long-cached chunks.
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            mui: ['@mui/material', '@mui/icons-material'],
            data: ['@tanstack/react-query', 'axios', '@reduxjs/toolkit', 'react-redux'],
          },
        },
      },
    },

    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      css: false,
    },
  };
});
