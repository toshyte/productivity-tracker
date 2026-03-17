import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { copyFileSync, existsSync, mkdirSync } from 'fs'

// Plugin to copy get-window.cs to the output directory
function copyWindowsHelper() {
  return {
    name: 'copy-windows-helper',
    closeBundle() {
      const src = resolve('src/main/get-window.cs')
      const outDir = resolve('out/main')
      const dest = resolve(outDir, 'get-window.cs')
      if (existsSync(src)) {
        if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true })
        copyFileSync(src, dest)
      }
    }
  }
}

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin(), copyWindowsHelper()],
    build: {
      rollupOptions: {
        external: ['better-sqlite3', 'uiohook-napi'],
        input: {
          index: resolve('src/main/index.ts'),
          'uiohook-worker': resolve('src/main/uiohook-worker.ts')
        },
        output: {
          entryFileNames: '[name].js'
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    plugins: [react()]
  }
})
