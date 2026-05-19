import { log } from './logger.js';

export async function fetchStatus() {
  log.info('Calling GET /api/status');
  const res = await fetch('/api/status');
  if (!res.ok) throw new Error(`Status fetch failed: ${res.status}`);
  return res.json(); // { lastSyncedAt, videoCount }
}

export async function syncLibrary() {
  log.info('Calling POST /api/sync');
  const t0 = performance.now();

  const res = await fetch('/api/sync', { method: 'POST' });
  const data = await res.json();
  const elapsed = Math.round(performance.now() - t0);

  log.info('Sync response', { status: res.status, elapsed: `${elapsed}ms`, ...data });
  if (!res.ok) throw new Error(data.error ?? `Sync failed ${res.status}`);
  return data; // { totalRemote, added, removed, syncedAt, videoCount, … }
}

export async function fetchPlaylist() {
  log.info('Calling GET /api/playlist');
  const t0 = performance.now();

  const res = await fetch('/api/playlist');
  const data = await res.json();
  const elapsed = Math.round(performance.now() - t0);

  log.info('Playlist response', { status: res.status, elapsed: `${elapsed}ms`, videos: data.playlist?.length });
  if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
  return data; // { playlist, totalSeconds }
}

export async function removeRaindrop(raindropId) {
  log.info('Calling DELETE /api/raindrop/:id', { raindropId });

  const res = await fetch(`/api/raindrop/${raindropId}`, { method: 'DELETE' });
  log.info('DELETE response', { raindropId, status: res.status });

  if (!res.ok) throw new Error(`Server responded ${res.status}`);
}
