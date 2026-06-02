import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals:     true,
    coverage: {
      provider:  'v8',
      reporter:  ['text', 'lcov'],
      include:   ['src/**/*.ts', 'src/**/*.tsx'],
      exclude:   ['src/**/*.test.ts', 'src/**/*.spec.ts', 'src/app/**/*.tsx'],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
