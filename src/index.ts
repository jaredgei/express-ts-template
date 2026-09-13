import { createApp } from '@/app';
import { client, testConnection } from '@/utils/database';
import { env } from '@/utils/env';
import { deleteExpiredSessions } from '@/utils/session';

const SESSION_CLEANUP_INTERVAL_MS = 1000 * 60 * 60;

(async () => {
  try {
    await testConnection();
    const app = await createApp();

    await deleteExpiredSessions();
    const cleanup = setInterval(() => deleteExpiredSessions().catch(console.error), SESSION_CLEANUP_INTERVAL_MS);
    cleanup.unref();

    const server = app.listen(env.PORT, () => console.log(`Server is listening on port ${env.PORT}`));

    const shutdown = (signal: string) => {
      console.log(`${signal} received, shutting down`);
      clearInterval(cleanup);
      server.close(async () => {
        await client.end();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
