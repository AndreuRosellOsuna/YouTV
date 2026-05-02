# YouTV — Random YouTube Playlist from Raindrop

## Context

The user has a Raindrop.io collection full of YouTube videos they want to watch. The problem is decision paralysis and an ever-growing backlog. This app solves it by generating a curated ~30–40 minute random playlist with one click, and lets them clean up videos they've watched (or don't want) directly from the UI.

---

## Stack

- **Backend:** Node.js + Express — proxies API calls so secrets stay server-side
- **Frontend:** Vanilla JS + HTML/CSS — no build step, fast to ship, easy to maintain
- **APIs:** Raindrop.io REST API

---

## Project Structure

```
YouTV/
├── server.js          # Express server + API routes
├── package.json
├── .env               # RAINDROP_TOKEN, RAINDROP_COLLECTION_ID, PORT
├── .env.example       # Template (committed)
├── .gitignore
├── Dockerfile
└── public/
    ├── index.html
    ├── style.css
    └── app.js
```

---

## Backend API Routes (`server.js`)

### `GET /api/playlist`
1. Fetch **all** raindrops from the configured collection (paginate 50/page until exhausted)
2. Filter to entries whose `link` is a YouTube URL
3. Extract video IDs using regex: `/[?&]v=([a-zA-Z0-9_-]{11})|youtu\.be\/([a-zA-Z0-9_-]{11})/`
4. Fetch duration for each video by fetching `https://www.youtube.com/watch?v=ID` and parsing `"lengthSeconds"` from the embedded page data — **no API key required**
5. Cache fetched durations in memory (in-process Map) so repeat playlist generations don't re-fetch
6. Parse durations to seconds
7. Shuffle the valid videos (Fisher-Yates)
8. Greedily pick videos until total is in **1800–2400 s (30–40 min)**. If we overshoot, try swapping the last pick for a shorter one; if no valid set found, relax to ±5 min.
9. Return array of `{ raindropId, title, url, videoId, durationSeconds, thumbnail }`

> Thumbnail: `https://img.youtube.com/vi/{videoId}/mqdefault.jpg` — no API key needed

### `DELETE /api/raindrop/:id`
- Calls `DELETE https://api.raindrop.io/rest/v1/raindrop/:id`
- Returns 204 on success

---

## Frontend (`public/`)

### `index.html`
- Single page: header + "Generate Playlist" button + playlist container
- Shows total duration of current playlist
- Each video card: thumbnail, title, duration badge, "Watch" link (opens YouTube), "Remove" button

### `app.js`
- On button click: calls `GET /api/playlist`, renders cards, disables button with spinner while loading
- On "Remove" click: calls `DELETE /api/raindrop/:id`, removes card from DOM with a fade animation

### `style.css`
- Clean, dark-themed card grid
- Responsive (works on phone too)

---

## Environment Variables

```
RAINDROP_TOKEN=           # Test token from raindrop.io/app/settings/integrations
RAINDROP_COLLECTION_ID=   # Open the collection in raindrop.io — the ID is the number in the URL
PORT=3000
```

No YouTube API key needed.

---

## Docker

```bash
# Build
docker build -t youtv .

# Run (passing env vars at runtime — never baked into the image)
docker run -d \
  -p 3000:3000 \
  --env-file .env \
  --name youtv \
  youtv
```

---

## Verification

1. Copy `.env.example` → `.env`, fill in real tokens
2. `npm install && node server.js`
3. Open `http://localhost:3000`
4. Click "Generate Playlist" → cards should appear with thumbnails and durations totalling ~30–40 min
5. Click a "Watch" link → opens correct YouTube video
6. Click "Remove" → card disappears; verify in Raindrop that bookmark is in Trash
