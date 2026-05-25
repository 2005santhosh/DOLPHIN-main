import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Force each problematic file into its own isolated chunk
          if (id.includes('SettingsPage')) return 'chunk-settings';
          if (id.includes('GamificationPage')) return 'chunk-gamification';
          if (id.includes('VerificationModal')) return 'chunk-verification-modal';
          if (id.includes('VerifiedBadge')) return 'chunk-verified-badge';
          if (id.includes('AuthContext')) return 'chunk-auth-context';
          if (id.includes('/services/api')) return 'chunk-api';
          // Vendor splits
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) return 'vendor-lucide';
            if (id.includes('react-dom')) return 'vendor-react-dom';
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('axios')) return 'vendor-axios';
            return 'vendor-misc';
          }
        },
      },
    },
  },
})
