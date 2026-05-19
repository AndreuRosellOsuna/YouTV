import { log } from './logger.js';
import { formatDuration } from './utils.js';

export const generateBtn     = document.getElementById('generateBtn');
export const syncBtn         = document.getElementById('syncBtn');
export const totalDurationEl = document.getElementById('totalDuration');
export const statusEl        = document.getElementById('status');
export const syncInfoEl      = document.getElementById('syncInfo');
export const playlistEl      = document.getElementById('playlist');

export function showStatus(msg) {
  statusEl.textContent = msg;
  statusEl.hidden = false;
}

export function hideStatus() {
  statusEl.hidden = true;
}

export function setGenerating(loading) {
  generateBtn.disabled = loading;
  generateBtn.textContent = loading ? 'Generating…' : 'Generate Playlist';
}

export function setSyncing(loading) {
  syncBtn.disabled = loading;
  syncBtn.textContent = loading ? '↻ Syncing…' : '↻ Sync Library';
}

export function showTotal(totalSeconds) {
  totalDurationEl.textContent = `Total: ${formatDuration(totalSeconds)}`;
  totalDurationEl.hidden = false;
}

export function showSyncInfo({ lastSyncedAt, videoCount }) {
  if (!lastSyncedAt) {
    syncInfoEl.textContent = `${videoCount} videos — never synced`;
    return;
  }
  const when = new Date(lastSyncedAt);
  const diff  = Math.round((Date.now() - when) / 60000); // minutes ago
  const label = diff < 1   ? 'just now'
              : diff < 60  ? `${diff}m ago`
              : diff < 1440 ? `${Math.floor(diff / 60)}h ago`
              : when.toLocaleDateString();
  syncInfoEl.textContent = `${videoCount} videos in library · last synced ${label}`;
  log.info('Sync info shown', { videoCount, lastSyncedAt, label });
}

export function updateTotalAfterRemove() {
  const remaining = [...playlistEl.querySelectorAll('.card')];
  if (remaining.length === 0) {
    totalDurationEl.hidden = true;
    return;
  }
  const total = remaining.reduce((sum, c) => sum + parseInt(c.dataset.seconds ?? 0), 0);
  totalDurationEl.textContent = `Total: ${formatDuration(total)}`;
  log.info('Total updated after remove', { remainingCards: remaining.length, totalSeconds: total });
}
