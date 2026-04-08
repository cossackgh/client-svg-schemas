import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// Конфиг для playground (ручное тестирование)
export default defineConfig({
  plugins: [vue()],
  root: 'playground',
  resolve: {
    alias: [
      { find: 'svgic/plugins/zoom',  replacement: resolve(__dirname, 'src/plugins/zoom/index.ts') },
      { find: 'svgic/plugins/debug', replacement: resolve(__dirname, 'src/plugins/debug/index.ts') },
      { find: 'svgic/vue',          replacement: resolve(__dirname, 'src/adapters/vue/index.ts') },
      { find: 'svgic',              replacement: resolve(__dirname, 'src/index.ts') },
    ],
  },
})
