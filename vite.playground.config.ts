import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// Конфиг для playground (ручное тестирование)
export default defineConfig({
  plugins: [vue()],
  root: 'playground',
  resolve: {
    alias: [
      { find: '@svgic/core/plugins/zoom',  replacement: resolve(__dirname, 'src/plugins/zoom/index.ts') },
      { find: '@svgic/core/plugins/debug', replacement: resolve(__dirname, 'src/plugins/debug/index.ts') },
      { find: '@svgic/core/vue',           replacement: resolve(__dirname, 'src/adapters/vue/index.ts') },
      { find: '@svgic/core/react',         replacement: resolve(__dirname, 'src/adapters/react/index.ts') },
      { find: '@svgic/core',               replacement: resolve(__dirname, 'src/index.ts') },
    ],
  },
})
