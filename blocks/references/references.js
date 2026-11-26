/**
 * References ("In the wild"): rows of | [label](url) | note |.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  [...block.children].forEach((row) => {
    row.classList.add('references-item');
    const [link, note] = row.children;
    link?.classList.add('references-link');
    note?.classList.add('references-note');
    const a = link?.querySelector('a[href]');
    if (a && new URL(a.href, window.location).origin !== window.location.origin) {
      a.target = '_blank';
      a.rel = 'noopener';
      row.dataset.host = new URL(a.href).host.replace(/^www\./, '');
    }
  });
}
