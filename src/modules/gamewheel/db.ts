import db from '../../database';

export interface WheelGame {
  id: number;
  guild_id: string;
  name: string;
  added_by: string;
  added_at: number;
}

export interface WheelSpin {
  id: number;
  guild_id: string;
  game_id: number;
  spun_by: string;
  spun_at: number;
  winner_id: string | null;
}

export interface WheelSpinWithGame extends WheelSpin {
  game_name: string;
}

export function addGame(guildId: string, name: string, addedBy: string): WheelGame | null {
  try {
    db.prepare(`
      INSERT INTO wheel_games (guild_id, name, added_by, added_at) VALUES (?, ?, ?, ?)
    `).run(guildId, name, addedBy, Date.now());
    return getGame(guildId, name) ?? null;
  } catch {
    return null; // duplicate
  }
}

export function removeGame(guildId: string, name: string): boolean {
  const result = db.prepare(
    'DELETE FROM wheel_games WHERE guild_id = ? AND name = ?'
  ).run(guildId, name);
  return result.changes > 0;
}

export function getGame(guildId: string, name: string): WheelGame | undefined {
  return db.prepare('SELECT * FROM wheel_games WHERE guild_id = ? AND name = ?').get(guildId, name) as WheelGame | undefined;
}

export function getGames(guildId: string): WheelGame[] {
  return db.prepare('SELECT * FROM wheel_games WHERE guild_id = ? ORDER BY name').all(guildId) as WheelGame[];
}

export function spinWheel(guildId: string, spunBy: string): WheelSpinWithGame | null {
  const games = getGames(guildId);
  if (games.length === 0) return null;
  const game = games[Math.floor(Math.random() * games.length)];
  const result = db.prepare(`
    INSERT INTO wheel_spins (guild_id, game_id, spun_by, spun_at) VALUES (?, ?, ?, ?)
  `).run(guildId, game.id, spunBy, Date.now());
  return getSpin(result.lastInsertRowid as number);
}

export function getSpin(id: number): WheelSpinWithGame | null {
  return db.prepare(`
    SELECT s.*, g.name AS game_name
    FROM wheel_spins s
    JOIN wheel_games g ON g.id = s.game_id
    WHERE s.id = ?
  `).get(id) as WheelSpinWithGame | null;
}

export function setWinner(spinId: number, winnerId: string): boolean {
  const result = db.prepare('UPDATE wheel_spins SET winner_id = ? WHERE id = ?').run(winnerId, spinId);
  return result.changes > 0;
}

export function getRecentSpins(guildId: string, limit = 10): WheelSpinWithGame[] {
  return db.prepare(`
    SELECT s.*, g.name AS game_name
    FROM wheel_spins s
    JOIN wheel_games g ON g.id = s.game_id
    WHERE s.guild_id = ?
    ORDER BY s.spun_at DESC
    LIMIT ?
  `).all(guildId, limit) as WheelSpinWithGame[];
}

export interface WinStat {
  winner_id: string;
  wins: number;
}

export function getWinStats(guildId: string): WinStat[] {
  return db.prepare(`
    SELECT winner_id, COUNT(*) AS wins
    FROM wheel_spins
    WHERE guild_id = ? AND winner_id IS NOT NULL
    GROUP BY winner_id
    ORDER BY wins DESC
    LIMIT 10
  `).all(guildId) as WinStat[];
}
