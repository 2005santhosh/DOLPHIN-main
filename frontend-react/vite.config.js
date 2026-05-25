import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
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
        // Manually split chunks to prevent circular dependency TDZ issues
        manualChunks(id) {
          // Each dashboard page gets its own chunk
          if (id.includes('/pages/SettingsPage')) return 'SettingsPage';
          if (id.includes('/pages/GamificationPage') || id.includes('/shared/GamificationPage')) return 'GamificationPage';
          if (id.includes('VerificationModal')) return 'VerificationModal';
          if (id.includes('VerifiedBadge')) return 'VerifiedBadge';
          // Vendor chunk
          if (id.includes('node_modules')) {
            if (id.includes('lucide-react')) return 'lucide';
            if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
            return 'vendor';
          }
        },
      },
    },
  },
})
