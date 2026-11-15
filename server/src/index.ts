import { env } from './env.js';
import { createApp, prepare } from './app.js';

prepare()
  .then(() => {
    createApp().listen(env.port, () => {
      console.log(`crm-practice-server listening on :${env.port} (${env.databaseUrl ? 'PostgreSQL' : 'PGlite'})`);
    });
  })
  .catch((error) => {
    console.error('The server could not start', error);
    process.exit(1);
  });
