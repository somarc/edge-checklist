/*
 * Site search dialog. Loaded by the header on first open (button, ⌘K / Ctrl+K or "/").
 * Data: /query-index.json rows under a category path; falls back to the footer's links.
 */
import { loadCSS } from './aem.js';

const CATEGORY_NAMES = {
  blocks: 'Blocks',
  pages: 'Pages',
  delivery: 'Delivery',
  authoring: 'Authoring',
  systems: 'Systems',
  flows: 'Flows',
};
const PATH_RE = /^\/(blocks|pages|delivery|authoring|systems|flows)\//;
const POPULAR = [
  '/delivery/performance',
  '/flows/going-live',
  '/blocks/hero',
  '/delivery/redirects',
  '/systems/commerce',
  '/authoring/content-model',
];
const MAX_RESULTS = 8;
const DEFAULT_ICON = 'list-checks';

let dialog;
let input;
let list;
let status;
let options = [];
let selected = 0;
let indexPromise;
let returnFocus;

const categoryOf = (path) => (PATH_RE.exec(path) || [])[1] || '';
const cleanTitle = (t = '') => t
  .replace(/\s*[|·–-]\s*Edge Checklist\s*$/i, '')
  .replace(/\s*·\s*[^·]+ checklist\s*$/i, '')
  .trim();
const humanize = (path) => {
  const slug = path.split('/').filter(Boolean).pop() || '';
  return slug.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
};

function entry({
  path, title, description = '', category = '', icon = '', keywords = '',
}) {
  const cat = categoryOf(path);
  return {
    path,
    title: cleanTitle(title) || humanize(path),
    description: description || '',
    category: cat,
    categoryName: CATEGORY_NAMES[cat] || category,
    icon: (icon || '').trim(),
    keywords: String(keywords || '').split(',').map((k) => k.trim()).filter(Boolean),
  };
}

async function fromIndex() {
  try {
    const resp = await fetch('/query-index.json');
    if (!resp.ok) return [];
    const json = await resp.json();
    return (json.data || [])
      .filter((r) => PATH_RE.test(r.path || ''))
      .map((r) => entry(r));
  } catch (e) {
    return [];
  }
}

/** The footer lists every checklist per category column: the fallback data source. */
function fromFooter() {
  const seen = new Set();
  return [...document.querySelectorAll('footer .columns a[href]')].reduce((acc, a) => {
    const { pathname } = new URL(a.href, window.location);
    if (seen.has(pathname)) return acc;
    seen.add(pathname);
    const cell = a.closest('.columns > div > div');
    const heading = cell?.querySelector('h1, h2, h3, h4, h5, h6')?.textContent.trim() || '';
    const iconSpan = a.querySelector('.icon');
    const icon = iconSpan ? [...iconSpan.classList].find((c) => c.startsWith('icon-'))?.slice(5) : '';
    acc.push(entry({
      path: pathname, title: a.textContent.trim(), category: heading, icon,
    }));
    return acc;
  }, []);
}

async function getEntries() {
  if (!indexPromise) indexPromise = fromIndex();
  const rows = await indexPromise;
  return rows.length ? rows : fromFooter();
}

function search(query, data) {
  const q = query.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  const results = [];
  data.forEach((e) => {
    const title = e.title.toLowerCase();
    const head = `${title} ${e.description} ${e.categoryName}`.toLowerCase();
    const keywords = e.keywords.map((k) => k.toLowerCase());
    const all = `${head} ${keywords.join(' ')}`;
    if (!terms.every((t) => all.includes(t))) return;
    let score;
    if (title.startsWith(q)) score = 0;
    else if (terms.every((t) => title.includes(t))) score = 1;
    else if (terms.every((t) => head.includes(t))) score = 2;
    else score = 3;
    let check = '';
    if (score === 3) {
      // matched through a check title: show the check that carries most of the missing terms
      const missing = terms.filter((t) => !head.includes(t));
      let best = 0;
      keywords.forEach((k, i) => {
        const hits = missing.filter((t) => k.includes(t)).length;
        if (hits > best) { best = hits; check = e.keywords[i]; }
      });
    }
    results.push({ e, score, check });
  });
  results.sort((a, b) => a.score - b.score || a.e.title.localeCompare(b.e.title));
  return { terms, results: results.slice(0, MAX_RESULTS) };
}

function highlight(el, text, terms) {
  const safe = terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!safe.length) {
    el.textContent = text;
    return;
  }
  const re = new RegExp(`(${safe.join('|')})`, 'gi');
  text.split(re).forEach((part, i) => {
    if (i % 2) {
      const mark = document.createElement('mark');
      mark.textContent = part;
      el.append(mark);
    } else if (part) el.append(part);
  });
}

function row({ e, check }, terms, id) {
  const li = document.createElement('li');
  li.setAttribute('role', 'presentation');
  const a = document.createElement('a');
  a.href = e.path;
  a.id = `search-option-${id}`;
  a.tabIndex = -1;
  a.setAttribute('role', 'option');
  a.setAttribute('aria-selected', 'false');

  const icon = document.createElement('span');
  icon.className = 'search-icon';
  const img = document.createElement('img');
  img.src = `${window.hlx.codeBasePath}/icons/${e.icon || DEFAULT_ICON}.svg`;
  img.alt = '';
  img.width = 20;
  img.height = 20;
  img.addEventListener('error', () => {
    if (!img.src.endsWith(`/${DEFAULT_ICON}.svg`)) img.src = `${window.hlx.codeBasePath}/icons/${DEFAULT_ICON}.svg`;
  });
  icon.append(img);

  const text = document.createElement('span');
  text.className = 'search-text';
  const title = document.createElement('span');
  title.className = 'search-title';
  highlight(title, e.title, terms);
  text.append(title);
  const subText = check || e.description;
  if (subText) {
    const sub = document.createElement('span');
    sub.className = 'search-sub';
    if (check) sub.append('Check: ');
    highlight(sub, subText, terms);
    text.append(sub);
  }

  a.append(icon, text);
  if (e.categoryName) {
    const tag = document.createElement('span');
    tag.className = 'search-tag';
    if (e.category) tag.dataset.category = e.category;
    tag.textContent = e.categoryName;
    a.append(tag);
  }
  li.append(a);
  return li;
}

