import { Message, EmbedBuilder, TextChannel, PartialMessage } from 'discord.js';
import { BotEvent } from '../../../types';
import { isLoggingEnabled } from '../db';

const EDIT_LOG_CHANNEL_ID = process.env.EDIT_LOG_CHANNEL_ID ?? '416631355091320843';

function truncate(text: string, max = 1024): string {
  return text.length > max ? text.slice(0, max - 3) + '...' : text;
}

const messageUpdateEvent: BotEvent = {
  name: 'messageUpdate',
  async execute(...args: unknown[]) {
    const oldMessage = args[0] as Message | PartialMessage;
    let newMessage = args[1] as Message | PartialMessage;

    if (!isLoggingEnabled()) return;
    if (newMessage.partial) newMessage = await newMessage.fetch().catch(() => null as never);
    if (!newMessage || !newMessage.guild) return;
    if (newMessage.author?.bot) return;

    const oldContent = oldMessage.partial ? null : oldMessage.content;
    const newContent = newMessage.content;

    if (!newContent || oldContent === newContent) return;

    const logChannel = newMessage.guild.channels.cache.get(EDIT_LOG_CHANNEL_ID) as TextChannel | undefined;
    if (!logChannel) return;

    const embed = new EmbedBuilder()
      .setColor(0xf0a500)
      .setAuthor({
        name: newMessage.author.displayName || newMessage.author.username,
        iconURL: newMessage.author.displayAvatarURL(),
      })
      .setDescription(`Message edited in <#${newMessage.channel.id}>`)
      .addFields(
        { name: 'Before', value: oldContent ? truncate(oldContent) : '*unavailable*' },
        { name: 'After', value: truncate(newContent) },
        { name: 'Jump', value: `[View message](${newMessage.url})`, inline: true },
      )
      .setFooter({ text: `ID: ${newMessage.author.id}` })
      .setTimestamp();

    await logChannel.send({ embeds: [embed] });
  },
};

export default messageUpdateEvent;
