import { Message, EmbedBuilder, TextChannel } from 'discord.js';

const STAR_EMOJIS = new Set(['⭐', '🌟']);

export { STAR_EMOJIS };

export function countStars(message: Message): number {
  let count = 0;
  for (const reaction of message.reactions.cache.values()) {
    if (reaction.emoji.name && STAR_EMOJIS.has(reaction.emoji.name)) {
      count += reaction.count;
    }
  }
  return count;
}

export function buildEmbed(message: Message, starCount: number): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(0xffd700)
    .setAuthor({
      name: message.author.displayName || message.author.username,
      iconURL: message.author.displayAvatarURL(),
    })
    .setFooter({ text: `⭐ ${starCount} · #${(message.channel as TextChannel).name}` })
    .setTimestamp(message.createdAt);

  if (message.content) embed.setDescription(message.content);

  const image = message.attachments.find((a) => a.contentType?.startsWith('image/'));
  if (image) embed.setImage(image.url);

  embed.addFields({ name: 'Jump', value: `[View message](${message.url})`, inline: true });

  return embed;
}
