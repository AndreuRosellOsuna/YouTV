import { log } from './logger.js';
import { generateBtn, playlistEl, showStatus, hideStatus, setGenerating, showTotal } from './ui.js';
import { fetchPlaylist } from './api.js';
import { renderCard } from './card.js';

async function generatePlaylist() {
  log.info('Generate playlist clicked');
  setGenerating(true);
  playlistEl.innerHTML = '';
  showStatus('Fetching your Raindrop collection…');

  try {
    const { playlist, totalSeconds } = await fetchPlaylist();

    hideStatus();
    showTotal(totalSeconds);

    for (const video of playlist) {
      log.info('Rendering card', { raindropId: video.raindropId, title: video.title, durationSeconds: video.durationSeconds });
      playlistEl.appendChild(renderCard(video));
    }

    log.info('Playlist rendered', { count: playlist.length, totalSeconds });
  } catch (err) {
    log.error('generatePlaylist failed', { error: err.message });
    showStatus(`Error: ${err.message}`);
  } finally {
    setGenerating(false);
  }
}

generateBtn.addEventListener('click', generatePlaylist);
log.info('app.js loaded');
