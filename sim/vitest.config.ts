import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'], globalSetup: ['test/golden-setup.ts'], testTimeout: 60_000 },
});
