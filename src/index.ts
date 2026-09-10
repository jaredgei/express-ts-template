import { exit } from 'process';

import { createApp } from './app';
import { testConnection } from './utils/database';
import { deleteExpiredSessions } from './utils/session';

const PORT = process.env.PORT || 8008;
const SESSION_CLEANUP_INTERVAL_MS = 1000 * 60 * 60;

(async () => {
  try {
    await testConnection();
    const app = await createApp();

    await deleteExpiredSessions();
    setInterval(() => deleteExpiredSessions().catch(console.error), SESSION_CLEANUP_INTERVAL_MS).unref();

    app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));
  } catch (error) {
    console.error(error);
    exit(1);
  }
})();
