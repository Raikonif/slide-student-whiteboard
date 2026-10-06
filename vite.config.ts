import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // `pnpm dev:api` serves the Pages Functions + local D1 on 8788
    proxy: { '/api': 'http://localhost:8788' },
  },
})
