import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

// Конфиг сборки библиотеки
export default defineConfig({
  test: {
    environment: 'jsdom',
  },
  plugins: [
    dts({
      include: ['src'],
      outDir: 'dist',
    }),
  ],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        vue: resolve(__dirname, 'src/adapters/vue/index.ts'),
        react: resolve(__dirname, 'src/adapters/react/index.ts'),
      },
      formats: ['es', 'cjs'],
      name: 'Svgic',
    },
    rollupOptions: {
      external: ['vue', 'react'],
      output: {
        globals: {
          vue: 'Vue',
          react: 'React',
        },
      },
    },
  },
  resolve: {
    alias: {
      svgic: resolve(__dirname, 'src/index.ts'),
    },
  },
})
