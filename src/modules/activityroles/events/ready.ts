import { Client, GuildMember } from 'discord.js';
import { BotEvent } from '../../../types';
import { getExpired, hasActivity, upsertActivity, deleteActivity, ActivityType } from '../db';

const VOICE_ROLE_ID = process.env.VOICE_ROLE_ID ?? '1019834905435308153';
const TRANSMITTER_ROLE_ID = process.env.TRANSMITTER_ROLE_ID ?? '1495894538852499568';
const SIGNAL_ROLE_ID = process.env.SIGNAL_ROLE_ID ?? '1495894378315776090';

const COLOR_ROLE_IDS = [
  process.env.COLOR_CYAN_ROLE_ID ?? '1495895661370019880',
  process.env.COLOR_MAGENTA_ROLE_ID ?? '1495895854219792575',
  process.env.COLOR_YELLOW_ROLE_ID ?? '1495896045211750410',
  process.env.COLOR_PURPLE_ROLE_ID ?? '1495896239215087636',
];

const CONFIGS: { type: ActivityType; roleId: string; cutoffMs: number }[] = [
  { type: 'voice', roleId: VOICE_ROLE_ID, cutoffMs: 7 * 24 * 60 * 60 * 1000 },
  { type: 'text', roleId: TRANSMITTER_ROLE_ID, cutoffMs: 14 * 24 * 60 * 60 * 1000 },
  { type: 'signal', roleId: SIGNAL_ROLE_ID, cutoffMs: 14 * 24 * 60 * 60 * 1000 },
];

async function removeColorRoles(member: GuildMember) {
  for (const colorId of COLOR_ROLE_IDS) {
    if (member.roles.cache.has(colorId)) {
      await member.roles.remove(colorId).catch(() => null);
    }
  }
}

async function runCleanup(client: Client<true>) {
  const now = Date.now();

  for (const { type, roleId, cutoffMs } of CONFIGS) {
    const expired = getExpired(type, now - cutoffMs);

    for (const row of expired) {
      const guild = client.guilds.cache.get(row.guild_id);
      if (!guild) continue;
      const member = await guild.members.fetch(row.user_id).catch(() => null);
      if (member?.roles.cache.has(roleId)) {
        await member.roles.remove(roleId).catch((err) =>
          console.error(`[activityroles] Failed to remove ${type} role from ${row.user_id}:`, err)
        );
        // If losing Transmitter, also strip color roles
        if (type === 'text') await removeColorRoles(member);
      }
      deleteActivity(row.user_id, row.guild_id, type);
    }

    if (expired.length > 0) {
      console.log(`[activityroles] Removed ${type} role from ${expired.length} member(s)`);
    }
  }

  // Seed DB entries for members who have a role but no activity record (legacy/Statbot holdovers)
  for (const guild of client.guilds.cache.values()) {
    const members = await guild.members.fetch().catch(() => null);
    if (!members) continue;
    for (const member of members.values()) {
      for (const { type, roleId } of CONFIGS) {
        if (member.roles.cache.has(roleId) && !hasActivity(member.id, guild.id, type)) {
          upsertActivity(member.id, guild.id, type, 0);
        }
      }
    }
  }
}

const readyEvent: BotEvent = {
  name: 'ready',
  once: true,
  async execute(...args: unknown[]) {
    const client = args[0] as Client<true>;
    await runCleanup(client);
    setInterval(() => runCleanup(client), 24 * 60 * 60 * 1000);
  },
};

export default readyEvent;
