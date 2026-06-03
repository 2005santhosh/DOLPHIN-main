import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

// Build version: timestamp + short random suffix
const BUILD_VERSION = `${new Date().toISOString().slice(0, 16).replace('T', '-')}-${Math.random().toString(36).slice(2, 7)}`;

/**
 * Vite plugin: write /public/version.json at build time.
 * AppUpdateBanner polls this file every 5 min to detect new deploys.
 * The file is written into public/ so it's copied verbatim to dist/ root,
 * served as /version.json, and must NOT be hashed.
 */
function versionFilePlugin() {
  return {
    name: 'version-file',
    buildStart() {
      const versionData = JSON.stringify({ version: BUILD_VERSION }, null, 2);
      // Write to public/ so Vite copies it to dist/ as-is (no hash)
      writeFileSync(resolve(__dirname, 'public', 'version.json'), versionData);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    versionFilePlugin(), // generates public/version.json on every build
  ],

  // Expose build version to the app
  define: {
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(BUILD_VERSION),
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
      },
    },
  },

  build: {
    // Target modern browsers — avoids unnecessary polyfill overhead.
    // 95%+ of users on a startup SaaS platform are on modern browsers.
    target: 'es2020',

    // Inline assets smaller than 4kb as base64 to save HTTP round-trips.
    assetsInlineLimit: 4096,

    // Warn if any individual chunk exceeds 600kb gzipped — forces us to
    // keep an eye on bundle bloat.
    chunkSizeWarningLimit: 600,

    // Source maps in production help with error monitoring (Sentry etc.)
    // without bloating the main bundle (separate files, not inline).
    sourcemap: false, // set to true when adding Sentry

    rollupOptions: {
      output: {
        // ── Manual chunk strategy ────────────────────────────────────────────
        // Goal: split into stable long-cache chunks so returning users don't
        // re-download unchanged code.
        //
        // Rules:
        //   1. Each large vendor gets its own chunk (hashed, ~1yr cache).
        //   2. Shared app utilities get stable chunks.
        //   3. Route-level pages are already lazy — Vite splits them automatically.
        manualChunks(id) {
          // ── Vendor: React core (most stable, rarely changes) ─────────────
          if (id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')) {
            return 'vendor-react';
          }

          // ── Vendor: Routing ──────────────────────────────────────────────
          if (id.includes('node_modules/react-router')) {
            return 'vendor-router';
          }

          // ── Vendor: Data fetching ────────────────────────────────────────
          if (id.includes('node_modules/@tanstack/') ||
              id.includes('node_modules/axios')) {
            return 'vendor-query';
          }

          // ── Vendor: UI icons (lucide is large) ──────────────────────────
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-lucide';
          }

          // ── Vendor: Charts (only used in analytics) ──────────────────────
          if (id.includes('node_modules/chart.js') ||
              id.includes('node_modules/react-chartjs-2')) {
            return 'vendor-charts';
          }

          // ── Vendor: Animation (framer-motion is ~120kb gzipped) ──────────
          if (id.includes('node_modules/framer-motion')) {
            return 'vendor-framer';
          }

          // ── Vendor: All other node_modules ───────────────────────────────
          if (id.includes('node_modules')) {
            return 'vendor-misc';
          }

          // ── App: Shared utilities / contexts ─────────────────────────────
          if (id.includes('/services/api')) return 'chunk-api';
          if (id.includes('AuthContext'))   return 'chunk-auth-context';

          // ── App: Heavy shared pages ───────────────────────────────────────
          if (id.includes('SettingsPage'))      return 'chunk-settings';
          if (id.includes('GamificationPage'))  return 'chunk-gamification';

          // All other app code — let Vite's automatic splitting handle it.
          // Route-level lazy() boundaries already create good chunks.
        },

        // Stable filenames for long-lived browser cache (assets never change
        // once deployed, so we can set Cache-Control: max-age=31536000)
        entryFileNames:  'assets/[name]-[hash].js',
        chunkFileNames:  'assets/[name]-[hash].js',
        assetFileNames:  'assets/[name]-[hash].[ext]',
      },
    },

    // Minifier: Vite 8 uses oxc (Rust-based, fastest) by default — no override needed.
    // sourcemap: false, // set to true when adding Sentry
  },
});
