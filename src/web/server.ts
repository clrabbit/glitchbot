import express from 'express';
import { getPoll, getPollOptions, getVotesForPoll, toggleVote, addPollOption } from '../modules/scheduling/db';
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json());

app.get('/poll/:id', (req, res) => {
  const poll = getPoll(req.params.id);
  if (!poll) return res.status(404).send(renderError('Poll not found'));
  const options = getPollOptions(poll.id);
  const votes = getVotesForPoll(poll.id);
  res.send(renderPollPage(poll, options, votes));
});

app.post('/poll/:id/vote', (req, res) => {
  const poll = getPoll(req.params.id);
  if (!poll) return res.status(404).json({ error: 'Poll not found' });
  if (poll.closed) return res.status(400).json({ error: 'Poll is closed' });

  const { name, optionIds } = req.body as { name: string; optionIds: number[] };
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!Array.isArray(optionIds)) return res.status(400).json({ error: 'optionIds must be an array' });

  const userId = `web:${name.trim().toLowerCase().replace(/\s+/g, '_')}_${randomUUID().slice(0, 6)}`;
  const options = getPollOptions(poll.id);

  for (const opt of options) {
    const wantsVote = optionIds.includes(opt.id);
    const votes = getVotesForPoll(poll.id);
    const hasVote = votes.some(v => v.user_id === userId && v.option_id === opt.id);
    if (wantsVote && !hasVote) toggleVote(poll.id, opt.id, userId, name.trim());
    if (!wantsVote && hasVote) toggleVote(poll.id, opt.id, userId, name.trim());
  }

  res.json({ ok: true, userId });
});

app.patch('/poll/:id/vote', (req, res) => {
  const poll = getPoll(req.params.id);
  if (!poll) return res.status(404).json({ error: 'Poll not found' });
  if (poll.closed) return res.status(400).json({ error: 'Poll is closed' });

  const { userId, optionId } = req.body as { userId: string; optionId: number };
  if (!userId || !optionId) return res.status(400).json({ error: 'userId and optionId required' });

  const votes = getVotesForPoll(poll.id);
  const existing = votes.find(v => v.user_id === userId && v.option_id === optionId);
  const displayName = existing?.display_name ?? votes.find(v => v.user_id === userId)?.display_name ?? undefined;

  const action = toggleVote(poll.id, optionId, userId, displayName);
  const updated = getVotesForPoll(poll.id);
  const optVotes = updated.filter(v => v.option_id === optionId);

  res.json({ action, count: optVotes.length, names: optVotes.map(v => v.display_name ?? v.user_id) });
});

function renderError(msg: string) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;background:#1a1a2e;color:#fff"><h2>${msg}</h2></body></html>`;
}

