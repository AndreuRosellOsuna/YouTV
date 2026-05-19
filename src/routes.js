import { Router } from 'express';
import { log } from './logger.js';
import { buildPlaylist } from './playlist.js';
import { deleteRaindrop } from './raindrop.js';
import { deleteVideo } from './db.js';
import { syncCollection, getSyncStatus } from './sync.js';

const router = Router();

// GET /api/status — library stats and last sync time
router.get('/status', (req, res) => {
  try {
    res.json(getSyncStatus());
  } catch (err) {
    log('error', 'Error in GET /api/status', { error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sync — pull from Raindrop + YouTube, update local DB
router.post('/sync', async (req, res) => {
  log('info', 'POST /api/sync requested');
  try {
    const stats = await syncCollection();
    res.json(stats);
  } catch (err) {
    log('error', 'Error in POST /api/sync', { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

// GET /api/playlist — build playlist from local DB (fast, no external calls)
router.get('/playlist', (req, res) => {
  log('info', 'GET /api/playlist requested');
  try {
    const { playlist, totalSeconds } = buildPlaylist();
    res.json({ playlist, totalSeconds });
  } catch (err) {
    log('error', 'Error in GET /api/playlist', { error: err.message });
    const status = err.message.includes('No videos') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

// DELETE /api/raindrop/:id — remove from Raindrop + local DB
router.delete('/raindrop/:id', async (req, res) => {
  const { id } = req.params;
  log('info', 'DELETE /api/raindrop/:id', { id });
  try {
    await deleteRaindrop(id);
    deleteVideo(id);
    res.sendStatus(204);
  } catch (err) {
    log('error', 'Error in DELETE /api/raindrop/:id', { id, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

export default router;
