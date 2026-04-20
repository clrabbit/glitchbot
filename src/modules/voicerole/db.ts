import db from '../../database';

export interface VoiceActivity {
  user_id: string;
  guild_id: string;
  last_active: number;
}

export function upsertActivity(userId: string, guildId: string, lastActive: number): void {
  db.prepare(`
    INSERT INTO voice_activity (user_id, guild_id, last_active)
    VALUES (?, ?, ?)
    ON CONFLICT (user_id, guild_id) DO UPDATE SET last_active = excluded.last_active
  `).run(userId, guildId, lastActive);
}

export function getExpiredUsers(cutoff: number): VoiceActivity[] {
  return db.prepare('SELECT * FROM voice_activity WHERE last_active < ?').all(cutoff) as VoiceActivity[];
}

export function hasActivity(userId: string, guildId: string): boolean {
  return !!db.prepare('SELECT 1 FROM voice_activity WHERE user_id = ? AND guild_id = ?').get(userId, guildId);
}

export function deleteActivity(userId: string, guildId: string): void {
  db.prepare('DELETE FROM voice_activity WHERE user_id = ? AND guild_id = ?').run(userId, guildId);
}
