import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { Command, ButtonHandler } from '../../../types';
import {
  createPoll,
  getPoll,
  getPollOptions,
  getActivePollsForGuild,
  toggleVote,
  closePoll,
  setMessageId,
} from '../db';
import { buildPollEmbed, buildPollButtons } from '../embeds';

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Scheduling and availability tools')
    .addSubcommand((sub) =>
      sub
        .setName('new')
        .setDescription('Create a new availability poll')
        .addStringOption((opt) =>
          opt.setName('name').setDescription('Event name, e.g. "Game Night"').setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('times')
            .setDescription('Comma-separated time options, e.g. "Sat 8pm, Sun 3pm, Sun 8pm"')
            .setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub.setName('list').setDescription('List all open polls in this server')
    )
    .addSubcommand((sub) =>
      sub
        .setName('close')
        .setDescription('Close a poll manually')
        .addStringOption((opt) =>
          opt.setName('id').setDescription('Poll ID (shown in the poll footer)').setRequired(true)
        )
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const sub = interaction.options.getSubcommand();

    if (sub === 'new') {
      const name = interaction.options.getString('name', true);
      const timesRaw = interaction.options.getString('times', true);
      const times = timesRaw.split(',').map((t) => t.trim()).filter(Boolean);

      if (times.length < 2) {
        await interaction.reply({ content: 'Please provide at least 2 time options, separated by commas.', ephemeral: true });
        return;
      }
      if (times.length > 10) {
        await interaction.reply({ content: 'Maximum 10 time options per poll.', ephemeral: true });
        return;
      }

      const poll = createPoll(
        interaction.guildId!,
        interaction.channelId,
        interaction.user.id,
        name,
        times
      );
      const options = getPollOptions(poll.id);
      const embed = await buildPollEmbed(poll, options, interaction.guild!);
      const buttons = buildPollButtons(options, poll.id);

      const reply = await interaction.reply({ embeds: [embed], components: buttons, fetchReply: true });
      setMessageId(poll.id, reply.id);
    }

    else if (sub === 'list') {
      const polls = getActivePollsForGuild(interaction.guildId!);
      if (polls.length === 0) {
        await interaction.reply({ content: 'No open polls in this server.', ephemeral: true });
        return;
      }
      const lines = polls.map((p) => `**${p.name}** — ID: \`${p.id}\``).join('\n');
      await interaction.reply({ content: `**Open polls:**\n${lines}`, ephemeral: true });
    }

    else if (sub === 'close') {
      const id = interaction.options.getString('id', true);
      await handleClose(interaction, id);
    }
  },
};

export const voteButton: ButtonHandler = {
  customIdPrefix: 'sched_vote',
  async execute(interaction: ButtonInteraction) {
    const parts = interaction.customId.split('_');
    const pollId = parts[2];
    const optionId = parseInt(parts[3], 10);

    const poll = getPoll(pollId);
    if (!poll || poll.closed) {
      await interaction.reply({ content: 'This poll is no longer active.', ephemeral: true });
      return;
    }

    toggleVote(pollId, optionId, interaction.user.id);

    const options = getPollOptions(pollId);
    const embed = await buildPollEmbed(poll, options, interaction.guild!);
    const buttons = buildPollButtons(options, pollId);

    await interaction.update({ embeds: [embed], components: buttons });
  },
};

export const closeButton: ButtonHandler = {
  customIdPrefix: 'sched_close',
  async execute(interaction: ButtonInteraction) {
    const pollId = interaction.customId.split('_')[2];
    await handleClose(interaction, pollId);
  },
};

async function handleClose(
  interaction: ChatInputCommandInteraction | ButtonInteraction,
  pollId: string
) {
  const poll = getPoll(pollId);
  if (!poll) {
    await interaction.reply({ content: `No poll found with ID \`${pollId}\`.`, ephemeral: true });
    return;
  }
  if (poll.closed) {
    await interaction.reply({ content: 'That poll is already closed.', ephemeral: true });
    return;
  }

  const isCreator = poll.creator_id === interaction.user.id;
  const hasPerms = interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild);
  if (!isCreator && !hasPerms) {
    await interaction.reply({ content: 'Only the poll creator or a moderator can close this poll.', ephemeral: true });
    return;
  }

  closePoll(pollId);
  const options = getPollOptions(pollId);
  const embed = await buildPollEmbed(poll, options, interaction.guild!, true);
  const buttons = buildPollButtons(options, pollId, true);

  if (poll.message_id) {
    try {
      const channel = await interaction.guild!.channels.fetch(poll.channel_id);
      if (channel?.isTextBased()) {
        const msg = await channel.messages.fetch(poll.message_id);
        await msg.edit({ embeds: [embed], components: buttons });
      }
    } catch {
      // message may have been deleted, that's fine
    }
  }

  await interaction.reply({ content: `Poll **${poll.name}** has been closed.`, ephemeral: true });
}
