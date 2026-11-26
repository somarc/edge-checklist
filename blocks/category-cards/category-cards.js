const CATEGORY_PATH = /^\/(blocks|pages|delivery|authoring|systems|flows)\/?$/;

/**
 * Category cards: one row per category.
 * | h2 + blurb + [View all N](/category) | list of [:icon: Title](/category/id) |
 * @param {Element} block The block element
 */
export default function decorate(block) {
  [...block.children].forEach((row) => {
    row.classList.add('category-cards-card');
    const [head, chips] = row.children;
    head?.classList.add('category-cards-head');
    chips?.classList.add('category-cards-chips');
    head?.querySelectorAll('a[href]').forEach((a) => {
      const match = new URL(a.href, window.location).pathname.match(CATEGORY_PATH);
      if (!match) return;
      row.classList.add(`cat-${match[1]}`);
      a.closest('p')?.classList.add('category-cards-all');
    });
  });
}
