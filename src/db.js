import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import { log } from './logger.js';
import { DB_PATH } from './config.js';

let db;

export function initDb() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL'); // better concurrent read performance

  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      raindrop_id  TEXT PRIMARY KEY,
      title        TEXT NOT NULL,
      url          TEXT NOT NULL,
      video_id     TEXT NOT NULL,
      duration_seconds INTEGER,
      thumbnail    TEXT,
      added_at     TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS meta (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  log('info', 'Database initialized', { path: DB_PATH });
}

// --- Videos -----------------------------------------------------------

export function getAllVideos() {
  return db
    .prepare('SELECT * FROM videos WHERE duration_seconds IS NOT NULL AND duration_seconds >= 60')
    .all();
}

export function getAllRaindropIds() {
  return db.prepare('SELECT raindrop_id FROM videos').all().map(r => r.raindrop_id);
}

export function getVideoCount() {
  return db.prepare('SELECT COUNT(*) as count FROM videos WHERE duration_seconds IS NOT NULL AND duration_seconds >= 60').get().count;
}

export function upsertVideo({ raindropId, title, url, videoId, durationSeconds, thumbnail }) {
  db.prepare(`
    INSERT INTO videos (raindrop_id, title, url, video_id, duration_seconds, thumbnail)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(raindrop_id) DO UPDATE SET
      title            = excluded.title,
      url              = excluded.url,
      duration_seconds = COALESCE(excluded.duration_seconds, videos.duration_seconds),
      thumbnail        = COALESCE(excluded.thumbnail, videos.thumbnail)
  `).run(raindropId, title, url, videoId, durationSeconds ?? null, thumbnail ?? null);
}

export function deleteVideo(raindropId) {
  db.prepare('DELETE FROM videos WHERE raindrop_id = ?').run(raindropId);
}

// --- Meta -------------------------------------------------------------

export function getMeta(key) {
  return db.prepare('SELECT value FROM meta WHERE key = ?').get(key)?.value ?? null;
}

export function setMeta(key, value) {
  db.prepare('INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)').run(key, String(value));
}
