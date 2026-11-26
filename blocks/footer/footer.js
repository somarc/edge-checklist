import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

// decorative icons for the call-to-action links, by target path
const CTA_ICONS = { '/skill': 'square-terminal', '/sidekick': 'pocket-knife' };

function iconSpan(name, className) {
  const span = document.createElement('span');
  span.className = className;
  const img = document.createElement('img');
  img.src = `${window.hlx.codeBasePath}/icons/${name}.svg`;
  img.alt = '';
  img.width = 16;
  img.height = 16;
  img.loading = 'lazy';
  span.append(img);
  return span;
}

/**
 * Classifies the footer fragment: brand + CTAs, category columns, bottom line.
 * Authored nodes are kept and moved, never rebuilt.
 * @param {Element} footer the fragment root
 */
function classify(footer) {
  const sections = [...footer.querySelectorAll(':scope > .section')];
  const columnsSection = sections.find((s) => s.querySelector('.columns'));
  if (columnsSection) columnsSection.classList.add('footer-cols');

  const top = sections.find((s) => s !== columnsSection && s.querySelector('a[href]'));
  if (top && top !== sections.at(-1)) {
    top.classList.add('footer-top');
    const content = top.querySelector('.default-content-wrapper') || top;
    const brand = [...content.querySelectorAll(':scope > p')].find((p) => p.querySelector('a .icon, a[href="/"]'));
    const ctas = content.querySelector(':scope > ul');
    if (brand) {
      brand.classList.add('footer-brand');
      const intro = document.createElement('div');
      intro.className = 'footer-intro';
      brand.before(intro);
      // the brand and the paragraphs that follow it, up to the CTA list
      let node = brand;
      while (node && node !== ctas) {
        const next = node.nextElementSibling;
        intro.append(node);
        node = next;
      }
    }
    if (ctas) {
      ctas.classList.add('footer-ctas');
      ctas.querySelectorAll(':scope > li > a[href]').forEach((a) => {
        const { pathname } = new URL(a.href, window.location);
        if (!a.querySelector('.icon') && CTA_ICONS[pathname]) {
          a.prepend(iconSpan(CTA_ICONS[pathname], `footer-cta-icon footer-cta-${pathname.slice(1)}`));
        }
        a.append(iconSpan('arrow-right', 'footer-cta-arrow'));
      });
    }
  }

  const bottom = sections.at(-1);
  if (bottom && bottom !== columnsSection && bottom !== top) bottom.classList.add('footer-bottom');
}

/**
 * loads and decorates the footer
 * @param {Element} block The footer block element
 */
export default async function decorate(block) {
  // load footer as fragment
  const footerMeta = getMetadata('footer');
  const footerPath = footerMeta ? new URL(footerMeta, window.location).pathname : '/footer';
  const fragment = await loadFragment(footerPath);
  if (!fragment) return;

  // decorate footer DOM
  block.textContent = '';
  const footer = document.createElement('div');
  footer.className = 'footer-inner';
  while (fragment.firstElementChild) footer.append(fragment.firstElementChild);
  classify(footer);

  block.append(footer);
}
