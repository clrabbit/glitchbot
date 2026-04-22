import express from 'express';
import {
  getPoll,
  getPollOptions,
  getVotesForPoll,
  toggleVote,
  addPollOption,
  getCalendarAvailability,
  setCalendarAvailability,
  getPollSlots,
} from '../modules/scheduling/db';
import { randomUUID } from 'crypto';

const app = express();
app.use(express.json());

// ── Poll page ────────────────────────────────────────────────────────────────

app.get('/poll/:id', (req, res) => {
  const poll = getPoll(req.params.id);
  if (!poll) return res.status(404).send(renderError('Poll not found'));

  if (poll.poll_type === 'calendar') {
    const slots = getPollSlots(poll);
    const availability = getCalendarAvailability(poll.id);
    return res.send(renderCalendarPage(poll, slots, availability));
  }

  const options = getPollOptions(poll.id);
  const votes = getVotesForPoll(poll.id);
  res.send(renderSlotsPage(poll, options, votes));
});

// ── Calendar availability ────────────────────────────────────────────────────

app.post('/poll/:id/availability', (req, res) => {
  const poll = getPoll(req.params.id);
  if (!poll || poll.poll_type !== 'calendar') return res.status(404).json({ error: 'Poll not found' });
  if (poll.closed) return res.status(400).json({ error: 'Poll is closed' });

  const { name, slotTimes } = req.body as { name: string; slotTimes: number[] };
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!Array.isArray(slotTimes)) return res.status(400).json({ error: 'slotTimes must be an array' });

  const validSlots = new Set(getPollSlots(poll));
  const filtered = slotTimes.filter((t) => validSlots.has(t));

  const userId = `web:${name.trim().toLowerCase().replace(/\s+/g, '_')}`;
  setCalendarAvailability(poll.id, userId, name.trim(), filtered);

  res.json({ ok: true, userId });
});

app.get('/poll/:id/availability', (req, res) => {
  const poll = getPoll(req.params.id);
  if (!poll) return res.status(404).json({ error: 'not found' });
  res.json(getCalendarAvailability(poll.id));
});

// ── Legacy slots endpoints ───────────────────────────────────────────────────

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

// ── HTML renderers ────────────────────────────────────────────────────────────

function renderError(msg: string) {
  return `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:2rem;background:#1a1a2e;color:#fff"><h2>${msg}</h2></body></html>`;
}

function escHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const BASE_CSS = `
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
  .container { max-width: 900px; margin: 0 auto; }
  header { margin-bottom: 2rem; }
  header h1 { font-size: 1.75rem; font-weight: 700; }
  header .meta { color: var(--muted); font-size: 0.875rem; margin-top: 0.4rem; }
  .closed-badge { display: inline-block; background: #444; color: #aaa; font-size: 0.75rem; padding: 0.2rem 0.6rem; border-radius: 99px; margin-left: 0.5rem; vertical-align: middle; }
  .card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
  .card h2 { font-size: 1.1rem; margin-bottom: 0.75rem; }
  .card p.hint { color: var(--muted); font-size: 0.85rem; margin-bottom: 1rem; }
  .submit-btn { background: var(--accent); color: #fff; border: none; border-radius: 8px; padding: 0.65rem 1.5rem; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: background 0.15s; }
  .submit-btn:hover { background: var(--accent-hover); }
  .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .feedback { margin-top: 0.75rem; font-size: 0.875rem; color: var(--green-light); min-height: 1.2em; }
  .feedback.error { color: #f87171; }
  input[type=text] { background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 0.9rem; color: var(--text); font-size: 0.95rem; outline: none; }
  input[type=text]:focus { border-color: var(--accent); }
`;

// ── Calendar page ─────────────────────────────────────────────────────────────

