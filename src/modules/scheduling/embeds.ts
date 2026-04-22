import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Guild,
} from 'discord.js';
import { DateTime } from 'luxon';
import { Poll, PollOption, getVotesForPoll, getCalendarAvailability, getPollSlots } from './db';

const GLITCH_BLUE = 0x5865f2;
const CLOSED_GREY = 0x747f8d;

async function resolveName(userId: string, displayName: string | null, guild: Guild): Promise<string> {
  if (displayName) return displayName;
  return guild.members.fetch(userId).then((m) => m.displayName).catch(() => 'Unknown');
}

export async function buildPollEmbed(
  poll: Poll,
  options: PollOption[],
  guild: Guild,
  closed = false
) {
  const votes = getVotesForPoll(poll.id);
  const webUrl = process.env.WEB_URL;

  const fields = options.length === 0
    ? []
    : await Promise.all(
        options.map(async (opt) => {
          const optVotes = votes.filter((v) => v.option_id === opt.id);
          let names = '—';
          if (optVotes.length > 0) {
            const resolved = await Promise.all(
              optVotes.map((v) => resolveName(v.user_id, v.display_name, guild))
            );
            names = resolved.join(', ');
          }
          return {
            name: `${closed ? '🔒' : '📅'} ${opt.label} — ${optVotes.length} available`,
            value: names,
            inline: false,
          };
        })
      );

  const uniqueVoters = new Set(votes.map((v) => v.user_id)).size;
  const creator = await guild.members.fetch(poll.creator_id).then((m) => m.displayName).catch(() => 'Unknown');

  const embed = new EmbedBuilder()
    .setTitle(`🗓️ ${poll.name}`)
    .setColor(closed ? CLOSED_GREY : GLITCH_BLUE)
    .addFields(fields)
    .setFooter({
      text: `${closed ? 'Closed' : 'Open'} • Created by ${creator} • ${uniqueVoters} ${uniqueVoters === 1 ? 'response' : 'responses'} • ID: ${poll.id}`,
    })
    .setTimestamp(poll.created_at);

  if (!closed && webUrl) {
    const desc = options.length === 0
      ? `No time slots yet. [Add your availability online](${webUrl}/poll/${poll.id})`
      : `[📊 View & edit availability online](${webUrl}/poll/${poll.id})`;
    embed.setDescription(desc);
  }

  return embed;
}

export function buildPollButtons(options: PollOption[], pollId: string, disabled = false) {
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const chunks = chunkArray(options, 5);

  for (const chunk of chunks) {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      chunk.map((opt) =>
        new ButtonBuilder()
          .setCustomId(`sched_vote_${pollId}_${opt.id}`)
          .setLabel(opt.label)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled)
      )
    );
    rows.push(row);
  }

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`sched_close_${pollId}`)
      .setLabel('Close Poll')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled)
  );
  rows.push(closeRow);

  return rows;
}

export async function buildCalendarPollEmbed(poll: Poll, guild: Guild, closed = false) {
  const availability = getCalendarAvailability(poll.id);
  const tz = poll.timezone ?? 'UTC';
  const webUrl = process.env.WEB_URL;

  const creator = await guild.members.fetch(poll.creator_id).then((m) => m.displayName).catch(() => 'Unknown');
  const uniqueUsers = new Set(availability.map((a) => a.user_id)).size;

  const startDt = DateTime.fromMillis(poll.start_time!, { zone: tz });
  const endDt = DateTime.fromMillis(poll.end_time!, { zone: tz });
  const rangeStr = `${startDt.toFormat("EEE MMM d h:mma")} – ${endDt.toFormat("EEE MMM d h:mma")} (${tz})`;

  const slotCounts = new Map<number, Set<string>>();
  for (const a of availability) {
    if (!slotCounts.has(a.slot_time)) slotCounts.set(a.slot_time, new Set());
    slotCounts.get(a.slot_time)!.add(a.user_id);
  }

  let topSlotsStr = 'No responses yet — be the first!';
  if (slotCounts.size > 0) {
    const sorted = [...slotCounts.entries()]
      .sort((a, b) => b[1].size - a[1].size || a[0] - b[0])
      .slice(0, 3);
    topSlotsStr = sorted.map(([t, users]) => {
      const dt = DateTime.fromMillis(t, { zone: tz });
      return `**${dt.toFormat('EEE MMM d h:mma')}** — ${users.size} available`;
    }).join('\n');
  }

  const embed = new EmbedBuilder()
    .setTitle(`🗓️ ${poll.name}`)
    .setColor(closed ? CLOSED_GREY : GLITCH_BLUE)
    .addFields(
      { name: 'Window', value: rangeStr, inline: false },
      { name: closed ? '🏆 Best slots' : '📊 Top slots so far', value: topSlotsStr, inline: false }
    )
    .setFooter({
      text: `${closed ? 'Closed' : 'Open'} • Created by ${creator} • ${uniqueUsers} ${uniqueUsers === 1 ? 'response' : 'responses'} • ID: ${poll.id}`,
    })
    .setTimestamp(poll.created_at);

  if (!closed && webUrl) {
    embed.setDescription(`[📅 Add your availability](${webUrl}/poll/${poll.id})`);
  }

  return embed;
}

export function buildCalendarPollButtons(pollId: string, disabled = false) {
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`sched_close_${pollId}`)
        .setLabel('Close Poll')
        .setStyle(ButtonStyle.Danger)
        .setDisabled(disabled)
    ),
  ];
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}
