import { log } from './logger.js';
import { formatDuration } from './utils.js';

export const generateBtn    = document.getElementById('generateBtn');
export const totalDurationEl = document.getElementById('totalDuration');
export const statusEl       = document.getElementById('status');
export const playlistEl     = document.getElementById('playlist');

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

export function showTotal(totalSeconds) {
  totalDurationEl.textContent = `Total: ${formatDuration(totalSeconds)}`;
  totalDurationEl.hidden = false;
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
