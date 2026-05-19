import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { log } from './src/logger.js';
import { PORT, RAINDROP_TOKEN, COLLECTION_ID } from './src/config.js';
import { initDb, getVideoCount } from './src/db.js';
import { syncCollection } from './src/sync.js';
import router from './src/routes.js';

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Startup checks ---------------------------------------------------
log('info', 'Starting YouTV', { PORT, COLLECTION_ID, RAINDROP_TOKEN_SET: !!RAINDROP_TOKEN });
if (!RAINDROP_TOKEN) log('error', 'RAINDROP_TOKEN is not set — requests to Raindrop API will fail');

// --- Database ---------------------------------------------------------
initDb();

// Auto-sync on first run (empty library)
if (getVideoCount() === 0) {
  log('info', 'Library is empty — running initial sync in background');
  syncCollection().catch(err => log('error', 'Initial auto-sync failed', { error: err.message }));
}

// --- Middleware -------------------------------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () =>
    log('info', 'HTTP', { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start })
  );
  next();
});

app.use(express.static(join(__dirname, 'public')));
app.use('/api', router);

// --- Start ------------------------------------------------------------
app.listen(PORT, () => log('info', 'YouTV listening', { port: PORT }));
