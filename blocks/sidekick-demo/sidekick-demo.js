/**
 * Sidekick demo: an illustration of the checklist running in Sidekick on a preview page.
 * Rows: | url |, | title | subtitle |, | 9 + pass | 2 + review | 1 + missing |,
 * then one | emoji | finding | per row.
 * Authored rows are moved intact into the palette; the browser page and
 * toolbar around them are decorative chrome.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const [url, head, score, ...findings] = [...block.children];
  url?.classList.add('sidekick-demo-url');
  if (head) {
    head.classList.add('sidekick-demo-head');
    head.children[0]?.classList.add('sidekick-demo-title');
    head.children[1]?.classList.add('sidekick-demo-subtitle');
  }
  if (score) {
    score.classList.add('sidekick-demo-score');
    [...score.children].forEach((cell, i) => {
      cell.dataset.state = ['pass', 'review', 'missing'][i] || 'pass';
      cell.querySelector('p')?.classList.add('sidekick-demo-count');
    });
  }
  findings.forEach((row) => {
    row.classList.add('sidekick-demo-finding');
    row.children[0]?.classList.add('sidekick-demo-mark');
    const mark = row.children[0]?.textContent.trim() || '';
    if (mark.startsWith('✅')) row.dataset.state = 'pass';
    else if (mark.startsWith('⛔')) row.dataset.state = 'missing';
    else row.dataset.state = 'review';
  });

  const stage = document.createElement('div');
  stage.className = 'sidekick-demo-stage';

  const page = document.createElement('div');
  page.className = 'sidekick-demo-page';
  page.setAttribute('aria-hidden', 'true');
  page.innerHTML = '<span class="sidekick-demo-hero"></span>'
    + '<span class="sidekick-demo-rows"><i></i><i></i><i></i></span>'
    + '<span class="sidekick-demo-bar"><span>Preview</span><span>Edit</span>'
    + '<span class="is-on">Checklist</span><span>Publish</span></span>';

  const palette = document.createElement('div');
  palette.className = 'sidekick-demo-palette';
  const list = document.createElement('div');
  list.className = 'sidekick-demo-findings';
  list.append(...findings);
  palette.append(...[head, score].filter(Boolean), list);

  stage.append(page, palette);
  block.append(stage);
  block.setAttribute('role', 'figure');
  block.setAttribute('aria-label', 'Illustration: Sidekick running the Edge Checklist on a preview page');
}
