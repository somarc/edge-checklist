import { getMetadata } from '../../scripts/aem.js';
import { loadFragment } from '../fragment/fragment.js';

// media query match that indicates mobile/tablet width
const isDesktop = window.matchMedia('(min-width: 900px)');
const CATEGORIES = ['blocks', 'pages', 'delivery', 'authoring', 'systems', 'flows'];
const isMac = /Mac|iPhone|iPad/.test(navigator.userAgent);

// one controller per decoration: Canvas and partial reloads re-run decorate()
let controller;

const isAuthoring = () => document.documentElement.hasAttribute('quick-edit');

function iconImg(name) {
  const img = document.createElement('img');
  img.src = `${window.hlx.codeBasePath}/icons/${name}.svg`;
  img.alt = '';
  img.width = 16;
  img.height = 16;
  img.loading = 'lazy';
  return img;
}

/**
 * Toggles all nav sections
 * @param {Element} sections The container element
 * @param {Boolean|string} expanded Whether the element should be expanded or collapsed
 */
function toggleAllNavSections(sections, expanded = false) {
  if (!sections) return;
  sections.querySelectorAll('.nav-drop > button').forEach((button) => {
    button.setAttribute('aria-expanded', expanded);
  });
}

/**
 * Toggles the entire nav
 * @param {Element} nav The container element
 * @param {Element} navSections The nav sections within the container element
 * @param {*} forceExpanded Optional param to force nav expand behavior when not null
 */
function toggleMenu(nav, navSections, forceExpanded = null) {
  const expanded = forceExpanded !== null ? !forceExpanded : nav.getAttribute('aria-expanded') === 'true';
  const button = nav.querySelector('.nav-hamburger button');
  document.body.style.overflowY = (expanded || isDesktop.matches) ? '' : 'hidden';
  // the desktop nav is always expanded, so aria-expanded only applies to the mobile menu
  if (isDesktop.matches) nav.removeAttribute('aria-expanded');
  else nav.setAttribute('aria-expanded', expanded ? 'false' : 'true');
  toggleAllNavSections(navSections, expanded || isDesktop.matches ? 'false' : 'true');
  if (button) button.setAttribute('aria-label', expanded ? 'Open navigation' : 'Close navigation');
}

/**
 * Closes the open dropdown (desktop) or the mobile menu.
 * @returns {Element|null} the control that should get focus back
 */
function closeNav(nav, navSections) {
  if (isDesktop.matches) {
    const open = navSections?.querySelector('.nav-drop > button[aria-expanded="true"]');
    if (open) toggleAllNavSections(navSections, false);
    return open;
  }
  if (nav.getAttribute('aria-expanded') === 'true') {
    toggleMenu(nav, navSections, false);
    return nav.querySelector('.nav-hamburger button');
  }
  return null;
}

/**
 * Opens the search dialog, loading scripts/search.js on first use.
 * Falls back to the trigger link's page when the module cannot load.
 * @param {HTMLAnchorElement|null} trigger the header search link
 */
async function openSearch(trigger) {
  try {
    const mod = await import('../../scripts/search.js');
    await mod.default({ trigger });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('search failed to load', e);
    if (trigger?.href) window.location.href = trigger.href;
  }
}

function isTyping(el) {
  return el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));
}

/**
 * Builds the Browse dropdown and the other nav sections.
 * @param {Element} navSections the nav-sections section
 */
function decorateSections(navSections) {
  const { pathname } = window.location;
  const topSegment = pathname.split('/')[1] || '';
  const topList = navSections.querySelector('.default-content-wrapper > ul');
  if (!topList) return;
  topList.classList.add('nav-list');
  topList.querySelectorAll(':scope > li > a').forEach((a) => a.classList.add('nav-link'));
  topList.querySelectorAll(':scope > li').forEach((navSection) => {
    const subList = navSection.querySelector(':scope > ul');
    if (!subList) return;
    navSection.classList.add('nav-drop');
    subList.classList.add('nav-drop-list');
    // wrap the dropdown label in a button so it is announced as expandable
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'nav-drop-toggle';
    button.setAttribute('aria-expanded', false);
    [...navSection.childNodes].forEach((node) => {
      if (node === subList) return;
      // a <p> is not allowed inside a <button>: move its text, drop the empty wrapper
      if (node.nodeName === 'P') {
        button.append(...node.childNodes);
        node.remove();
      } else button.append(node);
    });
    [...button.childNodes].forEach((n) => {
      if (n.nodeType === Node.TEXT_NODE && !n.textContent.trim()) n.remove();
    });
    const chevron = document.createElement('span');
    chevron.className = 'nav-chevron';
    chevron.append(iconImg('chevron-down'));
    button.append(chevron);
    navSection.prepend(button);

    subList.querySelectorAll(':scope > li > a').forEach((a) => {
      const segment = new URL(a.href, window.location).pathname.split('/')[1];
      if (CATEGORIES.includes(segment)) a.dataset.category = segment;
      else a.closest('li').classList.add('nav-drop-all');
    });
    const ownsPage = [...subList.querySelectorAll('a')]
      .some((a) => new URL(a.href, window.location).pathname.split('/')[1] === topSegment);
    if (topSegment && ownsPage) button.classList.add('nav-active');

    button.addEventListener('click', () => {
      const expanded = button.getAttribute('aria-expanded') === 'true';
      if (isDesktop.matches) toggleAllNavSections(navSections);
      button.setAttribute('aria-expanded', !expanded);
    });
  });

  navSections.querySelectorAll('a[href]').forEach((a) => {
    if (new URL(a.href, window.location).pathname === pathname) a.setAttribute('aria-current', 'page');
  });
}

