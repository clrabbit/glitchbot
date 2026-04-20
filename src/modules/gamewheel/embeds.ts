import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  UserSelectMenuBuilder,
  Guild,
} from 'discord.js';
import { WheelSpinWithGame, WheelGame, WinStat, getRecentSpins } from './db';

const WHEEL_COLOR = 0xe67e22;
const WINNER_COLOR = 0x2ecc71;
const STATS_COLOR = 0x9b59b6;

export function buildSpinEmbed(spin: WheelSpinWithGame, spunByName: string, winnerName?: string) {
  const embed = new EmbedBuilder()
    .setTitle('🎡 Game Wheel')
    .setColor(winnerName ? WINNER_COLOR : WHEEL_COLOR)
    .setDescription(`🎮 **${spin.game_name}**`)
    .setFooter({ text: `Spin #${spin.id} • spun by ${spunByName}` })
    .setTimestamp(spin.spun_at);

  if (winnerName) {
    embed.addFields({ name: '🏆 Winner', value: winnerName, inline: true });
  }

  return embed;
}

export function buildSpinComponents(spinId: number, winnerSet: boolean) {
  if (winnerSet) return [];

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`wheel_setwinner_${spinId}`)
      .setLabel('Record Winner')
      .setStyle(ButtonStyle.Success)
  );
  return [row];
}

export function buildWinnerSelectComponents(spinId: number) {
  const row = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
    new UserSelectMenuBuilder()
      .setCustomId(`wheel_winner_${spinId}`)
      .setPlaceholder('Select the winner…')
  );
  return [row];
}

export function buildGameListEmbed(games: WheelGame[]) {
  const embed = new EmbedBuilder()
    .setTitle('🎡 Game Wheel — Game List')
    .setColor(WHEEL_COLOR);

  if (games.length === 0) {
    embed.setDescription('No games on the wheel yet. Use `/gamewheel add` to add some!');
  } else {
    embed.setDescription(games.map((g, i) => `${i + 1}. ${g.name}`).join('\n'));
    embed.setFooter({ text: `${games.length} game${games.length === 1 ? '' : 's'} on the wheel` });
  }

  return embed;
}

export async function buildHistoryEmbed(guildId: string, guild: Guild) {
  const spins = getRecentSpins(guildId, 10);
  const embed = new EmbedBuilder()
    .setTitle('🎡 Game Wheel — Recent Spins')
    .setColor(WHEEL_COLOR);

  if (spins.length === 0) {
    embed.setDescription('No spins yet. Use `/gamewheel spin` to get started!');
    return embed;
  }

  const lines = await Promise.all(
    spins.map(async (s) => {
      let winnerStr = '';
      if (s.winner_id) {
        const name = await guild.members.fetch(s.winner_id).then((m) => m.displayName).catch(() => `<@${s.winner_id}>`);
        winnerStr = ` — 🏆 ${name}`;
      }
      const date = new Date(s.spun_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      return `**${s.game_name}**${winnerStr} *(${date})*`;
    })
  );

  embed.setDescription(lines.join('\n'));
  return embed;
}

export async function buildStatsEmbed(stats: WinStat[], guild: Guild) {
  const embed = new EmbedBuilder()
    .setTitle('🎡 Game Wheel — Win Stats')
    .setColor(STATS_COLOR);

  if (stats.length === 0) {
    embed.setDescription('No recorded winners yet. Record one after a spin!');
    return embed;
  }

  const medals = ['🥇', '🥈', '🥉'];
  const lines = await Promise.all(
    stats.map(async (s, i) => {
      const name = await guild.members.fetch(s.winner_id).then((m) => m.displayName).catch(() => `<@${s.winner_id}>`);
      const medal = medals[i] ?? `**${i + 1}.**`;
      return `${medal} ${name} — ${s.wins} win${s.wins === 1 ? '' : 's'}`;
    })
  );

  embed.setDescription(lines.join('\n'));
  return embed;
}
