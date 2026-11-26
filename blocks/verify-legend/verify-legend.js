const KINDS = ['machine', 'agent', 'human'];

/**
 * Verify legend: rows of | 241 | h3 Machine checks + blurb | list of top checkers |.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  [...block.children].forEach((row) => {
    row.classList.add('verify-legend-card');
    const [count, text, list] = row.children;
    count?.classList.add('verify-legend-count');
    text?.classList.add('verify-legend-text');
    list?.classList.add('verify-legend-list');
    const label = text?.textContent.trim().toLowerCase() || '';
    const kind = KINDS.find((k) => label.startsWith(k));
    if (kind) row.dataset.verify = kind;
  });
}
