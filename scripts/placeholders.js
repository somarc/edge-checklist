/*
 * UI text from the site's placeholders sheet (/placeholders.json, columns Key and Text).
 * Authors edit it in Experience Workspace (Config > Library > Placeholders). The defaults
 * below keep the interface whole if the sheet is missing or a key is not in it.
 * tools/generate.py seeds the sheet from this object.
 */
const DEFAULTS = {
  'checklist-progress': '{done} out of {total}',
  'checklist-filter-label': 'Filter checks',
  'checklist-filter-all': 'All',
  'checklist-filter-must': 'Must {count}',
  'checklist-reset': 'Reset',
  'checklist-all-checked': 'All {total} checked. Keep it 100.',
  'checklist-copy-as': 'Copy as',
  'checklist-copied': '{label} copied',
  'checklist-copy-blocked': 'Copy blocked in this browser',
  'export-txt': 'Plain text',
  'export-md': 'Markdown',
  'export-gh': 'GitHub',
  'export-jira': 'Jira',
  'export-slack': 'Slack',
  'export-agent': 'Agent prompt',
  'search-label': 'Search checklists',
  'search-input': 'Search checklists and checks: hero, redirects, LCP…',
  'search-close': 'Close search',
  'search-results': 'Results',
  'search-popular': 'Popular',
  'search-checklists': 'Checklists',
  'search-checks': 'Checks',
  'search-check-prefix': 'Check: ',
  'search-none': 'Nothing matches “{query}”.',
  'search-count-one': '{count} result',
  'search-count-many': '{count} results',
  'search-hint-move': 'to move',
  'search-hint-open': 'to open',
  'search-hint-close': 'to close',
};

let pending;

/**
 * Loads the placeholders once per page.
 * @returns {Promise<Record<string, string>>} key → text, defaults merged under the sheet
 */
export function loadPlaceholders() {
  if (!pending) {
    pending = fetch('/placeholders.json')
      .then((resp) => (resp.ok ? resp.json() : { data: [] }))
      .then((json) => {
        const rows = json.data || [];
        const fromSheet = Object.fromEntries(rows
          .filter((row) => row.Key && row.Text)
          .map((row) => [row.Key.trim(), row.Text]));
        return { ...DEFAULTS, ...fromSheet };
      })
      .catch(() => ({ ...DEFAULTS }));
  }
  return pending;
}

/**
 * Fills `{name}` tokens in a placeholder text.
 * @param {Record<string, string>} texts loaded placeholders
 * @param {string} key placeholder key
 * @param {Record<string, string|number>} [values] token values
 */
export function t(texts, key, values = {}) {
  const text = texts[key] ?? DEFAULTS[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in values ? String(values[name]) : match));
}
