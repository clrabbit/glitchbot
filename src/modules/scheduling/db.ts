import db from '../../database';
import { randomUUID } from 'crypto';

export interface Poll {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  creator_id: string;
  name: string;
  created_at: number;
  closed: number;
}

export interface PollOption {
  id: number;
  poll_id: string;
  label: string;
  position: number;
}

export interface PollVote {
  poll_id: string;
  option_id: number;
  user_id: string;
  display_name: string | null;
}

export function createPoll(
  guildId: string,
  channelId: string,
  creatorId: string,
  name: string,
  options: string[]
): Poll {
  const id = randomUUID().slice(0, 8);
  db.prepare(`
    INSERT INTO polls (id, guild_id, channel_id, creator_id, name, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, guildId, channelId, creatorId, name, Date.now());

  const insertOption = db.prepare(`
    INSERT INTO poll_options (poll_id, label, position) VALUES (?, ?, ?)
  `);
  options.forEach((label, i) => insertOption.run(id, label.trim(), i));

  return getPoll(id)!;
}

export function getPoll(id: string): Poll | undefined {
  return db.prepare('SELECT * FROM polls WHERE id = ?').get(id) as Poll | undefined;
}

export function getActivePollsForGuild(guildId: string): Poll[] {
  return db.prepare('SELECT * FROM polls WHERE guild_id = ? AND closed = 0 ORDER BY created_at DESC').all(guildId) as Poll[];
}

export function getPollOptions(pollId: string): PollOption[] {
  return db.prepare('SELECT * FROM poll_options WHERE poll_id = ? ORDER BY position').all(pollId) as PollOption[];
}

export function getVotesForPoll(pollId: string): PollVote[] {
  return db.prepare('SELECT * FROM poll_votes WHERE poll_id = ?').all(pollId) as PollVote[];
}

export function toggleVote(pollId: string, optionId: number, userId: string, displayName?: string): 'added' | 'removed' {
  const existing = db.prepare(`
    SELECT 1 FROM poll_votes WHERE poll_id = ? AND option_id = ? AND user_id = ?
  `).get(pollId, optionId, userId);

  if (existing) {
    db.prepare('DELETE FROM poll_votes WHERE poll_id = ? AND option_id = ? AND user_id = ?')
      .run(pollId, optionId, userId);
    return 'removed';
  } else {
    db.prepare('INSERT INTO poll_votes (poll_id, option_id, user_id, display_name) VALUES (?, ?, ?, ?)')
      .run(pollId, optionId, userId, displayName ?? null);
    return 'added';
  }
}

export function getWebVoterIds(pollId: string): string[] {
  const rows = db.prepare(`SELECT DISTINCT user_id FROM poll_votes WHERE poll_id = ? AND user_id LIKE 'web:%'`).all(pollId) as { user_id: string }[];
  return rows.map(r => r.user_id);
}

export function closePoll(pollId: string): void {
  db.prepare('UPDATE polls SET closed = 1 WHERE id = ?').run(pollId);
}

export function addPollOption(pollId: string, label: string): PollOption {
  const existing = db.prepare('SELECT MAX(position) as maxPos FROM poll_options WHERE poll_id = ?').get(pollId) as { maxPos: number | null };
  const position = (existing.maxPos ?? -1) + 1;
  const result = db.prepare('INSERT INTO poll_options (poll_id, label, position) VALUES (?, ?, ?)').run(pollId, label.trim(), position);
  return db.prepare('SELECT * FROM poll_options WHERE id = ?').get(result.lastInsertRowid) as PollOption;
}

export function setMessageId(pollId: string, messageId: string): void {
  db.prepare('UPDATE polls SET message_id = ? WHERE id = ?').run(messageId, pollId);
}
