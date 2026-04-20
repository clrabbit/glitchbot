import { MessageReaction, User, TextChannel, Message } from 'discord.js';
import { BotEvent } from '../../../types';
import { getPost, updateStarCount } from '../db';
import { STAR_EMOJIS, countStars, buildEmbed } from '../utils';

const STARBOARD_CHANNEL_ID = process.env.STARBOARD_CHANNEL_ID ?? '519233898660626438';

const reactionRemoveEvent: BotEvent = {
  name: 'messageReactionRemove',
  async execute(...args: unknown[]) {
    let reaction = args[0] as MessageReaction;
    const user = args[1] as User;

    if (user.bot) return;
    if (!reaction.emoji.name || !STAR_EMOJIS.has(reaction.emoji.name)) return;

    if (reaction.partial) reaction = await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const message = reaction.message as Message;
    if (!message.guild) return;

    const existing = getPost(message.id);
    if (!existing) return;

    const starCount = countStars(message);
    updateStarCount(message.id, starCount);

    const starboardChannel = message.guild.channels.cache.get(STARBOARD_CHANNEL_ID) as TextChannel | undefined;
    if (!starboardChannel) return;

    const starboardMessage = await starboardChannel.messages.fetch(existing.starboard_message_id).catch(() => null);
    if (starboardMessage) {
      await starboardMessage.edit({ embeds: [buildEmbed(message, starCount)] });
    }
  },
};

export default reactionRemoveEvent;
