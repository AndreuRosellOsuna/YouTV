import { log } from './logger.js';

const YT_ID_RE = /(?:[?&]v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;

// In-memory duration cache: videoId -> seconds
const durationCache = new Map();

export function extractVideoId(url) {
  const m = url.match(YT_ID_RE);
  return m ? m[1] : null;
}

function parseIsoDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? 0) * 3600) + (parseInt(m[2] ?? 0) * 60) + parseInt(m[3] ?? 0);
}

export async function fetchDuration(videoId) {
  if (durationCache.has(videoId)) {
    log('debug', 'Duration cache hit', { videoId });
    return durationCache.get(videoId);
  }

  try {
    log('debug', 'Fetching duration from YouTube', { videoId });
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YouTV/1.0)' },
    });

    if (!res.ok) {
      log('warn', 'YouTube page returned non-OK status', { videoId, status: res.status });
      return null;
    }

    const html = await res.text();

    // Primary: lengthSeconds embedded in page JSON
    const m = html.match(/"lengthSeconds":"(\d+)"/);
    if (m) {
      const secs = parseInt(m[1]);
      durationCache.set(videoId, secs);
      return secs;
    }

    // Fallback: meta itemprop ISO 8601
    const m2 = html.match(/itemprop="duration"\s+content="([^"]+)"/);
    if (m2) {
      const secs = parseIsoDuration(m2[1]);
      durationCache.set(videoId, secs);
      return secs;
    }

    log('warn', 'Could not extract duration from YouTube page', { videoId });
  } catch (err) {
    log('error', 'Exception fetching YouTube duration', { videoId, error: err.message });
  }

  return null;
}

export function thumbnailUrl(videoId) {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
}
