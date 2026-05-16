import { log } from './logger.js';
import { formatDuration, escHtml } from './utils.js';
import { updateTotalAfterRemove } from './ui.js';
import { removeRaindrop } from './api.js';

export function renderCard(video) {
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.id = video.raindropId;
  card.dataset.seconds = video.durationSeconds;

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

async function removeVideo(card, raindropId) {
  const btn = card.querySelector('.remove-btn');
  btn.disabled = true;
  btn.textContent = '…';
  log.info('Removing video', { raindropId });

  try {
    await removeRaindrop(raindropId);
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
