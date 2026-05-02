const generateBtn = document.getElementById('generateBtn');
const totalDurationEl = document.getElementById('totalDuration');
const statusEl = document.getElementById('status');
const playlistEl = document.getElementById('playlist');

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

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function removeVideo(card, raindropId) {
  const btn = card.querySelector('.remove-btn');
  btn.disabled = true;
  btn.textContent = '…';

  try {
    const res = await fetch(`/api/raindrop/${raindropId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Delete failed');
    card.classList.add('removing');
    card.addEventListener('transitionend', () => {
      card.remove();
      updateTotalAfterRemove();
    }, { once: true });
  } catch {
    btn.disabled = false;
    btn.textContent = '✕ Remove';
    alert('Failed to remove video. Check the console.');
  }
}

function updateTotalAfterRemove() {
  const remaining = [...playlistEl.querySelectorAll('.card')];
  if (remaining.length === 0) {
    totalDurationEl.hidden = true;
    return;
  }
  // total is tracked via data attributes set at render time
  const total = remaining.reduce((sum, c) => sum + parseInt(c.dataset.seconds ?? 0), 0);
  totalDurationEl.textContent = `Total: ${formatDuration(total)}`;
}

async function generatePlaylist() {
  generateBtn.disabled = true;
  generateBtn.textContent = 'Generating…';
  playlistEl.innerHTML = '';
  totalDurationEl.hidden = true;
  showStatus('Fetching your Raindrop collection…');

  try {
    const res = await fetch('/api/playlist');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? 'Unknown error');

    hideStatus();
    totalDurationEl.textContent = `Total: ${formatDuration(data.totalSeconds)}`;
    totalDurationEl.hidden = false;

    for (const video of data.playlist) {
      const card = renderCard(video);
      card.dataset.seconds = video.durationSeconds;
      playlistEl.appendChild(card);
    }
  } catch (err) {
    showStatus(`Error: ${err.message}`);
  } finally {
    generateBtn.disabled = false;
    generateBtn.textContent = 'Generate Playlist';
  }
}

generateBtn.addEventListener('click', generatePlaylist);
