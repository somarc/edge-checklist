/**
 * Related block: one card per row, each a heading, a list of
 * `[:icon: Title](/path) Label` items and an optional closing link paragraph.
 * Classification only.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  block.querySelectorAll('li').forEach((li) => li.classList.add('related-item'));
  block.querySelectorAll('p').forEach((p) => {
    if (!p.closest('li') && p.querySelector('a')) p.classList.add('related-more');
  });
}
