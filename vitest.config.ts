import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    env: {
      JWT_ACCESS_SECRET: 'test_access_secret',
      JWT_REFRESH_SECRET: 'test_refresh_secret',
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/express_ts_test',
    },
    globalSetup: './src/__tests__/global-setup.ts',
  },
});
