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
  if (durationCache.has(videoId)) return durationCache.get(videoId);
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; YouTV/1.0)' },
    });
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
  } catch {
    // ignore, video will be skipped
  }
  return null;
}

async function fetchAllRaindrops() {
  const items = [];
  let page = 0;
  while (true) {
    const url = `https://api.raindrop.io/rest/v1/raindrops/${COLLECTION_ID}?perpage=50&page=${page}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${RAINDROP_TOKEN}` },
    });
    if (!res.ok) throw new Error(`Raindrop API error: ${res.status}`);
    const data = await res.json();
    const batch = data.items ?? [];
    items.push(...batch);
    if (batch.length < 50) break;
    page++;
  }
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

  return { playlist, totalSeconds: total };
}

app.use(express.static(join(__dirname, 'public')));

app.get('/api/playlist', async (req, res) => {
  try {
    const raindrops = await fetchAllRaindrops();
    const ytItems = raindrops
      .map(r => ({ raindropId: r._id, title: r.title, url: r.link, videoId: extractVideoId(r.link) }))
      .filter(r => r.videoId !== null);

    // Fetch durations concurrently (with concurrency limit)
    const CONCURRENCY = 8;
    const videos = [];
    for (let i = 0; i < ytItems.length; i += CONCURRENCY) {
      const batch = ytItems.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map(async item => {
          const secs = await fetchDuration(item.videoId);
          if (!secs || secs < 60) return null; // skip if under 1 min or failed
          return {
            ...item,
            durationSeconds: secs,
            thumbnail: `https://img.youtube.com/vi/${item.videoId}/mqdefault.jpg`,
          };
        })
      );
      videos.push(...results.filter(Boolean));
    }

    if (videos.length === 0) {
      return res.status(404).json({ error: 'No YouTube videos found in collection' });
    }

    const { playlist, totalSeconds } = buildPlaylist(videos);
    res.json({ playlist, totalSeconds });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/raindrop/:id', async (req, res) => {
  try {
    const r = await fetch(`https://api.raindrop.io/rest/v1/raindrop/${req.params.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${RAINDROP_TOKEN}` },
    });
    if (!r.ok) throw new Error(`Raindrop delete error: ${r.status}`);
    res.sendStatus(204);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`YouTV running at http://localhost:${PORT}`));
