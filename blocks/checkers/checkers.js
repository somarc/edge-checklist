/**
 * Checkers table: first row is the header, then | checker | kind | checks | lists |.
 * Exposes each row's share of the largest check count for a CSS bar.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const [header, ...rows] = [...block.children];
  header?.classList.add('checkers-header');
  const counts = rows.map((row) => parseInt(row.children[2]?.textContent, 10) || 0);
  const max = Math.max(1, ...counts);
  rows.forEach((row, i) => {
    row.classList.add('checkers-row');
    const kind = row.children[1]?.textContent.trim().toLowerCase();
    if (kind) row.dataset.verify = kind;
    row.style.setProperty('--share', counts[i] / max);
  });
}
