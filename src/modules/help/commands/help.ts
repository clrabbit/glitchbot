import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { Command } from '../../../types';

const GLITCH_BLUE = 0x5865f2;

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show all GlitchBot commands'),

  async execute(interaction: ChatInputCommandInteraction) {
    const webUrl = process.env.WEB_URL ?? 'https://bot.glitch.fm';

    const embed = new EmbedBuilder()
      .setTitle('GlitchBot — Commands')
      .setColor(GLITCH_BLUE)
      .addFields(
        {
          name: '📅 Scheduling',
          value: [
            '`/schedule new event:"…"` — Create an availability poll with no pre-set times.',
            '`/schedule new event:"…" times:"…"` — Create a poll with time options (comma-separated).',
            '`/schedule list` — List all open polls in this server.',
            '`/schedule close id:"…"` — Close a poll (creator or mods only).',
            ``,
            `Click the time buttons on a poll to mark yourself available. Use the web link in each poll to add time slots or submit availability from your browser.`,
          ].join('\n'),
        },
        {
          name: '🎡 Game Wheel',
          value: [
            '`/gamewheel add name:"…"` — Add a game to this server\'s wheel.',
            '`/gamewheel remove name:"…"` — Remove a game (adder or mods only).',
            '`/gamewheel list` — List all games on the wheel.',
            '`/gamewheel spin` — Spin the wheel to pick a random game.',
            '`/gamewheel stats` — Show the win leaderboard.',
            '`/gamewheel history` — Show recent spin history.',
          ].join('\n'),
        },
        {
          name: '🔊 Voice Role *(coming soon)*',
          value: 'Auto-assign a "Recently in Voice" role to active voice users.',
        },
        {
          name: '🎵 Audio *(coming soon)*',
          value: 'Join voice and play audio via Lavalink.',
        }
      )
      .setFooter({ text: `Web: ${webUrl}` });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
