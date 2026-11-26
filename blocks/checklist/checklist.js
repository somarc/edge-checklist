import { getMetadata } from '../../scripts/aem.js';
import { isAuthoring } from '../../scripts/scripts.js';

const LEVELS = ['must', 'should', 'could'];
const VERIFIERS = ['machine', 'agent', 'human'];
const FORMATS = [
  ['txt', 'Plain text'],
  ['md', 'Markdown'],
  ['gh', 'GitHub'],
  ['jira', 'Jira'],
  ['slack', 'Slack'],
  ['agent', 'Agent prompt'],
];

const storageKey = () => `edge-checklist:${window.location.pathname}`;

function readState() {
  try {
    return new Set(JSON.parse(localStorage.getItem(storageKey())) || []);
  } catch {
    return new Set();
  }
}

function writeState(done) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify([...done]));
  } catch { /* storage unavailable: keep state in memory only */ }
}

/**
 * Reads one authored row into plain data. Pure: never touches the DOM it reads.
 * @param {Element} row checklist row
 */
function readItem(row) {
  const text = row.querySelector('.checklist-text');
  const title = row.querySelector('.checklist-title');
  const detail = [...(text?.querySelectorAll('p') || [])].map((p) => p.textContent.trim()).join(' ');
  const source = row.querySelector('.checklist-source a');
  return {
    key: title?.textContent.trim() || '',
    title: title?.textContent.trim() || '',
    detail,
    level: row.dataset.level || '',
    verify: row.querySelector('.checklist-verify')?.textContent.trim() || '',
    source: source?.href || '',
  };
}

