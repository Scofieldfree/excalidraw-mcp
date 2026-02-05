import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, 'web'),
  build: {
    outDir: path.resolve(__dirname, 'web-dist'),
    emptyDirBeforeWrite: true,
  },
  server: {
    port: 3100,
    open: false,
  },
  define: {
    'process.env': {},
  },
})
