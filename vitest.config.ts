import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  // Next's tsconfig sets "jsx": "preserve" (Next compiles JSX itself); esbuild
  // must be told to actually transform it for tests.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['node_modules', '.next', 'android', 'ios'],
  },
});
