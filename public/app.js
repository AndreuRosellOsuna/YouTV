const generateBtn = document.getElementById('generateBtn');
const totalDurationEl = document.getElementById('totalDuration');
const statusEl = document.getElementById('status');
const playlistEl = document.getElementById('playlist');

// --- Logger -----------------------------------------------------------
const log = {
  info:  (msg, data) => console.log( `[YouTV] INFO  ${msg}`, data ?? ''),
  warn:  (msg, data) => console.warn( `[YouTV] WARN  ${msg}`, data ?? ''),
  error: (msg, data) => console.error(`[YouTV] ERROR ${msg}`, data ?? ''),
};

// --- Helpers ----------------------------------------------------------
function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s > 0 ? s + 's' : ''}`.trim();
}

function showStatus(msg) {
  statusEl.textContent = msg;
  statusEl.hidden = false;
}

function hideStatus() {
  statusEl.hidden = true;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderCard(video) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = video.raindropId;

  card.innerHTML = `
    <div class="thumb-wrap">
      <img src="${video.thumbnail}" alt="" loading="lazy" />
      <span class="duration-pill">${formatDuration(video.durationSeconds)}</span>
    </div>
    <div class="card-body">
      <p class="card-title" title="${escHtml(video.title)}">${escHtml(video.title)}</p>
      <div class="card-actions">
        <a class="watch-btn" href="${video.url}" target="_blank" rel="noopener">▶ Watch</a>
        <button class="remove-btn" aria-label="Remove">✕ Remove</button>
      </div>
    </div>
  `;

  card.querySelector('.remove-btn').addEventListener('click', () => removeVideo(card, video.raindropId));
  return card;
}

// --- Remove -----------------------------------------------------------
async function removeVideo(card, raindropId) {
  const btn = card.querySelector('.remove-btn');
  btn.disabled = true;
  btn.textContent = '…';
  log.info('Removing video', { raindropId });

  try {
    const res = await fetch(`/api/raindrop/${raindropId}`, { method: 'DELETE' });
    log.info('DELETE response', { raindropId, status: res.status });
    if (!res.ok) throw new Error(`Server responded ${res.status}`);

    card.classList.add('removing');
    card.addEventListener('transitionend', () => {
      card.remove();
      updateTotalAfterRemove();
      log.info('Card removed from DOM', { raindropId });
    }, { once: true });
  } catch (err) {
    log.error('Failed to remove video', { raindropId, error: err.message });
    btn.disabled = false;
    btn.textContent = '✕ Remove';
    alert(`Failed to remove video: ${err.message}`);
  }
}

function updateTotalAfterRemove() {
  const remaining = [...playlistEl.querySelectorAll('.card')];
  if (remaining.length === 0) {
    totalDurationEl.hidden = true;
    return;
  }
  const total = remaining.reduce((sum, c) => sum + parseInt(c.dataset.seconds ?? 0), 0);
  totalDurationEl.textContent = `Total: ${formatDuration(total)}`;
  log.info('Total updated after remove', { remainingCards: remaining.length, totalSeconds: total });
}

// --- Generate ---------------------------------------------------------
async function generatePlaylist() {
  log.info('Generate playlist clicked');
  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating…';
  playlistEl.innerHTML = '';
  totalDurationEl.hidden = true;
  showStatus('Fetching your Raindrop collection…');

  const t0 = performance.now();

  try {
    log.info('Calling GET /api/playlist');
    const res = await fetch('/api/playlist');
    const data = await res.json();
    const elapsed = Math.round(performance.now() - t0);

    log.info('Response received', { status: res.status, elapsed: `${elapsed}ms`, videos: data.playlist?.length });

    if (!res.ok) throw new Error(data.error ?? `Server error ${res.status}`);

    hideStatus();
    totalDurationEl.textContent = `Total: ${formatDuration(data.totalSeconds)}`;
    totalDurationEl.hidden = false;

    for (const video of data.playlist) {
      log.info('Rendering card', { raindropId: video.raindropId, title: video.title, durationSeconds: video.durationSeconds });
      const card = renderCard(video);
      card.dataset.seconds = video.durationSeconds;
      playlistEl.appendChild(card);
    }

    log.info('Playlist rendered', { count: data.playlist.length, totalSeconds: data.totalSeconds });
  } catch (err) {
    log.error('generatePlaylist failed', { error: err.message });
    showStatus(`Error: ${err.message}`);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Playlist';
  }
}

generateBtn.addEventListener('click', generatePlaylist);
log.info('app.js loaded');
