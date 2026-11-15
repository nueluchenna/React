import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Automatically copies ONNX WebAssembly files from node_modules into public/
 * so they don't need to be committed to Git and work seamlessly on Vercel builds.
 */
function copyOnnxWasmPlugin() {
  return {
    name: 'copy-onnx-wasm',
    buildStart() {
      const srcDir = path.resolve(__dirname, 'node_modules/@xenova/transformers/dist');
      const destDir = path.resolve(__dirname, 'public');
      if (!fs.existsSync(srcDir)) return;
      if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

      for (const file of fs.readdirSync(srcDir)) {
        if (file.endsWith('.wasm')) {
          const destFile = path.join(destDir, file);
          if (!fs.existsSync(destFile)) {
            fs.copyFileSync(path.join(srcDir, file), destFile);
          }
        }
      }
    }
  };
}

export default defineConfig({
  plugins: [
    copyOnnxWasmPlugin(),
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg'],
      manifest: {
        name: 'Offline German Tech Vocab',
        short_name: 'TechVocab',
        description: 'Offline-first live transcription and FSRS flashcard generator',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
        maximumFileSizeToCacheInBytes: 50 * 1024 * 1024
      }
    })
  ],

  // Point @xenova/transformers directly to its pre-built browser ES module bundle
  // which already bundles onnxruntime-web and onnxruntime-common with all exports intact
  resolve: {
    alias: {
      '@xenova/transformers': path.resolve(
        __dirname,
        'node_modules/@xenova/transformers/dist/transformers.min.js'
      )
    }
  },

  worker: {
    format: 'es'
  },

  optimizeDeps: {
    exclude: ['@xenova/transformers', 'onnxruntime-web', 'onnxruntime-node']
  }
});
