import { log } from './logger.js';
import { RAINDROP_TOKEN, COLLECTION_ID } from './config.js';

const API_BASE = 'https://api.raindrop.io/rest/v1';

function authHeaders() {
  return { Authorization: `Bearer ${RAINDROP_TOKEN}` };
}

export async function fetchAllRaindrops() {
  const items = [];
  let page = 0;
  log('info', 'Fetching raindrops', { collectionId: COLLECTION_ID });

  while (true) {
    const url = `${API_BASE}/raindrops/${COLLECTION_ID}?perpage=50&page=${page}`;
    log('debug', 'Raindrop page request', { page, url });

    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      log('error', 'Raindrop API error', { status: res.status, body });
      throw new Error(`Raindrop API error: ${res.status}`);
    }

    const data = await res.json();
    const batch = data.items ?? [];
    log('debug', 'Raindrop page received', { page, count: batch.length });
    items.push(...batch);
    if (batch.length < 50) break;
    page++;
  }

  log('info', 'All raindrops fetched', { total: items.length });
  return items;
}

export async function deleteRaindrop(id) {
  log('info', 'Deleting raindrop', { id });
  const res = await fetch(`${API_BASE}/raindrop/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    log('error', 'Raindrop delete failed', { id, status: res.status, body });
    throw new Error(`Raindrop delete error: ${res.status}`);
  }

  log('info', 'Raindrop deleted', { id });
}
