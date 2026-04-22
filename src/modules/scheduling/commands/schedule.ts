import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ButtonInteraction,
  PermissionFlagsBits,
} from 'discord.js';
import { DateTime } from 'luxon';
import { Command, ButtonHandler } from '../../../types';
import {
  createCalendarPoll,
  getPoll,
  getActivePollsForGuild,
  closePoll,
  setMessageId,
  getUserTimezone,
  setUserTimezone,
  getPollOptions,
  getVotesForPoll,
  toggleVote,
} from '../db';
import { buildPollEmbed, buildPollButtons, buildCalendarPollEmbed, buildCalendarPollButtons } from '../embeds';

function isValidTimezone(tz: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

function parseDateTimeInZone(input: string, tz: string): number | null {
  const cleaned = input.trim().replace(/\s+/g, ' ');
  const formats = [
    'MMM d yyyy h:mma',
    'MMM d yyyy ha',
    'MMMM d yyyy h:mma',
    'MMMM d yyyy ha',
    'EEE MMM d yyyy h:mma',
    'EEE MMM d yyyy ha',
    'yyyy-MM-dd HH:mm',
    'yyyy-MM-dd h:mma',
  ];
  for (const fmt of formats) {
    const dt = DateTime.fromFormat(cleaned, fmt, { zone: tz });
    if (dt.isValid) return dt.toMillis();
  }
  const iso = DateTime.fromISO(cleaned, { zone: tz });
  if (iso.isValid) return iso.toMillis();
  return null;
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Scheduling and availability tools')
    .addSubcommand((sub) =>
      sub
        .setName('new')
        .setDescription('Create a new availability poll')
        .addStringOption((opt) =>
          opt.setName('event').setDescription('Event name, e.g. "Game Night"').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('start').setDescription('Start date/time, e.g. "May 3 2026 6pm"').setRequired(true)
        )
        .addStringOption((opt) =>
          opt.setName('end').setDescription('End date/time, e.g. "May 4 2026 11pm"').setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('timezone')
        .setDescription('Set your timezone for scheduling')
        .addStringOption((opt) =>
          opt.setName('zone').setDescription('IANA timezone, e.g. America/New_York').setRequired(false)
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

    if (sub === 'timezone') {
      const zone = interaction.options.getString('zone');
      if (!zone) {
        const current = getUserTimezone(interaction.user.id);
        await interaction.reply({
          content: current
            ? `Your timezone is currently set to **${current}**.`
            : `You haven't set a timezone yet. Use \`/schedule timezone zone:"America/New_York"\`.`,
          ephemeral: true,
        });
        return;
      }
      if (!isValidTimezone(zone)) {
        await interaction.reply({
          content: `**${zone}** isn't a valid timezone. Use an IANA name like \`America/New_York\`, \`Europe/London\`, or \`America/Los_Angeles\`.`,
          ephemeral: true,
        });
        return;
      }
      setUserTimezone(interaction.user.id, zone);
      await interaction.reply({ content: `✅ Timezone set to **${zone}**.`, ephemeral: true });
      return;
    }

    if (sub === 'new') {
      const name = interaction.options.getString('event', true);
      const startStr = interaction.options.getString('start', true);
      const endStr = interaction.options.getString('end', true);

      const tz = getUserTimezone(interaction.user.id);
      if (!tz) {
        await interaction.reply({
          content: `Set your timezone first so I know how to read those dates.\nRun: \`/schedule timezone zone:"America/New_York"\``,
          ephemeral: true,
        });
        return;
      }

      const startMs = parseDateTimeInZone(startStr, tz);
      const endMs = parseDateTimeInZone(endStr, tz);

      if (!startMs) {
        await interaction.reply({ content: `Couldn't parse the start time **"${startStr}"**. Try something like \`May 3 2026 6pm\` or \`2026-05-03 18:00\`.`, ephemeral: true });
        return;
      }
      if (!endMs) {
        await interaction.reply({ content: `Couldn't parse the end time **"${endStr}"**. Try something like \`May 4 2026 11pm\` or \`2026-05-04 23:00\`.`, ephemeral: true });
        return;
      }
      if (endMs <= startMs) {
        await interaction.reply({ content: 'End time must be after start time.', ephemeral: true });
        return;
      }

      const hours = (endMs - startMs) / (1000 * 60 * 60);
      if (hours < 1) {
        await interaction.reply({ content: 'Range must be at least 1 hour.', ephemeral: true });
        return;
      }
      if (hours > 168) {
        await interaction.reply({ content: 'Range cannot exceed 1 week.', ephemeral: true });
        return;
      }

      const poll = createCalendarPoll(
        interaction.guildId!,
        interaction.channelId,
        interaction.user.id,
        name,
        startMs,
        endMs,
        tz
      );

      const embed = await buildCalendarPollEmbed(poll, interaction.guild!);
      const buttons = buildCalendarPollButtons(poll.id);
      const reply = await interaction.reply({ embeds: [embed], components: buttons, fetchReply: true });
      setMessageId(poll.id, reply.id);
      return;
    }

    if (sub === 'list') {
      const polls = getActivePollsForGuild(interaction.guildId!);
      if (polls.length === 0) {
        await interaction.reply({ content: 'No open polls in this server.', ephemeral: true });
        return;
      }
      const lines = polls.map((p) => `**${p.name}** — ID: \`${p.id}\``).join('\n');
      await interaction.reply({ content: `**Open polls:**\n${lines}`, ephemeral: true });
      return;
    }

    if (sub === 'close') {
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

  const isCalendar = poll.poll_type === 'calendar';
  const embed = isCalendar
    ? await buildCalendarPollEmbed(poll, interaction.guild!, true)
    : await buildPollEmbed(poll, getPollOptions(pollId), interaction.guild!, true);
  const buttons = isCalendar
    ? buildCalendarPollButtons(pollId, true)
    : buildPollButtons(getPollOptions(pollId), pollId, true);

  if (poll.message_id) {
    try {
      const channel = await interaction.guild!.channels.fetch(poll.channel_id);
      if (channel?.isTextBased()) {
        const msg = await channel.messages.fetch(poll.message_id);
        await msg.edit({ embeds: [embed], components: buttons });
      }
    } catch {}
  }

  await interaction.reply({ content: `Poll **${poll.name}** has been closed.`, ephemeral: true });
}
