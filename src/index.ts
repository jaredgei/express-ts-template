import { exit } from 'process';
import { createApp } from './app';
import { testConnection } from './utils/database';

const PORT = process.env.PORT || 8001;

(async () => {
  try {
    await testConnection();
    const app = await createApp();
    app.listen(PORT, () => console.log(`Server is listening on port ${PORT}`));
  } catch (error) {
    console.error(error);
    exit(1);
  }
})();