function renderCalendarPage(
  poll: { id: string; name: string; closed: number; timezone: string | null },
  slots: number[],
  availability: { user_id: string; display_name: string | null; slot_time: number }[]
) {
  const closed = poll.closed === 1;
  const slotsJson = JSON.stringify(slots);
  const availJson = JSON.stringify(availability);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escHtml(poll.name)} — GlitchBot</title>
  <style>
    ${BASE_CSS}

    /* Calendar grid */
    .grid-scroll { overflow-x: auto; margin-bottom: 1.5rem; }
    .cal-table { border-collapse: collapse; font-size: 0.8rem; }
    .cal-table th { background: var(--surface2); padding: 0.5rem 0.75rem; text-align: center; border: 1px solid var(--border); white-space: nowrap; font-weight: 600; min-width: 90px; }
    .cal-table th.time-col { min-width: 70px; text-align: right; }
    .cal-table td { border: 1px solid var(--border); padding: 0; width: 90px; height: 36px; }
    .cal-table td.time-label { padding: 0 0.6rem; color: var(--muted); text-align: right; white-space: nowrap; font-size: 0.78rem; background: var(--surface); }
    .slot-cell { cursor: pointer; position: relative; transition: outline 0.1s; }
    .slot-cell:hover { outline: 2px solid var(--accent); outline-offset: -2px; z-index: 1; }
    .slot-cell.mine { outline: 2px solid var(--green-light) !important; outline-offset: -2px; z-index: 2; }
    .slot-cell .count-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 600; color: var(--text); pointer-events: none; opacity: 0.85; }
    .no-slot { background: var(--bg); }
    .tz-note { color: var(--muted); font-size: 0.78rem; margin-bottom: 1rem; }

    /* Tooltip */
    .tooltip { position: fixed; background: #1a1a2e; border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.8rem; pointer-events: none; z-index: 100; max-width: 200px; display: none; }
    .tooltip .tt-time { font-weight: 600; margin-bottom: 0.3rem; color: var(--green-light); }
    .tooltip .tt-names { color: var(--text); line-height: 1.5; }

    /* Name input row */
    .name-row { display: flex; gap: 0.75rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap; }
    .name-row input { flex: 1; min-width: 160px; max-width: 260px; }
    .legend { display: flex; gap: 1.25rem; font-size: 0.8rem; color: var(--muted); margin-bottom: 1rem; align-items: center; flex-wrap: wrap; }
    .legend-swatch { width: 16px; height: 16px; border-radius: 3px; border: 1px solid var(--border); display: inline-block; margin-right: 4px; vertical-align: middle; }
  </style>
</head>
<body>
<div class="container">
  <header>
    <h1>🗓️ ${escHtml(poll.name)}${closed ? '<span class="closed-badge">Closed</span>' : ''}</h1>
    <p class="meta">Poll ID: ${escHtml(poll.id)}</p>
  </header>

  <div class="card">
    <h2>Availability</h2>
    <p class="tz-note" id="tz-note">Times shown in your local timezone.</p>
    <div class="legend">
      <span><span class="legend-swatch" style="background:rgba(59,165,92,0.15)"></span> 1 person</span>
      <span><span class="legend-swatch" style="background:rgba(59,165,92,0.55)"></span> some overlap</span>
      <span><span class="legend-swatch" style="background:rgba(59,165,92,0.85)"></span> most available</span>
      ${closed ? '' : '<span><span class="legend-swatch" style="outline:2px solid #57d986;outline-offset:-2px;background:transparent"></span> your selection</span>'}
    </div>
    <div class="grid-scroll">
      <table class="cal-table" id="cal-table"></table>
    </div>
  </div>

  ${closed ? '' : `
  <div class="card">
    <h2>Add your availability</h2>
    <p class="hint">Enter your name, then click (or click and drag) the times you're free. Hit Save when done.</p>
    <div class="name-row">
      <input type="text" id="name-input" placeholder="Your name or Discord handle" maxlength="40" />
      <button class="submit-btn" id="save-btn">Save availability</button>
    </div>
    <p class="feedback" id="feedback"></p>
  </div>
  `}
</div>

<div class="tooltip" id="tooltip">
  <div class="tt-time" id="tt-time"></div>
  <div class="tt-names" id="tt-names"></div>
</div>

<script>
const SLOTS = ${slotsJson};
const POLL_ID = ${JSON.stringify(poll.id)};
const IS_CLOSED = ${closed};
let avail = ${availJson};

const USER_TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
document.getElementById('tz-note').textContent = 'Times shown in your timezone: ' + USER_TZ;

function fmtDate(ms) {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: USER_TZ }).format(new Date(ms));
}
function fmtTime(ms) {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: USER_TZ }).format(new Date(ms));
}
function dayKey(ms) {
  // Returns a sortable day string like "2026-05-03"
  const d = new Date(ms);
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: USER_TZ }).formatToParts(d);
  return parts.filter(p => p.type !== 'literal').map(p => p.value).join('-');
}
function hourKey(ms) {
  // Returns a sortable hour string like "18:00"
  return new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: USER_TZ }).format(new Date(ms));
}

