import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/express_ts_test',
    },
    globalSetup: './src/__tests__/global-setup.ts',
  },
});
