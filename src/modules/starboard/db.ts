import db from '../../database';

export interface StarboardPost {
  message_id: string;
  guild_id: string;
  channel_id: string;
  starboard_message_id: string;
  star_count: number;
}

export function getPost(messageId: string): StarboardPost | undefined {
  return db.prepare('SELECT * FROM starboard_posts WHERE message_id = ?').get(messageId) as StarboardPost | undefined;
}

export function insertPost(post: StarboardPost): void {
  db.prepare(`
    INSERT INTO starboard_posts (message_id, guild_id, channel_id, starboard_message_id, star_count)
    VALUES (@message_id, @guild_id, @channel_id, @starboard_message_id, @star_count)
  `).run(post);
}

export function updateStarCount(messageId: string, starCount: number): void {
  db.prepare('UPDATE starboard_posts SET star_count = ? WHERE message_id = ?').run(starCount, messageId);
}
