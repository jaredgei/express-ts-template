import { setTimeout as sleep } from 'timers/promises';

import { client, testConnection } from '@/utils/database';
import { env } from '@/utils/env';
import { lifecycle } from '@/utils/lifecycle';
import { errorFields, logJson } from '@/utils/logger';
import { deleteExpiredSessions } from '@/utils/session';

import { createApp } from '@/app';

const SESSION_CLEANUP_INTERVAL_MS = 1000 * 60 * 60;
const SHUTDOWN_TIMEOUT_MS = 10000;

const fail = (message: string, error: unknown) => {
  logJson({ message, ...errorFields(error) }, true);
  process.exit(1);
};

(async () => {
  try {
    await testConnection();
    const app = await createApp();

    await deleteExpiredSessions();
    const cleanup = setInterval(
      () => deleteExpiredSessions().catch((error) => logJson({ message: 'Session cleanup failed', ...errorFields(error) }, true)),
      SESSION_CLEANUP_INTERVAL_MS,
    );
    cleanup.unref();

    const server = app.listen(env.PORT, (error) => {
      if (error) return fail('Server failed to listen', error);
      logJson({ message: `Server is listening on port ${env.PORT}` });
    });

    const shutdown = async (signal: NodeJS.Signals) => {
      if (lifecycle.shuttingDown) return;
      lifecycle.shuttingDown = true;
      logJson({ message: `${signal} received, shutting down` });
      clearInterval(cleanup);
      setTimeout(() => process.exit(1), env.SHUTDOWN_DRAIN_MS + SHUTDOWN_TIMEOUT_MS).unref();

      // Keep serving while /ready reports 503 so the load balancer deregisters this instance before connections are refused.
      await sleep(env.SHUTDOWN_DRAIN_MS);
      server.close(async () => {
        try {
          await client.end({ timeout: 5 });
        } catch (error) {
          logJson({ message: 'Failed to close database pool', ...errorFields(error) }, true);
        }
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    fail('Startup failed', error);
  }
})();
