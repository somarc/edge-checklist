/**
 * Metadata appears as a block only in authoring views (Canvas / quick-edit);
 * the delivery pipeline turns it into <meta> tags. Classification only.
 * @param {Element} block The block element
 */
export default function decorate(block) {
  [...block.children].forEach((row) => row.classList.add('metadata-row'));
}
