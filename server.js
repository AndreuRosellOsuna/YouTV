import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const app = express();
const __dirname = dirname(fileURLToPath(import.meta.url));

const RAINDROP_TOKEN = process.env.RAINDROP_TOKEN;
const COLLECTION_ID = process.env.RAINDROP_COLLECTION_ID ?? '0';
const PORT = process.env.PORT ?? 3000;

const MIN_SECONDS = 1800; // 30 min
const MAX_SECONDS = 2400; // 40 min

// In-memory duration cache: videoId -> seconds
const durationCache = new Map();

const YT_ID_RE = /(?:[?&]v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;

// --- Logger -----------------------------------------------------------
function log(level, msg, data) {
  const entry = { ts: new Date().toISOString(), level, msg, ...data };
  const fn = level === 'error' ? console.error : console.log;
  fn(JSON.stringify(entry));
}

// --- Startup checks ---------------------------------------------------
log('info', 'Starting YouTV', {
  COLLECTION_ID,
  PORT,
  RAINDROP_TOKEN_SET: !!RAINDROP_TOKEN,
});

if (!RAINDROP_TOKEN) {
  log('error', 'RAINDROP_TOKEN is not set — requests to Raindrop API will fail');
}

// --- Helpers ----------------------------------------------------------
function extractVideoId(url) {
  const m = url.match(YT_ID_RE);
  return m ? m[1] : null;
}

function parseIsoDuration(iso) {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!m) return 0;
  return (parseInt(m[1] ?? 0) * 3600) + (parseInt(m[2] ?? 0) * 60) + parseInt(m[3] ?? 0);
}

async function fetchDuration(videoId) {
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
    const m = html.match(/"lengthSeconds":"(\d+)"/);
    if (m) {
      const secs = parseInt(m[1]);
      durationCache.set(videoId, secs);
      return secs;
    }
    // fallback: meta itemprop
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

async function fetchAllRaindrops() {
  const items = [];
  let page = 0;
  log('info', 'Fetching raindrops', { collectionId: COLLECTION_ID });
  while (true) {
    const url = `https://api.raindrop.io/rest/v1/raindrops/${COLLECTION_ID}?perpage=50&page=${page}`;
    log('debug', 'Raindrop page request', { page, url });
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${RAINDROP_TOKEN}` },
    });
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

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildPlaylist(videos) {
  const shuffled = shuffle([...videos]);
  const playlist = [];
  let total = 0;

  for (const v of shuffled) {
    if (total + v.durationSeconds <= MAX_SECONDS) {
      playlist.push(v);
      total += v.durationSeconds;
      if (total >= MIN_SECONDS) break;
    }
  }

  // If still under 30 min, try adding one more short video
  if (total < MIN_SECONDS) {
    for (const v of shuffled) {
      if (playlist.includes(v)) continue;
      if (total + v.durationSeconds <= MAX_SECONDS + 300) { // relax by 5 min
        playlist.push(v);
        total += v.durationSeconds;
        break;
      }
    }
  }

  log('info', 'Playlist built', { videos: playlist.length, totalSeconds: total });
  return { playlist, totalSeconds: total };
}

// --- HTTP request logger middleware -----------------------------------
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    log('info', 'HTTP', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - start,
    });
  });
  next();
});

app.use(express.static(join(__dirname, 'public')));

// --- Routes -----------------------------------------------------------
app.get('/api/playlist', async (req, res) => {
  log('info', 'GET /api/playlist requested');
  try {
    const raindrops = await fetchAllRaindrops();
    const allYt = raindrops
      .map(r => ({ raindropId: r._id, title: r.title, url: r.link, videoId: extractVideoId(r.link) }))
      .filter(r => r.videoId !== null);

    log('info', 'YouTube items extracted from raindrops', {
      total: raindrops.length,
      youtube: allYt.length,
      skipped: raindrops.length - allYt.length,
    });

    // Fetch durations concurrently (with concurrency limit)
    const CONCURRENCY = 8;
    const videos = [];
    for (let i = 0; i < allYt.length; i += CONCURRENCY) {
      const batch = allYt.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async item => {
          const secs = await fetchDuration(item.videoId);
          if (!secs || secs < 60) {
            log('warn', 'Skipping video — duration missing or too short', { videoId: item.videoId, secs });
            return null;
          }
          return {
            ...item,
            durationSeconds: secs,
            thumbnail: `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`,
          };
        })
      );
      videos.push(...results.filter(Boolean));
      log('debug', 'Duration batch done', { batch: i / CONCURRENCY + 1, resolved: results.filter(Boolean).length });
    }

    log('info', 'Durations resolved', { valid: videos.length, skipped: allYt.length - videos.length });

    if (videos.length === 0) {
      log('warn', 'No valid YouTube videos found');
      return res.status(404).json({ error: 'No YouTube videos found in collection' });
    }

    const { playlist, totalSeconds } = buildPlaylist(videos);
    res.json({ playlist, totalSeconds });
  } catch (err) {
    log('error', 'Error in GET /api/playlist', { error: err.message, stack: err.stack });
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/raindrop/:id', async (req, res) => {
  const { id } = req.params;
  log('info', 'DELETE /api/raindrop/:id', { id });
  try {
    const r = await fetch(`https://api.raindrop.io/rest/v1/raindrop/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${RAINDROP_TOKEN}` },
    });
    if (!r.ok) {
      const body = await r.text().catch(() => '');
      log('error', 'Raindrop delete failed', { id, status: r.status, body });
      throw new Error(`Raindrop delete error: ${r.status}`);
    }
    log('info', 'Raindrop deleted', { id });
    res.sendStatus(204);
  } catch (err) {
    log('error', 'Error in DELETE /api/raindrop/:id', { id, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => log('info', `YouTV listening`, { port: PORT }));
