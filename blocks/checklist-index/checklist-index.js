const CATEGORY_SLUGS = {
  blocks: 'blocks',
  pages: 'pages',
  delivery: 'delivery',
  authoring: 'authoring',
  'connected systems': 'systems',
  systems: 'systems',
  flows: 'flows',
};

/**
 * Checklist index. Rows:
 * | [:icon: Title](/cat/id) | Category | 9 checks | 4 machine, 3 agent, 2 human |
 * Classifies cells and exposes the verification mix as CSS custom properties.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  [...block.children].forEach((row) => {
    row.classList.add('checklist-index-tile');
    const [link, category, count, mix] = row.children;
    link?.classList.add('checklist-index-link');
    count?.classList.add('checklist-index-count');
    if (category) {
      category.classList.add('checklist-index-category');
      const slug = CATEGORY_SLUGS[category.textContent.trim().toLowerCase()];
      if (slug) row.classList.add(`cat-${slug}`);
    }
    if (mix) {
      mix.classList.add('checklist-index-mix');
      const text = mix.textContent.toLowerCase();
      ['machine', 'agent', 'human'].forEach((kind) => {
        const m = text.match(new RegExp(`(\\d+)\\s*${kind}`));
        mix.style.setProperty(`--${kind}`, m ? m[1] : '0');
      });
    }
  });
}