// Build grid structure
const dayMap = new Map(); // dayKey -> [{slot, hourKey}]
const allHours = new Set();

for (const slot of SLOTS) {
  const dk = dayKey(slot);
  const hk = hourKey(slot);
  if (!dayMap.has(dk)) dayMap.set(dk, new Map());
  dayMap.get(dk).set(hk, slot);
  allHours.add(hk);
}

const sortedDays = [...dayMap.keys()].sort();
const sortedHours = [...allHours].sort();

// Availability lookup: slotTime -> [displayName]
function buildAvailMap(data) {
  const m = new Map();
  for (const a of data) {
    if (!m.has(a.slot_time)) m.set(a.slot_time, []);
    const name = a.display_name || a.user_id.replace(/^web:/, '').replace(/_/g, ' ');
    if (!m.get(a.slot_time).includes(name)) m.get(a.slot_time).push(name);
  }
  return m;
}

let availMap = buildAvailMap(avail);
const maxCount = () => Math.max(...SLOTS.map(s => (availMap.get(s) || []).length), 1);

function heatColor(count) {
  if (count === 0) return 'var(--surface2)';
  const intensity = count / maxCount();
  const alpha = (0.12 + intensity * 0.73).toFixed(2);
  return \`rgba(59,165,92,\${alpha})\`;
}

const mySlots = new Set();

function buildTable() {
  const table = document.getElementById('cal-table');
  table.innerHTML = '';

  // Header row
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const cornerTh = document.createElement('th');
  cornerTh.className = 'time-col';
  headRow.appendChild(cornerTh);
  for (const dk of sortedDays) {
    const th = document.createElement('th');
    // Display date for first slot of this day
    const firstSlot = [...dayMap.get(dk).values()][0];
    th.textContent = fmtDate(firstSlot);
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  // Body rows
  const tbody = document.createElement('tbody');
  for (const hk of sortedHours) {
    const tr = document.createElement('tr');

    const timeTd = document.createElement('td');
    timeTd.className = 'time-label';
    // Get a slot for this hour to format the time
    let sampleSlot = null;
    for (const dk of sortedDays) {
      if (dayMap.get(dk).has(hk)) { sampleSlot = dayMap.get(dk).get(hk); break; }
    }
    timeTd.textContent = sampleSlot !== null ? fmtTime(sampleSlot) : hk;
    tr.appendChild(timeTd);

    for (const dk of sortedDays) {
      const td = document.createElement('td');
      const slot = dayMap.get(dk).has(hk) ? dayMap.get(dk).get(hk) : null;

      if (slot === null) {
        td.className = 'no-slot';
      } else {
        td.className = 'slot-cell' + (mySlots.has(slot) ? ' mine' : '');
        td.dataset.slot = slot;
        const count = (availMap.get(slot) || []).length;
        td.style.background = heatColor(count);

        const label = document.createElement('div');
        label.className = 'count-label';
        label.textContent = count > 0 ? String(count) : '';
        td.appendChild(label);
      }
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  if (!IS_CLOSED) attachCellListeners();
}

// Tooltip
const tooltip = document.getElementById('tooltip');
const ttTime = document.getElementById('tt-time');
const ttNames = document.getElementById('tt-names');

document.addEventListener('mousemove', (e) => {
  const cell = e.target.closest('.slot-cell');
  if (!cell) { tooltip.style.display = 'none'; return; }
  const slot = parseInt(cell.dataset.slot);
  const names = availMap.get(slot) || [];
  if (names.length === 0 && !mySlots.has(slot)) { tooltip.style.display = 'none'; return; }

  ttTime.textContent = fmtDate(slot) + ' ' + fmtTime(slot);
  const allNames = [...names];
  if (mySlots.has(slot) && document.getElementById('name-input')?.value.trim()) {
    const myName = document.getElementById('name-input').value.trim();
    if (!allNames.includes(myName)) allNames.push(myName + ' (you)');
  }
  ttNames.textContent = allNames.length ? allNames.join(', ') : '—';
  tooltip.style.display = 'block';
  tooltip.style.left = (e.clientX + 12) + 'px';
  tooltip.style.top = (e.clientY + 12) + 'px';

  // Keep tooltip on screen
  const rect = tooltip.getBoundingClientRect();
  if (rect.right > window.innerWidth - 8) tooltip.style.left = (e.clientX - rect.width - 12) + 'px';
  if (rect.bottom > window.innerHeight - 8) tooltip.style.top = (e.clientY - rect.height - 12) + 'px';
});
document.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });

// Click + drag to select cells
let isDragging = false;
let dragAdding = true;

function attachCellListeners() {
  document.querySelectorAll('.slot-cell').forEach(cell => {
    cell.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isDragging = true;
      const slot = parseInt(cell.dataset.slot);
      dragAdding = !mySlots.has(slot);
      toggleSlot(cell, slot);
    });
    cell.addEventListener('mouseenter', () => {
      if (!isDragging) return;
      const slot = parseInt(cell.dataset.slot);
      if (dragAdding && !mySlots.has(slot)) toggleSlot(cell, slot);
      if (!dragAdding && mySlots.has(slot)) toggleSlot(cell, slot);
    });
  });
}

document.addEventListener('mouseup', () => { isDragging = false; });

function toggleSlot(cell, slot) {
  if (mySlots.has(slot)) {
    mySlots.delete(slot);
    cell.classList.remove('mine');
  } else {
    mySlots.add(slot);
    cell.classList.add('mine');
  }
}

buildTable();

${closed ? '' : `
document.getElementById('save-btn').addEventListener('click', async () => {
  const name = document.getElementById('name-input').value.trim();
  const feedback = document.getElementById('feedback');
  const btn = document.getElementById('save-btn');

  if (!name) { feedback.textContent = 'Please enter your name.'; feedback.className = 'feedback error'; return; }
  if (mySlots.size === 0) { feedback.textContent = 'Select at least one time slot.'; feedback.className = 'feedback error'; return; }

  btn.disabled = true;
  feedback.textContent = '';

  try {
    const res = await fetch('/poll/' + POLL_ID + '/availability', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, slotTimes: [...mySlots] })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const updated = await fetch('/poll/' + POLL_ID + '/availability').then(r => r.json()).catch(() => null);
    if (updated) {
      avail = updated;
      availMap = buildAvailMap(avail);
      buildTable();
    }

    feedback.textContent = '✓ Availability saved!';
    feedback.className = 'feedback';
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

// ── Legacy slots page ─────────────────────────────────────────────────────────

function renderSlotsPage(
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
    ${BASE_CSS}
    .grid-wrap { overflow-x: auto; margin-bottom: 2rem; }
    table { border-collapse: collapse; width: 100%; min-width: 400px; }
    th { background: var(--surface2); padding: 0.75rem 1rem; text-align: center; font-size: 0.875rem; font-weight: 600; border: 1px solid var(--border); white-space: nowrap; }
    th.label-col { text-align: left; min-width: 120px; }
    td { padding: 0.5rem 1rem; border: 1px solid var(--border); text-align: center; font-size: 0.875rem; }
    td.name-cell { text-align: left; color: var(--muted); font-size: 0.8rem; }
    .count-row td { background: var(--surface2); font-weight: 700; color: var(--green-light); }
    .avail { background: rgba(59, 165, 92, 0.2); color: var(--green-light); font-size: 1rem; }
    .unavail { color: var(--muted); font-size: 0.75rem; }
    .add-slot-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; }
    .add-slot-card h2 { font-size: 1.1rem; margin-bottom: 0.5rem; }
    .add-slot-card p { color: var(--muted); font-size: 0.85rem; margin-bottom: 1rem; }
    .add-slot-row { display: flex; gap: 0.75rem; align-items: center; }
    .add-slot-row input { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 0.9rem; color: var(--text); font-size: 0.95rem; outline: none; }
    .add-slot-row input:focus { border-color: var(--accent); }
    .add-slot-feedback { margin-top: 0.6rem; font-size: 0.875rem; color: var(--green-light); min-height: 1.2em; }
    .add-slot-feedback.error { color: #f87171; }
    .form-card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; }
    .form-card h2 { font-size: 1.1rem; margin-bottom: 1rem; }
    .name-row { display: flex; gap: 0.75rem; margin-bottom: 1.25rem; align-items: center; }
    .name-row input { flex: 1; background: var(--surface2); border: 1px solid var(--border); border-radius: 8px; padding: 0.6rem 0.9rem; color: var(--text); font-size: 0.95rem; outline: none; }
    .name-row input:focus { border-color: var(--accent); }
    .slots { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; }
    .slot-btn { background: var(--surface2); border: 2px solid var(--border); border-radius: 8px; padding: 0.5rem 1rem; color: var(--text); font-size: 0.875rem; cursor: pointer; transition: all 0.15s; user-select: none; }
    .slot-btn:hover { border-color: var(--accent); }
    .slot-btn.selected { background: rgba(59,165,92,0.15); border-color: var(--green); color: var(--green-light); }
    .feedback { margin-top: 0.75rem; font-size: 0.875rem; color: var(--green-light); min-height: 1.2em; }
    .feedback.error { color: #f87171; }
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
    const el = document.getElementById('count-' + o.id);
    if (el) el.textContent = votes.filter(v => v.option_id === o.id).length;
  });
}
renderGrid();

${closed ? '' : `
document.getElementById('add-slot-btn').addEventListener('click', async () => {
  const label = document.getElementById('slot-input').value.trim();
  const feedback = document.getElementById('slot-feedback');
  const btn = document.getElementById('add-slot-btn');
  if (!label) { feedback.textContent = 'Please enter a time slot.'; feedback.className = 'add-slot-feedback error'; return; }
  btn.disabled = true; feedback.textContent = '';
  try {
    const res = await fetch('/poll/' + POLL_ID + '/option', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    OPTIONS.push(data.option);
    const thead = document.querySelector('#grid thead tr');
    const th = document.createElement('th'); th.textContent = data.option.label; thead.appendChild(th);
    const countRow = document.querySelector('.count-row');
    const td = document.createElement('td'); td.id = 'count-' + data.option.id; td.textContent = '0'; countRow.appendChild(td);
    const slotsDiv = document.querySelector('.slots');
    const b = document.createElement('button');
    b.className = 'slot-btn'; b.dataset.id = data.option.id; b.textContent = data.option.label;
    b.addEventListener('click', () => {
      const id = parseInt(b.dataset.id);
      if (selected.has(id)) { selected.delete(id); b.classList.remove('selected'); }
      else { selected.add(id); b.classList.add('selected'); }
    });
    slotsDiv.appendChild(b);
    renderGrid();
    feedback.textContent = '✓ Time slot added!'; feedback.className = 'add-slot-feedback';
    document.getElementById('slot-input').value = '';
  } catch(e) {
    feedback.textContent = e.message || 'Something went wrong.'; feedback.className = 'add-slot-feedback error';
  } finally { btn.disabled = false; }
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
  btn.disabled = true; feedback.textContent = '';
  try {
    const res = await fetch('/poll/' + POLL_ID + '/vote', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, optionIds: [...selected] })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    const newVotes = await fetch('/poll/' + POLL_ID + '/data').then(r => r.json()).catch(() => null);
    if (newVotes) { votes = newVotes; renderGrid(); }
    feedback.textContent = '✓ Availability saved!'; feedback.className = 'feedback';
    document.getElementById('name-input').value = '';
    selected.clear();
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
  } catch(e) {
    feedback.textContent = e.message || 'Something went wrong.'; feedback.className = 'feedback error';
  } finally { btn.disabled = false; }
});
`}
</script>
</body>
</html>`;
}

export function startWebServer(port: number) {
  app.listen(port, () => console.log(`[GlitchBot] Web server on port ${port}`));
}
