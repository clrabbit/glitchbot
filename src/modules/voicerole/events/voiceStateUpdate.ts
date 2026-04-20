import { VoiceState, GuildMember } from 'discord.js';
import { BotEvent } from '../../../types';
import { upsertActivity } from '../db';

const VOICE_ROLE_ID = process.env.VOICE_ROLE_ID ?? '1019834905435308153';

const voiceStateUpdateEvent: BotEvent = {
  name: 'voiceStateUpdate',
  async execute(...args: unknown[]) {
    const oldState = args[0] as VoiceState;
    const newState = args[1] as VoiceState;

    const joined = !oldState.channelId && !!newState.channelId;
    if (!joined) return;

    const member = newState.member as GuildMember;
    if (member.user.bot) return;

    upsertActivity(member.id, member.guild.id, Date.now());

    if (!member.roles.cache.has(VOICE_ROLE_ID)) {
      await member.roles.add(VOICE_ROLE_ID).catch((err) =>
        console.error(`[voicerole] Failed to add role to ${member.id}:`, err)
      );
    }
  },
};

export default voiceStateUpdateEvent;
