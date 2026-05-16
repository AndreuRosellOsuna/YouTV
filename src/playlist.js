import { log } from './logger.js';
import { MIN_SECONDS, MAX_SECONDS, DURATION_CONCURRENCY } from './config.js';
import { fetchAllRaindrops } from './raindrop.js';
import { extractVideoId, fetchDuration, thumbnailUrl } from './youtube.js';

function shuffle(arr) {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function pickVideos(videos) {
  const shuffled = shuffle(videos);
  const playlist = [];
  let total = 0;

  for (const v of shuffled) {
    if (total + v.durationSeconds <= MAX_SECONDS) {
      playlist.push(v);
      total += v.durationSeconds;
      if (total >= MIN_SECONDS) break;
    }
  }

  // Still under 30 min — relax ceiling by 5 min and try one more
  if (total < MIN_SECONDS) {
    for (const v of shuffled) {
      if (playlist.includes(v)) continue;
      if (total + v.durationSeconds <= MAX_SECONDS + 300) {
        playlist.push(v);
        total += v.durationSeconds;
        break;
      }
    }
  }

  return { playlist, totalSeconds: total };
}

export async function buildPlaylist() {
  // 1. Fetch all raindrops
  const raindrops = await fetchAllRaindrops();

  // 2. Filter to YouTube links and extract video IDs
  const ytItems = raindrops
    .map(r => ({ raindropId: r._id, title: r.title, url: r.link, videoId: extractVideoId(r.link) }))
    .filter(r => r.videoId !== null);

  log('info', 'YouTube items extracted', {
    total: raindrops.length,
    youtube: ytItems.length,
    skipped: raindrops.length - ytItems.length,
  });

  // 3. Resolve durations in concurrent batches
  const videos = [];
  for (let i = 0; i < ytItems.length; i += DURATION_CONCURRENCY) {
    const batch = ytItems.slice(i, i + DURATION_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async item => {
        const secs = await fetchDuration(item.videoId);
        if (!secs || secs < 60) {
          log('warn', 'Skipping video — duration missing or too short', { videoId: item.videoId, secs });
          return null;
        }
        return { ...item, durationSeconds: secs, thumbnail: thumbnailUrl(item.videoId) };
      })
    );
    videos.push(...results.filter(Boolean));
    log('debug', 'Duration batch done', {
      batch: Math.floor(i / DURATION_CONCURRENCY) + 1,
      resolved: results.filter(Boolean).length,
    });
  }

  log('info', 'Durations resolved', { valid: videos.length, skipped: ytItems.length - videos.length });

  if (videos.length === 0) {
    throw new Error('No YouTube videos found in collection');
  }

  // 4. Pick a random set within the target duration window
  const { playlist, totalSeconds } = pickVideos(videos);
  log('info', 'Playlist built', { videos: playlist.length, totalSeconds });

  return { playlist, totalSeconds };
}
