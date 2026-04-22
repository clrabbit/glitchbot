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
            '`/schedule timezone` — View or set your timezone (required before creating polls).',
            '`/schedule new event:"…" start:"May 3 2026 6pm" end:"May 4 2026 11pm"` — Create an availability poll over a date/time range.',
            '`/schedule list` — List all open polls in this server.',
            '`/schedule close id:"…"` — Close a poll (creator or mods only).',
            ``,
            `Use the web link in each poll to fill in your availability on a calendar grid — times shown in your local timezone automatically.`,
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
