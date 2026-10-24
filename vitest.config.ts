import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    testTimeout: 30000,
    maxWorkers: 4,
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
