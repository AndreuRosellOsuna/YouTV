import { log } from './logger.js';
import { DURATION_CONCURRENCY } from './config.js';
import { fetchAllRaindrops } from './raindrop.js';
import { extractVideoId, fetchDuration, thumbnailUrl } from './youtube.js';
import { getAllRaindropIds, upsertVideo, deleteVideo, getVideoCount, getMeta, setMeta } from './db.js';

export function getSyncStatus() {
  return {
    lastSyncedAt: getMeta('last_synced_at'),
    videoCount:   getVideoCount(),
  };
}

export async function syncCollection() {
  log('info', 'Sync started');
  const t0 = Date.now();

  // 1. Fetch all raindrops from Raindrop API
  const raindrops = await fetchAllRaindrops();

  // 2. Filter to YouTube links only
  const remoteItems = raindrops
    .map(r => ({
      raindropId: String(r._id),
      title:      r.title,
      url:        r.link,
      videoId:    extractVideoId(r.link),
    }))
    .filter(r => r.videoId !== null);

  const remoteIds = new Set(remoteItems.map(r => r.raindropId));
  const localIds  = new Set(getAllRaindropIds());

  // 3. Diff: what's new vs what's been deleted in Raindrop
  const newItems   = remoteItems.filter(r => !localIds.has(r.raindropId));
  const removedIds = [...localIds].filter(id => !remoteIds.has(id));

  log('info', 'Sync diff', {
    remote: remoteItems.length,
    local:  localIds.size,
    new:    newItems.length,
    removed: removedIds.length,
  });

  // 4. Remove items deleted from Raindrop
  for (const id of removedIds) {
    deleteVideo(id);
    log('debug', 'Removed from DB (no longer in Raindrop)', { raindropId: id });
  }

  // 5. Fetch durations for new items and store
  let added = 0;
  let durationMissing = 0;

  for (let i = 0; i < newItems.length; i += DURATION_CONCURRENCY) {
    const batch = newItems.slice(i, i + DURATION_CONCURRENCY);
    await Promise.all(batch.map(async item => {
      const secs = await fetchDuration(item.videoId);
      const valid = secs && secs >= 60;
      upsertVideo({
        raindropId:      item.raindropId,
        title:           item.title,
        url:             item.url,
        videoId:         item.videoId,
        durationSeconds: valid ? secs : null,
        thumbnail:       thumbnailUrl(item.videoId),
      });
      if (valid) added++;
      else durationMissing++;
    }));
    log('debug', 'New-items batch done', { batch: Math.floor(i / DURATION_CONCURRENCY) + 1 });
  }

  // 6. Persist sync timestamp
  const syncedAt = new Date().toISOString();
  setMeta('last_synced_at', syncedAt);

  const stats = {
    totalRemote:     remoteItems.length,
    added,
    removed:         removedIds.length,
    durationMissing,
    elapsedMs:       Date.now() - t0,
    syncedAt,
    videoCount:      getVideoCount(),
  };
  log('info', 'Sync complete', stats);
  return stats;
}
