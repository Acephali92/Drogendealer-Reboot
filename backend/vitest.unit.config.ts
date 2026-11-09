import { defineConfig } from 'vitest/config';

/** Unit tests without a database (domain layer). Used by `npm run test:unit`. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/domain/**/*.test.ts'],
  },
});
