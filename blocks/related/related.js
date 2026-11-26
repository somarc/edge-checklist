/**
 * Related block: one cell with an optional heading and a list of
 * `[:icon: Title](/cat/id) Category` items. Classification only.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  block.querySelectorAll('li').forEach((li) => li.classList.add('related-item'));
}
