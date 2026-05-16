import { log } from './logger.js';

export async function fetchPlaylist() {
  log.info('Calling GET /api/playlist');
  const t0 = performance.now();

  const res = await fetch('/api/playlist');
  const data = await res.json();
  const elapsed = Math.round(performance.now() - t0);

  log.info('Response received', { status: res.status, elapsed: `${elapsed}ms`, videos: data.playlist?.length });

  if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);
  return data; // { playlist, totalSeconds }
}

export async function removeRaindrop(raindropId) {
  log.info('Calling DELETE /api/raindrop/:id', { raindropId });

  const res = await fetch(`/api/raindrop/${raindropId}`, { method: 'DELETE' });
  log.info('DELETE response', { raindropId, status: res.status });

  if (!res.ok) throw new Error(`Server responded ${res.status}`);
}
