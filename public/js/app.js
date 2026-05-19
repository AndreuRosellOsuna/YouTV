import { log } from './logger.js';
import {
  generateBtn, syncBtn, playlistEl,
  showStatus, hideStatus, setGenerating, setSyncing, showTotal, showSyncInfo,
} from './ui.js';
import { fetchStatus, syncLibrary, fetchPlaylist } from './api.js';
import { renderCard } from './card.js';

// --- Load status on startup -------------------------------------------
async function loadStatus() {
  try {
    const status = await fetchStatus();
    showSyncInfo(status);
    log.info('Status loaded', status);
  } catch (err) {
    log.warn('Could not load status', { error: err.message });
  }
}

// --- Sync library -----------------------------------------------------
async function handleSync() {
  log.info('Sync button clicked');
  setSyncing(true);
  showStatus('Syncing with Raindrop… this may take a minute.');

  try {
    const stats = await syncLibrary();
    hideStatus();
    showSyncInfo({ lastSyncedAt: stats.syncedAt, videoCount: stats.videoCount });
    log.info('Sync done', stats);
  } catch (err) {
    log.error('Sync failed', { error: err.message });
    showStatus(`Sync error: ${err.message}`);
  } finally {
    setSyncing(false);
  }
}

// --- Generate playlist ------------------------------------------------
async function generatePlaylist() {
  log.info('Generate playlist clicked');
  setGenerating(true);
  playlistEl.innerHTML = '';
  showStatus('Building playlist from library…');

  try {
    const { playlist, totalSeconds } = await fetchPlaylist();

    hideStatus();
    showTotal(totalSeconds);

    for (const video of playlist) {
      log.info('Rendering card', { raindropId: video.raindropId, title: video.title, durationSeconds: video.durationSeconds });
      playlistEl.appendChild(renderCard(video));
    }

    log.info('Playlist rendered', { count: playlist.length, totalSeconds });
  } catch (err) {
    log.error('generatePlaylist failed', { error: err.message });
    showStatus(`Error: ${err.message}`);
  } finally {
    setGenerating(false);
  }
}

// --- Wire up ----------------------------------------------------------
generateBtn.addEventListener('click', generatePlaylist);
syncBtn.addEventListener('click', handleSync);

loadStatus();
log.info('app.js loaded');