/**
 * Upgrades the tools link to open the search dialog. In authoring mode it stays a plain link.
 * @param {Element} navTools the nav-tools section
 * @param {AbortSignal} signal listener scope
 */
function decorateSearch(navTools, signal) {
  const link = navTools.querySelector('a[href]');
  if (!link) return;
  link.classList.add('nav-search');
  const label = document.createElement('span');
  label.className = 'nav-search-label';
  label.append(...link.childNodes);
  const kbd = document.createElement('kbd');
  kbd.textContent = isMac ? '⌘K' : 'Ctrl K';
  const icon = document.createElement('span');
  icon.className = 'nav-search-icon';
  icon.append(iconImg('search'));
  link.append(label, kbd, icon);
  if (isAuthoring()) return;

  link.setAttribute('aria-haspopup', 'dialog');
  link.setAttribute('aria-keyshortcuts', isMac ? 'Meta+K /' : 'Control+K /');
  link.addEventListener('click', (e) => {
    // modified clicks keep the link's own behaviour (new tab, etc.)
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    openSearch(link);
  });
  // warm the module when the user is about to use it
  const preload = () => import('../../scripts/search.js').catch(() => {});
  link.addEventListener('pointerenter', preload, { once: true });
  link.addEventListener('focus', preload, { once: true });

  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented) return;
    const k = e.key.toLowerCase();
    const shortcut = (k === 'k' && (e.metaKey || e.ctrlKey) && !e.altKey)
      || (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey && !isTyping(document.activeElement));
    if (!shortcut || document.querySelector('dialog[open]')) return;
    e.preventDefault();
    openSearch(link);
  }, { signal });
}

/**
 * loads and decorates the header, mainly the nav
 * @param {Element} block The header block element
 */
export default async function decorate(block) {
  controller?.abort();
  controller = new AbortController();
  const { signal } = controller;

  // load nav as fragment
  const navMeta = getMetadata('nav');
  const navPath = navMeta ? new URL(navMeta, window.location).pathname : '/nav';
  const fragment = await loadFragment(navPath);
  if (!fragment) return;

  // decorate nav DOM
  block.textContent = '';
  const nav = document.createElement('nav');
  nav.id = 'nav';
  nav.setAttribute('aria-label', 'Primary');
  while (fragment.firstElementChild) nav.append(fragment.firstElementChild);

  const classes = ['brand', 'sections', 'tools'];
  classes.forEach((c, i) => {
    const section = nav.children[i];
    if (section) section.classList.add(`nav-${c}`);
  });

  const navBrand = nav.querySelector('.nav-brand');
  const brandLink = navBrand?.querySelector('a');
  if (brandLink) {
    brandLink.className = 'nav-brand-link';
    const wrapper = brandLink.closest('.button-wrapper');
    if (wrapper) wrapper.className = '';
    if (!brandLink.getAttribute('aria-label')) {
      brandLink.setAttribute('aria-label', `${brandLink.textContent.trim()} home`);
    }
  }

  const navSections = nav.querySelector('.nav-sections');
  if (navSections) decorateSections(navSections);

  const navTools = nav.querySelector('.nav-tools');
  if (navTools) decorateSearch(navTools, signal);

  // hamburger for mobile
  const hamburger = document.createElement('div');
  hamburger.classList.add('nav-hamburger');
  const hamburgerButton = document.createElement('button');
  hamburgerButton.type = 'button';
  hamburgerButton.className = 'nav-hamburger-button';
  hamburgerButton.setAttribute('aria-controls', 'nav');
  hamburgerButton.setAttribute('aria-label', 'Open navigation');
  const hamburgerIcon = document.createElement('span');
  hamburgerIcon.className = 'nav-hamburger-icon';
  hamburgerButton.append(hamburgerIcon);
  hamburger.append(hamburgerButton);
  hamburgerButton.addEventListener('click', () => toggleMenu(nav, navSections));
  // after the brand: mobile tab order runs brand, menu button, menu, search
  if (navBrand) navBrand.after(hamburger);
  else nav.prepend(hamburger);
  nav.setAttribute('aria-expanded', 'false');
  // prevent mobile nav behavior on window resize
  toggleMenu(nav, navSections, isDesktop.matches);
  isDesktop.addEventListener('change', () => toggleMenu(nav, navSections, isDesktop.matches), { signal });

  // Escape closes the dropdown or the mobile menu and returns focus to its control
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || document.querySelector('dialog[open]')) return;
    const control = closeNav(nav, navSections);
    if (control) control.focus();
  }, { signal });
  // focus leaving the nav, or a click outside it, closes what is open
  nav.addEventListener('focusout', (e) => {
    if (e.relatedTarget && !nav.contains(e.relatedTarget)) closeNav(nav, navSections);
  });
  document.addEventListener('click', (e) => {
    if (!nav.contains(e.target) && isDesktop.matches) closeNav(nav, navSections);
  }, { signal });

  const navWrapper = document.createElement('div');
  navWrapper.className = 'nav-wrapper';
  navWrapper.append(nav);
  block.append(navWrapper);
}
