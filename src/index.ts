import { client, testConnection } from '@/utils/database';
import { env } from '@/utils/env';
import { logJson } from '@/utils/logger';
import { deleteExpiredSessions } from '@/utils/session';

import { createApp } from '@/app';

const SESSION_CLEANUP_INTERVAL_MS = 1000 * 60 * 60;

(async () => {
  try {
    await testConnection();
    const app = await createApp();

    await deleteExpiredSessions();
    const cleanup = setInterval(
      () => deleteExpiredSessions().catch((error) => logJson({ message: 'Session cleanup failed', error: String(error) }, true)),
      SESSION_CLEANUP_INTERVAL_MS,
    );
    cleanup.unref();

    const server = app.listen(env.PORT, () => logJson({ message: `Server is listening on port ${env.PORT}` }));

    let shuttingDown = false;
    const shutdown = (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logJson({ message: `${signal} received, shutting down` });
      clearInterval(cleanup);
      const force = setTimeout(() => process.exit(1), 10000);
      force.unref();
      server.close(async () => {
        try {
          await client.end({ timeout: 5 });
        } catch (error) {
          logJson({ message: 'Failed to close database pool', error: String(error) }, true);
        } finally {
          clearTimeout(force);
          process.exit(0);
        }
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (error) {
    logJson({ message: 'Startup failed', error: String(error) }, true);
    process.exit(1);
  }
})();
