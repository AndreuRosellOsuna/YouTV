import { log } from './logger.js';
import { MIN_SECONDS, MAX_SECONDS } from './config.js';
import { getAllVideos } from './db.js';

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

// Synchronous — reads only from the local DB, no external API calls
export function buildPlaylist() {
  const rows = getAllVideos();

  const videos = rows.map(r => ({
    raindropId:      r.raindrop_id,
    title:           r.title,
    url:             r.url,
    videoId:         r.video_id,
    durationSeconds: r.duration_seconds,
    thumbnail:       r.thumbnail,
  }));

  if (videos.length === 0) {
    throw new Error('No videos in library — run a sync first.');
  }

  const { playlist, totalSeconds } = pickVideos(videos);
  log('info', 'Playlist built', { videos: playlist.length, totalSeconds });
  return { playlist, totalSeconds };
}