function groupLabel(text) {
  const li = document.createElement('li');
  li.className = 'search-group';
  li.setAttribute('aria-hidden', 'true');
  li.textContent = text;
  return li;
}

function select(i) {
  if (!options.length) {
    input.removeAttribute('aria-activedescendant');
    return;
  }
  selected = Math.max(0, Math.min(i, options.length - 1));
  options.forEach((a, n) => a.setAttribute('aria-selected', String(n === selected)));
  input.setAttribute('aria-activedescendant', options[selected].id);
  options[selected].scrollIntoView({ block: 'nearest' });
}

async function render() {
  const query = input.value;
  const data = await getEntries();
  if (query !== input.value) return; // a newer keystroke owns the list
  list.textContent = '';
  let count = 0;
  if (!query.trim()) {
    const byPath = Object.fromEntries(data.map((e) => [e.path, e]));
    const popular = POPULAR.map((p) => byPath[p] || entry({ path: p, title: humanize(p) }));
    list.append(groupLabel('Popular'));
    popular.forEach((e, i) => list.append(row({ e }, [], i)));
    count = popular.length;
  } else {
    const { terms, results } = search(query, data);
    const lists = results.filter((r) => !r.check);
    const checks = results.filter((r) => r.check);
    if (lists.length) list.append(groupLabel('Checklists'));
    lists.forEach((r, i) => list.append(row(r, terms, i)));
    if (checks.length) list.append(groupLabel('Checks'));
    checks.forEach((r, i) => list.append(row(r, terms, lists.length + i)));
    count = results.length;
    if (!count) {
      const none = document.createElement('li');
      none.className = 'search-none';
      none.setAttribute('aria-hidden', 'true');
      none.textContent = `Nothing matches “${query.trim()}”.`;
      list.append(none);
    }
  }
  options = [...list.querySelectorAll('[role="option"]')];
  status.textContent = query.trim() ? `${count} result${count === 1 ? '' : 's'}` : '';
  select(0);
}

/** Closes the dialog and puts focus back on the control that opened it. */
function hide() {
  if (dialog.open) dialog.close();
  if (returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
}

function kbd(text) {
  const k = document.createElement('kbd');
  k.textContent = text;
  return k;
}

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'search-dialog';
  dialog.setAttribute('aria-label', 'Search checklists');

  const box = document.createElement('div');
  box.className = 'search-box';
  const icon = document.createElement('img');
  icon.src = `${window.hlx.codeBasePath}/icons/search.svg`;
  icon.alt = '';
  icon.width = 20;
  icon.height = 20;
  input = document.createElement('input');
  input.type = 'search';
  input.placeholder = 'Search checklists and checks: hero, redirects, LCP…';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('role', 'combobox');
  input.setAttribute('aria-label', 'Search checklists');
  input.setAttribute('aria-autocomplete', 'list');
  input.setAttribute('aria-expanded', 'true');
  input.setAttribute('aria-controls', 'search-results');
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'search-close';
  close.setAttribute('aria-label', 'Close search');
  close.append(kbd('esc'));
  box.append(icon, input, close);

  list = document.createElement('ul');
  list.id = 'search-results';
  list.className = 'search-results';
  list.setAttribute('role', 'listbox');
  list.setAttribute('aria-label', 'Results');

  status = document.createElement('p');
  status.className = 'visually-hidden';
  status.setAttribute('role', 'status');

  const foot = document.createElement('div');
  foot.className = 'search-foot';
  const move = document.createElement('span');
  move.append(kbd('↑'), kbd('↓'), ' to move');
  const open = document.createElement('span');
  open.append(kbd('↵'), ' to open');
  const esc = document.createElement('span');
  esc.append(kbd('esc'), ' to close');
  foot.append(move, open, esc);

  dialog.append(box, list, status, foot);

  input.addEventListener('input', render);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      select(selected + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      select(selected - 1);
    } else if (e.key === 'Escape') {
      // a search input swallows the first Escape to clear itself: close straight away
      e.preventDefault();
      hide();
    } else if (e.key === 'Enter' && options[selected]) {
      e.preventDefault();
      const { href } = options[selected];
      hide();
      window.location.href = href;
    }
  });
  close.addEventListener('click', hide);
  dialog.addEventListener('click', (e) => {
    // a click on the backdrop lands on the dialog itself
    if (e.target === dialog || e.target.closest('.search-results a')) hide();
  });
  dialog.addEventListener('close', hide);
  document.body.append(dialog);
}

/**
 * Opens the search dialog.
 * @param {{trigger?: Element}} [options] the control that opened it (gets focus back)
 */
export default async function openSearch({ trigger } = {}) {
  // authoring (Canvas quick-edit) keeps the header's plain link: no modal over the editor
  if (document.documentElement.hasAttribute('quick-edit')) return;
  await loadCSS(`${window.hlx.codeBasePath}/scripts/search.css`);
  if (!dialog || !dialog.isConnected) build();
  returnFocus = trigger || document.activeElement;
  if (!dialog.open) dialog.showModal();
  input.value = '';
  input.focus();
  await render();
}
