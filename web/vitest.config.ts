import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Unit/component tests run in jsdom. Tests live next to source as *.test.ts(x).
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'happy-dom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
