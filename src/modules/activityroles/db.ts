import db from '../../database';

export type ActivityType = 'voice' | 'text' | 'signal';

export interface ActivityRow {
  user_id: string;
  guild_id: string;
  type: ActivityType;
  last_active: number;
}

export function upsertActivity(userId: string, guildId: string, type: ActivityType, lastActive: number): void {
  db.prepare(`
    INSERT INTO activity (user_id, guild_id, type, last_active)
    VALUES (?, ?, ?, ?)
    ON CONFLICT (user_id, guild_id, type) DO UPDATE SET last_active = excluded.last_active
  `).run(userId, guildId, type, lastActive);
}

export function getExpired(type: ActivityType, cutoff: number): ActivityRow[] {
  return db.prepare('SELECT * FROM activity WHERE type = ? AND last_active < ?').all(type, cutoff) as ActivityRow[];
}

export function hasActivity(userId: string, guildId: string, type: ActivityType): boolean {
  return !!db.prepare('SELECT 1 FROM activity WHERE user_id = ? AND guild_id = ? AND type = ?').get(userId, guildId, type);
}

export function deleteActivity(userId: string, guildId: string, type: ActivityType): void {
  db.prepare('DELETE FROM activity WHERE user_id = ? AND guild_id = ? AND type = ?').run(userId, guildId, type);
}
