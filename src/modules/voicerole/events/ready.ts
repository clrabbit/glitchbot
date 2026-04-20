import { Client, GuildMember } from 'discord.js';
import { BotEvent } from '../../../types';
import { getExpiredUsers, hasActivity, upsertActivity, deleteActivity } from '../db';

const VOICE_ROLE_ID = process.env.VOICE_ROLE_ID ?? '1019834905435308153';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

async function runCleanup(client: Client<true>) {
  const cutoff = Date.now() - SEVEN_DAYS_MS;
  const expired = getExpiredUsers(cutoff);

  for (const row of expired) {
    const guild = client.guilds.cache.get(row.guild_id);
    if (!guild) continue;
    const member = await guild.members.fetch(row.user_id).catch(() => null);
    if (member?.roles.cache.has(VOICE_ROLE_ID)) {
      await member.roles.remove(VOICE_ROLE_ID).catch((err) =>
        console.error(`[voicerole] Failed to remove role from ${row.user_id}:`, err)
      );
    }
    deleteActivity(row.user_id, row.guild_id);
  }

  // Seed missing DB entries for members who have the role but no activity record
  for (const guild of client.guilds.cache.values()) {
    const role = guild.roles.cache.get(VOICE_ROLE_ID);
    if (!role) continue;
    const members = await guild.members.fetch().catch(() => null);
    if (!members) continue;
    for (const member of members.values()) {
      if (member.roles.cache.has(VOICE_ROLE_ID) && !hasActivity(member.id, guild.id)) {
        upsertActivity(member.id, guild.id, 0);
      }
    }
  }

  if (expired.length > 0) {
    console.log(`[voicerole] Removed role from ${expired.length} inactive member(s)`);
  }
}

const readyEvent: BotEvent = {
  name: 'ready',
  once: true,
  async execute(...args: unknown[]) {
    const client = args[0] as Client<true>;
    await runCleanup(client);
    setInterval(() => runCleanup(client), CLEANUP_INTERVAL_MS);
  },
};

export default readyEvent;
