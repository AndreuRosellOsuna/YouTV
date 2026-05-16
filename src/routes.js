import { Router } from 'express';
import { log } from './logger.js';
import { buildPlaylist } from './playlist.js';
import { deleteRaindrop } from './raindrop.js';

const router = Router();

router.get('/playlist', async (req, res) => {
  log('info', 'GET /api/playlist requested');
  try {
    const { playlist, totalSeconds } = await buildPlaylist();
    res.json({ playlist, totalSeconds });
  } catch (err) {
    log('error', 'Error in GET /api/playlist', { error: err.message, stack: err.stack });
    const status = err.message.includes('No YouTube videos') ? 404 : 500;
    res.status(status).json({ error: err.message });
  }
});

router.delete('/raindrop/:id', async (req, res) => {
  const { id } = req.params;
  log('info', 'DELETE /api/raindrop/:id', { id });
  try {
    await deleteRaindrop(id);
    res.sendStatus(204);
  } catch (err) {
    log('error', 'Error in DELETE /api/raindrop/:id', { id, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

export default router;
