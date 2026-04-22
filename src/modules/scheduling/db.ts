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
  poll_type: 'slots' | 'calendar';
  start_time: number | null;
  end_time: number | null;
  timezone: string | null;
}

export interface CalendarAvailability {
  poll_id: string;
  user_id: string;
  display_name: string | null;
  slot_time: number;
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

export function getUserTimezone(userId: string): string | null {
  const row = db.prepare('SELECT timezone FROM user_timezones WHERE user_id = ?').get(userId) as { timezone: string } | undefined;
  return row?.timezone ?? null;
}

export function setUserTimezone(userId: string, timezone: string): void {
  db.prepare('INSERT OR REPLACE INTO user_timezones (user_id, timezone) VALUES (?, ?)').run(userId, timezone);
}

export function createCalendarPoll(
  guildId: string,
  channelId: string,
  creatorId: string,
  name: string,
  startTime: number,
  endTime: number,
  timezone: string
): Poll {
  const id = randomUUID().slice(0, 8);
  db.prepare(`
    INSERT INTO polls (id, guild_id, channel_id, creator_id, name, created_at, poll_type, start_time, end_time, timezone)
    VALUES (?, ?, ?, ?, ?, ?, 'calendar', ?, ?, ?)
  `).run(id, guildId, channelId, creatorId, name, Date.now(), startTime, endTime, timezone);
  return getPoll(id)!;
}

export function getPollSlots(poll: Poll): number[] {
  if (!poll.start_time || !poll.end_time) return [];
  const slotMs = 60 * 60 * 1000;
  const slots: number[] = [];
  for (let t = poll.start_time; t < poll.end_time; t += slotMs) {
    slots.push(t);
  }
  return slots;
}

export function getCalendarAvailability(pollId: string): CalendarAvailability[] {
  return db.prepare('SELECT * FROM poll_availability WHERE poll_id = ? ORDER BY slot_time').all(pollId) as CalendarAvailability[];
}

export function setCalendarAvailability(
  pollId: string,
  userId: string,
  displayName: string,
  slotTimes: number[]
): void {
  const del = db.prepare('DELETE FROM poll_availability WHERE poll_id = ? AND user_id = ?');
  const ins = db.prepare('INSERT INTO poll_availability (poll_id, user_id, display_name, slot_time) VALUES (?, ?, ?, ?)');
  db.transaction(() => {
    del.run(pollId, userId);
    for (const t of slotTimes) ins.run(pollId, userId, displayName, t);
  })();
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
