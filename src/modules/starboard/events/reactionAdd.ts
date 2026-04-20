import { MessageReaction, User, TextChannel, Message } from 'discord.js';
import { BotEvent } from '../../../types';
import { getPost, insertPost, updateStarCount } from '../db';
import { STAR_EMOJIS, countStars, buildEmbed } from '../utils';

const STARBOARD_CHANNEL_ID = process.env.STARBOARD_CHANNEL_ID ?? '519233898660626438';
const STAR_THRESHOLD = 3;

const reactionAddEvent: BotEvent = {
  name: 'messageReactionAdd',
  async execute(...args: unknown[]) {
    let reaction = args[0] as MessageReaction;
    const user = args[1] as User;

    if (user.bot) return;
    if (!reaction.emoji.name || !STAR_EMOJIS.has(reaction.emoji.name)) return;

    if (reaction.partial) reaction = await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    const message = reaction.message as Message;
    if (!message.guild) return;
    if (message.channel.id === STARBOARD_CHANNEL_ID) return;

    const starCount = countStars(message);
    const existing = getPost(message.id);

    const starboardChannel = message.guild.channels.cache.get(STARBOARD_CHANNEL_ID) as TextChannel | undefined;
    if (!starboardChannel) return;

    if (existing) {
      updateStarCount(message.id, starCount);
      const starboardMessage = await starboardChannel.messages.fetch(existing.starboard_message_id).catch(() => null);
      if (starboardMessage) {
        await starboardMessage.edit({ embeds: [buildEmbed(message, starCount)] });
      }
    } else if (starCount >= STAR_THRESHOLD) {
      const sent = await starboardChannel.send({ embeds: [buildEmbed(message, starCount)] });
      insertPost({
        message_id: message.id,
        guild_id: message.guild.id,
        channel_id: message.channel.id,
        starboard_message_id: sent.id,
        star_count: starCount,
      });
    }
  },
};

export default reactionAddEvent;
