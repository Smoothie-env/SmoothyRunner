import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    build: {
      rollupOptions: {
        input: resolve('electron/main.ts'),
        external: ['chokidar', 'fast-xml-parser']
      }
    }
  },
  preload: {
    build: {
      rollupOptions: {
        input: resolve('electron/preload.ts')
      }
    }
  },
  renderer: {
    root: 'src',
    build: {
      rollupOptions: {
        input: resolve('src/index.html')
      }
    },
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve('src')
      }
    }
  }
})