function exportText(items, done, fmt) {
  const page = document.querySelector('main h1')?.textContent.trim() || document.title;
  const category = getMetadata('category');
  const heading = category ? `${page} (${category})` : page;
  const summary = getMetadata('description');
  const line = (it, i) => {
    const x = done.has(it.key);
    switch (fmt) {
      case 'md': return `- [${x ? 'x' : ' '}] **${it.title}**: ${it.detail}${it.source ? ` ([source](${it.source}))` : ''}`;
      case 'gh': return `- [${x ? 'x' : ' '}] **${it.title}** (${it.level}): ${it.detail}\n  <sub>${it.verify}${it.source ? ` · ${it.source}` : ''}</sub>`;
      case 'jira': return `* ${x ? '(/)' : '(x)'} *${it.title}* (${it.level}): ${it.detail}${it.source ? ` [source|${it.source}]` : ''}`;
      case 'slack': return `${x ? '☑' : '☐'} *${it.title}*: ${it.detail}`;
      case 'agent': return `${i + 1}. [${it.level}] ${it.title}: ${it.detail} (verify: ${it.verify})`;
      default: return `[${x ? 'x' : ' '}] ${it.title}: ${it.detail}`;
    }
  };
  const body = items.map(line).join('\n');
  switch (fmt) {
    case 'md': return `## ${heading}\n\n${summary}\n\n${body}\n`;
    case 'gh': return `### ${heading} checklist\n\n${summary}\n\n${body}\n\nSource: ${window.location.href}\n`;
    case 'jira': return `h3. ${heading} checklist\n${summary}\n\n${body}\n`;
    case 'slack': return `*${heading} checklist*, ${done.size}/${items.length} done\n${body}\n${window.location.href}`;
    case 'agent': return `Audit <preview URL, branch or repo> against the "${page}" checklist for AEM Edge Delivery Services (${window.location.href}). For each item, say present, partial or missing, cite evidence from the rendered page or repo, and run the machine checks named.\n\n${body}\n`;
    default: return `${heading}\n${summary}\n\n${body}\n`;
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function el(tag, attrs = {}, text = '') {
  const node = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  if (text) node.textContent = text;
  return node;
}

/**
 * Adds published-only interaction: checkboxes, progress, filter, reset and export.
 * @param {Element} block checklist block
 * @param {Element[]} rows classified rows
 */
function addInteraction(block, rows) {
  const done = readState();
  const items = rows.map(readItem);
  const mustCount = rows.filter((r) => r.dataset.level === 'must').length;

  const head = el('div', { class: 'checklist-head' });
  const score = el('h2', { class: 'checklist-score', 'aria-live': 'polite' });
  const actions = el('div', { class: 'checklist-actions' });
  const filter = el('div', { class: 'checklist-filter', role: 'group', 'aria-label': 'Filter checks' });
  const allBtn = el('button', { type: 'button', 'aria-pressed': 'true' }, 'All');
  const mustBtn = el('button', { type: 'button', 'aria-pressed': 'false' }, `Must ${mustCount}`);
  filter.append(allBtn, mustBtn);
  const reset = el('button', { type: 'button', class: 'checklist-reset' }, 'Reset');
  const progress = el('span', { class: 'checklist-progress', 'aria-hidden': 'true' });
  actions.append(filter, reset);
  head.append(score, actions, progress);
  block.prepend(head);

  const doneNote = el('p', { class: 'checklist-done', hidden: '' }, `All ${rows.length} checked. Keep it 100.`);
  const exportBar = el('div', { class: 'checklist-export' });
  exportBar.append(el('span', { class: 'checklist-export-label' }, 'Copy as'));
  const status = el('span', { class: 'checklist-export-status', role: 'status' });
  FORMATS.forEach(([fmt, label]) => {
    const btn = el('button', { type: 'button', 'data-format': fmt }, label);
    btn.addEventListener('click', async () => {
      const ok = await copyText(exportText(items, done, fmt));
      status.textContent = ok ? `${label} copied` : 'Copy blocked in this browser';
    });
    exportBar.append(btn);
  });
  exportBar.append(status);
  block.append(doneNote, exportBar);

  const boxes = rows.map((row, i) => {
    const titleId = row.querySelector('.checklist-title')?.id;
    const box = el('input', { type: 'checkbox', class: 'checklist-box' });
    if (titleId) box.setAttribute('aria-labelledby', titleId);
    box.checked = done.has(items[i].key);
    row.classList.toggle('is-done', box.checked);
    row.prepend(box);
    return box;
  });

  const update = () => {
    boxes.forEach((box, i) => {
      if (box.checked) done.add(items[i].key); else done.delete(items[i].key);
      rows[i].classList.toggle('is-done', box.checked);
    });
    writeState(done);
    const n = boxes.filter((b) => b.checked).length;
    score.textContent = `${n} out of ${rows.length}`;
    progress.style.inlineSize = `${(n / rows.length) * 100}%`;
    doneNote.hidden = n !== rows.length;
  };

  boxes.forEach((box) => box.addEventListener('change', update));
  rows.forEach((row, i) => row.addEventListener('click', (e) => {
    if (e.target.closest('a, input, button')) return;
    boxes[i].checked = !boxes[i].checked;
    update();
  }));
  reset.addEventListener('click', () => {
    boxes.forEach((b) => { b.checked = false; });
    update();
  });
  const setFilter = (mustOnly) => {
    allBtn.setAttribute('aria-pressed', String(!mustOnly));
    mustBtn.setAttribute('aria-pressed', String(mustOnly));
    rows.forEach((row) => { row.hidden = mustOnly && row.dataset.level !== 'must'; });
  };
  allBtn.addEventListener('click', () => setFilter(false));
  mustBtn.addEventListener('click', () => setFilter(true));
  update();
}

/**
 * Checklist block: one authored row per check.
 * | Check (heading + detail) | Level | Verify | Source |
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const rows = [...block.children];
  rows.forEach((row, i) => {
    row.classList.add('checklist-item');
    const [text, level, verify, source] = row.children;
    text?.classList.add('checklist-text');
    if (level) {
      level.classList.add('checklist-level');
      const l = level.textContent.trim().toLowerCase();
      if (LEVELS.includes(l)) row.dataset.level = l;
    }
    if (verify) {
      verify.classList.add('checklist-verify');
      const v = VERIFIERS.find((name) => verify.textContent.trim().toLowerCase().startsWith(name));
      if (v) row.dataset.verify = v;
    }
    source?.classList.add('checklist-source');
    const title = text?.querySelector('h2, h3, h4, h5, h6, strong');
    if (title) {
      title.classList.add('checklist-title');
      if (!title.id) title.id = `check-${i + 1}`;
    }
  });

  if (isAuthoring()) return;
  addInteraction(block, rows);
}
