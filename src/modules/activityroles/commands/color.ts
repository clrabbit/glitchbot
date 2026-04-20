import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember, SlashCommandOptionsOnlyBuilder } from 'discord.js';
import { Command } from '../../../types';

const TRANSMITTER_ROLE_ID = process.env.TRANSMITTER_ROLE_ID ?? '1495894538852499568';

const COLOR_ROLES: Record<string, string> = {
  cyan: process.env.COLOR_CYAN_ROLE_ID ?? '1495895661370019880',
  magenta: process.env.COLOR_MAGENTA_ROLE_ID ?? '1495895854219792575',
  yellow: process.env.COLOR_YELLOW_ROLE_ID ?? '1495896045211750410',
  purple: process.env.COLOR_PURPLE_ROLE_ID ?? '1495896239215087636',
};

export const colorCommand: Command = {
  data: new SlashCommandBuilder()
    .setName('color')
    .setDescription('Set your color role (requires Transmitter)')
    .addStringOption((opt) =>
      opt
        .setName('color')
        .setDescription('Choose a color')
        .setRequired(true)
        .addChoices(
          { name: 'Cyan', value: 'cyan' },
          { name: 'Magenta', value: 'magenta' },
          { name: 'Yellow', value: 'yellow' },
          { name: 'Purple', value: 'purple' },
          { name: 'None', value: 'none' },
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const member = interaction.member as GuildMember;
    if (!member.roles.cache.has(TRANSMITTER_ROLE_ID)) {
      await interaction.reply({ content: 'You need the Transmitter role to pick a color.', ephemeral: true });
      return;
    }

    const choice = interaction.options.getString('color', true);

    // Remove all color roles
    for (const roleId of Object.values(COLOR_ROLES)) {
      if (member.roles.cache.has(roleId)) {
        await member.roles.remove(roleId).catch(() => null);
      }
    }

    if (choice !== 'none') {
      await member.roles.add(COLOR_ROLES[choice]).catch((err) => {
        console.error(`[activityroles] Failed to add color role ${choice} to ${member.id}:`, err);
      });
    }

    const reply = choice === 'none' ? 'Color role removed.' : `Color set to **${choice}**.`;
    await interaction.reply({ content: reply, ephemeral: true });
  },
};
