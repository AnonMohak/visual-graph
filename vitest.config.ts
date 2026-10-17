import { defineConfig } from 'vitest/config'

// Playwright specs in e2e/ run with `npm run e2e`, not Vitest.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
})
