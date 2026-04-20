import Database, { Database as DatabaseType } from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db: DatabaseType = new Database(path.join(dataDir, 'glitch.db'));

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS polls (
    id          TEXT    PRIMARY KEY,
    guild_id    TEXT    NOT NULL,
    channel_id  TEXT    NOT NULL,
    message_id  TEXT,
    creator_id  TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    created_at  INTEGER NOT NULL,
    closed      INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS poll_options (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    poll_id  TEXT    NOT NULL REFERENCES polls(id),
    label    TEXT    NOT NULL,
    position INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS poll_votes (
    poll_id      TEXT    NOT NULL REFERENCES polls(id),
    option_id    INTEGER NOT NULL REFERENCES poll_options(id),
    user_id      TEXT    NOT NULL,
    display_name TEXT,
    PRIMARY KEY (poll_id, option_id, user_id)
  );
`);

// migrate existing DBs that predate display_name column
try {
  db.exec('ALTER TABLE poll_votes ADD COLUMN display_name TEXT');
} catch {
  // column already exists, ignore
}

db.exec(`
  CREATE TABLE IF NOT EXISTS wheel_games (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT    NOT NULL,
    name       TEXT    NOT NULL,
    added_by   TEXT    NOT NULL,
    added_at   INTEGER NOT NULL,
    UNIQUE(guild_id, name)
  );

  CREATE TABLE IF NOT EXISTS wheel_spins (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id   TEXT    NOT NULL,
    game_id    INTEGER NOT NULL REFERENCES wheel_games(id),
    spun_by    TEXT    NOT NULL,
    spun_at    INTEGER NOT NULL,
    winner_id  TEXT
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS voice_activity (
    user_id     TEXT    NOT NULL,
    guild_id    TEXT    NOT NULL,
    last_active INTEGER NOT NULL,
    PRIMARY KEY (user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS activity (
    user_id     TEXT    NOT NULL,
    guild_id    TEXT    NOT NULL,
    type        TEXT    NOT NULL,
    last_active INTEGER NOT NULL,
    PRIMARY KEY (user_id, guild_id, type)
  );
`);

// Migrate legacy voice_activity rows into the unified activity table
db.exec(`
  INSERT OR IGNORE INTO activity (user_id, guild_id, type, last_active)
  SELECT user_id, guild_id, 'voice', last_active FROM voice_activity;
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS starboard_posts (
    message_id          TEXT PRIMARY KEY,
    guild_id            TEXT NOT NULL,
    channel_id          TEXT NOT NULL,
    starboard_message_id TEXT NOT NULL,
    star_count          INTEGER NOT NULL DEFAULT 0
  );
`);

export default db;
