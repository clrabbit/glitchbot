import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Command } from '../../../types';
import { isLoggingEnabled, setLoggingEnabled } from '../db';

const OWNER_ID = process.env.OWNER_ID;

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('logging')
    .setDescription('Enable or disable edit logging')
    .addSubcommand((sub) => sub.setName('enable').setDescription('Enable edit logging'))
    .addSubcommand((sub) => sub.setName('disable').setDescription('Disable edit logging')),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!OWNER_ID || interaction.user.id !== OWNER_ID) {
      await interaction.reply({ content: 'Only the bot owner can use this command.', ephemeral: true });
      return;
    }

    const sub = interaction.options.getSubcommand();
    const enable = sub === 'enable';
    setLoggingEnabled(enable);
    await interaction.reply({ content: `Edit logging ${enable ? 'enabled' : 'disabled'}.`, ephemeral: true });
  },
};
