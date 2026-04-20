import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Guild,
} from 'discord.js';
import { Poll, PollOption, PollVote, getVotesForPoll } from './db';

const CLARITY_BLUE = 0x5865f2;
const CLOSED_GREY = 0x747f8d;

export async function buildPollEmbed(
  poll: Poll,
  options: PollOption[],
  guild: Guild,
  closed = false
) {
  const votes = getVotesForPoll(poll.id);

  const fields = await Promise.all(
    options.map(async (opt) => {
      const optVotes = votes.filter((v) => v.option_id === opt.id);
      let names = '—';
      if (optVotes.length > 0) {
        const members = await Promise.all(
          optVotes.map((v) =>
            guild.members.fetch(v.user_id).then((m) => m.displayName).catch(() => 'Unknown')
          )
        );
        names = members.join(', ');
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

  return new EmbedBuilder()
    .setTitle(`🗓️ ${poll.name}`)
    .setColor(closed ? CLOSED_GREY : CLARITY_BLUE)
    .addFields(fields)
    .setFooter({
      text: `${closed ? 'Closed' : 'Open'} • Created by ${creator} • ${uniqueVoters} ${uniqueVoters === 1 ? 'response' : 'responses'} • ID: ${poll.id}`,
    })
    .setTimestamp(poll.created_at);
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

function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}