function renderPollPage(
  poll: { id: string; name: string; closed: number },
  options: { id: number; label: string }[],
  votes: { option_id: number; user_id: string; display_name: string | null }[]
) {
  const optionsJson = JSON.stringify(options);
  const votesJson = JSON.stringify(votes);
  const closed = poll.closed === 1;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(poll.name)} — GlitchBot</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg: #0d0d14;
      --surface: #1a1a2e;
      --surface2: #242438;
      --accent: #5865f2;
      --accent-hover: #4752c4;
      --green: #3ba55c;
      --green-light: #57d986;
      --text: #e0e0f0;
      --muted: #7878a0;
      --border: #2e2e4e;
    }
    body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; min-height: 100vh; padding: 2rem 1rem; }
    .container { max-width: 800px; margin: 0 auto; }
    header { margin-bottom: 2rem; }
    header h1 { font-size: 1.75rem; font-weight: 700; }
    header .meta { color: var(--muted); font-size: 0.875rem; margin-top: 0.4rem; }
    .closed-badge { display: inline-block; background: #444; color: #aaa; font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 99px; margin-left: 0.5rem; vertical-align: middle; }

    /* Grid */
    .grid-wrap { overflow-x: auto; margin-bottom: 2rem; }
    table { border-collapse: collapse; width: 100%; min-width: 400px; }
    th { background: var(--surface2); padding: 0.75rem 1rem; text-align: center; font-size: 0.875rem; font-weight: 600; border: 1px solid var(--border); white-space: nowrap; }
    th.label-col { text-align: left; min-width: 120px; }
    td { padding: 0.5rem 1rem; border: 1px solid var(--border); text-align: center; font-size: 0.875rem; }
    td.name-cell { text-align: left; color: var(--muted); font-size: 0.8rem; }
    .count-row td { background: var(--surface2); font-weight: 700; color: var(--green-light); }
    .avail { background: rgba(59, 165, 92, 0.2); color: var(--green-light); font-size: 1rem; }
    .unavail { color: var(--muted); font-size: 0.75rem; }

    /* Add availability form */
    .form-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; }
    .form-card h2 { font-size: 1.1rem; margin-bottom: 1rem; }
    .name-row { display: flex; gap: 0.75rem; margin-bottom: 1.25rem; align-items: center; }
    .name-row input { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 0.9rem; color: var(--text); font-size: 0.95rem; outline: none; }
    .name-row input:focus { border-color: var(--accent); }
    .slots { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; }
    .slot-btn { background: var(--surface2); border: 2px solid var(--border); border-radius: 8px; padding: 0.5rem 1rem; color: var(--text); font-size: 0.875rem; cursor: pointer; transition: all 0.15s; user-select: none; }
    .slot-btn:hover { border-color: var(--accent); }
    .slot-btn.selected { background: rgba(59,165,92,0.15); border-color: var(--green); color: var(--green-light); }
    .submit-btn { background: var(--accent); color: #fff; border: none; border-radius: 8px; padding: 0.65rem 1.5rem; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
    .submit-btn:hover { background: var(--accent-hover); }
    .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .feedback { margin-top: 0.75rem; font-size: 0.875rem; color: var(--green-light); min-height: 1.2em; }
    .feedback.error { color: #f87171; }
    .add-slot-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .add-slot-card h2 { font-size: 1.1rem; margin-bottom: 0.5rem; }
    .add-slot-card p { color: var(--muted); font-size: 0.85rem; margin-bottom: 1rem; }
    .add-slot-row { display: flex; gap: 0.75rem; align-items: center; }
    .add-slot-row input { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 0.9rem; color: var(--text); font-size: 0.95rem; outline: none; }
    .add-slot-row input:focus { border-color: var(--accent); }
    .add-slot-feedback { margin-top: 0.6rem; font-size: 0.875rem; color: var(--green-light); min-height: 1.2em; }
    .add-slot-feedback.error { color: #f87171; }
  </style>
</head>
<body>
<div class="container">
  <header>
    <h1>🗓️ ${escHtml(poll.name)}${closed ? '<span class="closed-badge">Closed</span>' : ''}</h1>
    <p class="meta">Poll ID: ${escHtml(poll.id)}</p>
  </header>

  <div class="grid-wrap">
    <table id="grid">
      <thead>
        <tr>
          <th class="label-col">Who</th>
          ${options.map(o => `<th>${escHtml(o.label)}</th>`).join('')}
        </tr>
      </thead>
      <tbody id="grid-body"></tbody>
      <tfoot>
        <tr class="count-row">
          <td>Available</td>
          ${options.map(o => `<td id="count-${o.id}">0</td>`).join('')}
        </tr>
      </tfoot>
    </table>
  </div>

  ${closed ? '' : `
  <div class="add-slot-card">
    <h2>Add a time slot</h2>
    <p>Add a new time option others can vote on. E.g. "Sat May 3, 7–10pm" or "Sunday afternoon".</p>
    <div class="add-slot-row">
      <input type="text" id="slot-input" placeholder="e.g. Saturday 7pm–10pm" maxlength="80" />
      <button class="submit-btn" id="add-slot-btn">Add slot</button>
    </div>
    <p class="add-slot-feedback" id="slot-feedback"></p>
  </div>

  <div class="form-card">
    <h2>Add your availability</h2>
    <div class="name-row">
      <input type="text" id="name-input" placeholder="Your name or Discord handle" maxlength="40" />
    </div>
    <div class="slots">
      ${options.map(o => `<button class="slot-btn" data-id="${o.id}">${escHtml(o.label)}</button>`).join('')}
    </div>
    <button class="submit-btn" id="submit-btn">Save availability</button>
    <p class="feedback" id="feedback"></p>
  </div>
  `}
</div>

<script>
const OPTIONS = ${optionsJson};
const POLL_ID = ${JSON.stringify(poll.id)};
let votes = ${votesJson};

function getDisplayName(v) {
  return v.display_name || v.user_id.replace(/^web:/, '').replace(/_[a-f0-9]{6}$/, '').replace(/_/g, ' ');
}

function renderGrid() {
  const body = document.getElementById('grid-body');
  const voters = [...new Map(votes.map(v => [v.user_id, v])).values()];

  body.innerHTML = voters.map(v => {
    const name = getDisplayName(v);
    const cells = OPTIONS.map(o => {
      const has = votes.some(x => x.user_id === v.user_id && x.option_id === o.id);
      return \`<td class="\${has ? 'avail' : 'unavail'}">\${has ? '✓' : '–'}</td>\`;
    }).join('');
    return \`<tr><td class="name-cell">\${name}</td>\${cells}</tr>\`;
  }).join('');

  OPTIONS.forEach(o => {
    const count = votes.filter(v => v.option_id === o.id).length;
    document.getElementById('count-' + o.id).textContent = count;
  });
}

renderGrid();

${closed ? '' : `
document.getElementById('add-slot-btn').addEventListener('click', async () => {
  const label = document.getElementById('slot-input').value.trim();
  const feedback = document.getElementById('slot-feedback');
  const btn = document.getElementById('add-slot-btn');

  if (!label) { feedback.textContent = 'Please enter a time slot.'; feedback.className = 'add-slot-feedback error'; return; }

  btn.disabled = true;
  feedback.textContent = '';

  try {
    const res = await fetch('/poll/' + POLL_ID + '/option', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    OPTIONS.push(data.option);

    // add column header
    const thead = document.querySelector('#grid thead tr');
    const th = document.createElement('th');
    th.textContent = data.option.label;
    thead.appendChild(th);

    // add count cell
    const countRow = document.querySelector('.count-row');
    const td = document.createElement('td');
    td.id = 'count-' + data.option.id;
    td.textContent = '0';
    countRow.appendChild(td);

    // add slot button to availability form
    const slotsDiv = document.querySelector('.slots');
    const btn2 = document.createElement('button');
    btn2.className = 'slot-btn';
    btn2.dataset.id = data.option.id;
    btn2.textContent = data.option.label;
    btn2.addEventListener('click', () => {
      const id = parseInt(btn2.dataset.id);
      if (selected.has(id)) { selected.delete(id); btn2.classList.remove('selected'); }
      else { selected.add(id); btn2.classList.add('selected'); }
    });
    slotsDiv.appendChild(btn2);

    renderGrid();
    feedback.textContent = '✓ Time slot added!';
    feedback.className = 'add-slot-feedback';
    document.getElementById('slot-input').value = '';
  } catch(e) {
    feedback.textContent = e.message || 'Something went wrong.';
    feedback.className = 'add-slot-feedback error';
  } finally {
    btn.disabled = false;
  }
});

const selected = new Set();
document.querySelectorAll('.slot-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = parseInt(btn.dataset.id);
    if (selected.has(id)) { selected.delete(id); btn.classList.remove('selected'); }
    else { selected.add(id); btn.classList.add('selected'); }
  });
});

document.getElementById('submit-btn').addEventListener('click', async () => {
  const name = document.getElementById('name-input').value.trim();
  const feedback = document.getElementById('feedback');
  const btn = document.getElementById('submit-btn');

  if (!name) { feedback.textContent = 'Please enter your name.'; feedback.className = 'feedback error'; return; }
  if (selected.size === 0) { feedback.textContent = 'Select at least one time slot.'; feedback.className = 'feedback error'; return; }

  btn.disabled = true;
  feedback.textContent = '';

  try {
    const res = await fetch('/poll/' + POLL_ID + '/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, optionIds: [...selected] })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const newVotes = await fetch('/poll/' + POLL_ID + '/data').then(r => r.json()).catch(() => null);
    if (newVotes) { votes = newVotes; renderGrid(); }

    feedback.textContent = '✓ Availability saved!';
    feedback.className = 'feedback';
    document.getElementById('name-input').value = '';
    selected.clear();
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  } catch(e) {
    feedback.textContent = e.message || 'Something went wrong.';
    feedback.className = 'feedback error';
  } finally {
    btn.disabled = false;
  }
});
`}
</script>
</body>
</html>`;
}

app.post('/poll/:id/option', (req, res) => {
  const poll = getPoll(req.params.id);
  if (!poll) return res.status(404).json({ error: 'Poll not found' });
  if (poll.closed) return res.status(400).json({ error: 'Poll is closed' });

  const { label } = req.body as { label: string };
  if (!label?.trim()) return res.status(400).json({ error: 'Label is required' });
  if (label.trim().length > 80) return res.status(400).json({ error: 'Label too long (max 80 chars)' });

  const options = getPollOptions(poll.id);
  if (options.length >= 10) return res.status(400).json({ error: 'Maximum 10 time slots per poll' });

  const option = addPollOption(poll.id, label);
  res.json({ ok: true, option });
});

app.get('/poll/:id/data', (req, res) => {
  const poll = getPoll(req.params.id);
  if (!poll) return res.status(404).json({ error: 'not found' });
  res.json(getVotesForPoll(poll.id));
});

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function startWebServer(port: number) {
  app.listen(port, () => console.log(`[GlitchBot] Web server on port ${port}`));
}
