import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// Конфиг для playground (ручное тестирование)
export default defineConfig({
  plugins: [vue()],
  root: 'playground',
  resolve: {
    alias: {
      svgic: resolve(__dirname, 'src/index.ts'),
      'svgic/vue': resolve(__dirname, 'src/adapters/vue/index.ts'),
    },
  },
})
