import { config, mailTransport } from './config.js';
import { createApp } from './app.js';
import { startJobs } from './jobs.js';

const app = createApp();

startJobs();

app.listen(config.port, config.host, () => {
  console.log(`Teman Cerita berjalan di http://${config.host}:${config.port} (email: ${mailTransport ?? 'nonaktif'})`);
});
