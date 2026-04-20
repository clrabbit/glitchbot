import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  UserSelectMenuInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command, ButtonHandler } from '../../../types';
import {
  addGame,
  removeGame,
  getGames,
  spinWheel,
  getSpin,
  setWinner,
  getWinStats,
} from '../db';
import {
  buildSpinEmbed,
  buildSpinComponents,
  buildWinnerSelectComponents,
  buildGameListEmbed,
  buildHistoryEmbed,
  buildStatsEmbed,
} from '../embeds';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('gamewheel')
    .setDescription('Spin a wheel to pick a random game')
    .addSubcommand((sub) =>
      sub
        .setName('add')
        .setDescription('Add a game to the wheel')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Game name').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('remove')
        .setDescription('Remove a game from the wheel')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Game name').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all games on the wheel')
    )
    .addSubcommand((sub) =>
      sub.setName('spin').setDescription('Spin the wheel to pick a random game')
    )
    .addSubcommand((sub) =>
      sub.setName('stats').setDescription('Show win leaderboard')
    )
    .addSubcommand((sub) =>
      sub.setName('history').setDescription('Show recent spin history')
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'add') {
      const name = interaction.options.getString('name', true).trim();
      if (name.length > 100) {
        await interaction.reply({ content: 'Game name must be 100 characters or fewer.', ephemeral: true });
        return;
      }
      const game = addGame(interaction.guildId!, name, interaction.user.id);
      if (!game) {
        await interaction.reply({ content: `**${name}** is already on the wheel.`, ephemeral: true });
        return;
      }
      const total = getGames(interaction.guildId!).length;
      await interaction.reply({ content: `✅ Added **${name}** to the wheel. (${total} game${total === 1 ? '' : 's'} total)`, ephemeral: true });
    }

    else if (sub === 'remove') {
      const name = interaction.options.getString('name', true).trim();
      const hasPerms = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
      const games = getGames(interaction.guildId!);
      const game = games.find((g) => g.name.toLowerCase() === name.toLowerCase());

      if (!game) {
        await interaction.reply({ content: `No game named **${name}** found on the wheel.`, ephemeral: true });
        return;
      }
      if (!hasPerms && game.added_by !== interaction.user.id) {
        await interaction.reply({ content: 'You can only remove games you added. A moderator can remove any game.', ephemeral: true });
        return;
      }
      removeGame(interaction.guildId!, game.name);
      await interaction.reply({ content: `🗑️ Removed **${game.name}** from the wheel.`, ephemeral: true });
    }

    else if (sub === 'list') {
      const games = getGames(interaction.guildId!);
      const embed = buildGameListEmbed(games);
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'spin') {
      const games = getGames(interaction.guildId!);
      if (games.length === 0) {
        await interaction.reply({ content: 'The wheel is empty! Add some games first with `/gamewheel add`.', ephemeral: true });
        return;
      }

      const spin = spinWheel(interaction.guildId!, interaction.user.id);
      if (!spin) {
        await interaction.reply({ content: 'Something went wrong. Please try again.', ephemeral: true });
        return;
      }

      const spunByName = await interaction.guild!.members
        .fetch(interaction.user.id)
        .then((m) => m.displayName)
        .catch(() => interaction.user.username);

      // Show spinning animation by cycling random game names before revealing
      await interaction.deferReply();
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const frameDelays = [500, 500, 600, 700];
      for (const delay of frameDelays) {
        const randomGame = games[Math.floor(Math.random() * games.length)];
        await interaction.editReply({ content: `🎡 *spinning...* **${randomGame.name}**` });
        await sleep(delay);
      }

      const embed = buildSpinEmbed(spin, spunByName);
      const components = buildSpinComponents(spin.id, false);
      await interaction.editReply({ content: null, embeds: [embed], components });
    }

    else if (sub === 'stats') {
      const stats = getWinStats(interaction.guildId!);
      const embed = await buildStatsEmbed(stats, interaction.guild!);
      await interaction.reply({ embeds: [embed] });
    }

    else if (sub === 'history') {
      const embed = await buildHistoryEmbed(interaction.guildId!, interaction.guild!);
      await interaction.reply({ embeds: [embed] });
    }
  },
};

export const setWinnerButton: ButtonHandler = {
  customIdPrefix: 'wheel_setwinner',
  async execute(interaction: ButtonInteraction) {
    const spinId = parseInt(interaction.customId.split('_')[2], 10);
    const spin = getSpin(spinId);

    if (!spin) {
      await interaction.reply({ content: 'Spin not found.', ephemeral: true });
      return;
    }
    if (spin.winner_id) {
      await interaction.reply({ content: 'A winner has already been recorded for this spin.', ephemeral: true });
      return;
    }

    const components = buildWinnerSelectComponents(spinId);
    await interaction.update({ components });
  },
};

export const winnerSelectMenu = {
  customIdPrefix: 'wheel_winner',
  async execute(interaction: UserSelectMenuInteraction) {
    const spinId = parseInt(interaction.customId.split('_')[2], 10);
    const spin = getSpin(spinId);

    if (!spin) {
      await interaction.reply({ content: 'Spin not found.', ephemeral: true });
      return;
    }

    const winnerId = interaction.values[0];
    setWinner(spinId, winnerId);

    const spunByName = await interaction.guild!.members
      .fetch(spin.spun_by)
      .then((m) => m.displayName)
      .catch(() => `<@${spin.spun_by}>`);

    const winnerName = await interaction.guild!.members
      .fetch(winnerId)
      .then((m) => m.displayName)
      .catch(() => `<@${winnerId}>`);

    const updatedSpin = getSpin(spinId)!;
    const embed = buildSpinEmbed(updatedSpin, spunByName, winnerName);
    await interaction.update({ embeds: [embed], components: [] });
  },
};
