/**
 * Sidekick demo: an illustration of the checklist running in Sidekick on a preview page.
 * Rows: | url |, | title | subtitle |, | 9 pass | 2 review | 1 missing |,
 * then one | emoji | finding | per row.
 * Authored rows stay in place; the browser frame and toolbar are decorative chrome.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  const [url, head, score, ...findings] = [...block.children];
  url?.classList.add('sidekick-demo-url');
  head?.classList.add('sidekick-demo-head');
  score?.classList.add('sidekick-demo-score');
  findings.forEach((row) => {
    row.classList.add('sidekick-demo-finding');
    const mark = row.children[0]?.textContent.trim() || '';
    if (mark.startsWith('✅')) row.dataset.state = 'pass';
    else if (mark.startsWith('⛔')) row.dataset.state = 'missing';
    else row.dataset.state = 'review';
  });

  const page = document.createElement('div');
  page.className = 'sidekick-demo-page';
  page.setAttribute('aria-hidden', 'true');
  page.innerHTML = '<span class="sidekick-demo-hero"></span><span class="sidekick-demo-rows"><i></i><i></i><i></i></span>'
    + '<span class="sidekick-demo-bar"><span>Preview</span><span>Edit</span><span class="is-on">Checklist</span><span>Publish</span></span>';
  block.prepend(page);
  block.setAttribute('role', 'figure');
  block.setAttribute('aria-label', 'Illustration: Sidekick running the Edge Checklist on a preview page');
}
