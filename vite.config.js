import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // 3.0.3's published CJS build has unresolved internal imports. Bundle its shipped TS source.
  resolve: { alias: { 'simli-client': 'simli-client/lib/client.ts' } },
  build: {
    rollupOptions: {
      output: { manualChunks: { voice: ['@elevenlabs/client'] } },
    },
  },
});
