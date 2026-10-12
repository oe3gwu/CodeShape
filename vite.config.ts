import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { filesApiPlugin } from './server/filesApi'
import { inferenceApiPlugin } from './server/inferenceApi'

export default defineConfig({
  plugins: [react(), filesApiPlugin(), inferenceApiPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
  },
  worker: {
    format: 'es',
  },
})
