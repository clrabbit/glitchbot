import { Message } from 'discord.js';
import { BotEvent } from '../../../types';
import { upsertActivity } from '../db';

const TRANSMITTER_ROLE_ID = process.env.TRANSMITTER_ROLE_ID ?? '1495894538852499568';
const SIGNAL_ROLE_ID = process.env.SIGNAL_ROLE_ID ?? '1495894378315776090';

const messageCreateEvent: BotEvent = {
  name: 'messageCreate',
  async execute(...args: unknown[]) {
    const message = args[0] as Message;
    if (message.author.bot || !message.guild) return;

    const member = message.member;
    if (!member) return;

    const now = Date.now();
    upsertActivity(member.id, message.guild.id, 'text', now);
    upsertActivity(member.id, message.guild.id, 'signal', now);

    const rolesToAdd: string[] = [];
    if (!member.roles.cache.has(TRANSMITTER_ROLE_ID)) rolesToAdd.push(TRANSMITTER_ROLE_ID);
    if (!member.roles.cache.has(SIGNAL_ROLE_ID)) rolesToAdd.push(SIGNAL_ROLE_ID);

    for (const roleId of rolesToAdd) {
      await member.roles.add(roleId).catch((err) =>
        console.error(`[activityroles] Failed to add Uplink/Detected role ${roleId} to ${member.id}:`, err)
      );
    }
  },
};

export default messageCreateEvent;
