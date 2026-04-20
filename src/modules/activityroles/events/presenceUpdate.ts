import { Presence } from 'discord.js';
import { BotEvent } from '../../../types';
import { upsertActivity } from '../db';

const SIGNAL_ROLE_ID = process.env.SIGNAL_ROLE_ID ?? '1495894378315776090';

const presenceUpdateEvent: BotEvent = {
  name: 'presenceUpdate',
  async execute(...args: unknown[]) {
    const oldPresence = args[0] as Presence | null;
    const newPresence = args[1] as Presence;

    if (newPresence.status === 'offline') return;
    if (oldPresence && oldPresence.status !== 'offline') return; // only fire on offline→online transition

    const member = newPresence.member;
    if (!member || member.user.bot) return;

    upsertActivity(member.id, member.guild.id, 'signal', Date.now());

    if (!member.roles.cache.has(SIGNAL_ROLE_ID)) {
      await member.roles.add(SIGNAL_ROLE_ID).catch((err) =>
        console.error(`[activityroles] Failed to add Detected role to ${member.id}:`, err)
      );
    }
  },
};

export default presenceUpdateEvent;
