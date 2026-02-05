import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { fileURLToPath } from 'url'

const configDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  root: 'web',
  build: {
    outDir: path.resolve(configDir, 'web-dist'),
    emptyOutDir: true,
  },
  server: {
    port: 3100,
    open: false,
  },
  define: {
    'process.env': {},
  },
})
