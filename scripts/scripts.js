import {
  loadHeader,
  loadFooter,
  decorateIcons,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

/* Authoring signal: decided at module evaluation, before any decoration. */
const params = new URLSearchParams(window.location.search);
const QUICK_EDIT = params.has('quick-edit');
if (QUICK_EDIT) document.documentElement.setAttribute('quick-edit', '');

/**
 * True inside DA Canvas / quick-edit. Gate interaction with it, never content.
 * @returns {boolean}
 */
export function isAuthoring() {
  return document.documentElement.hasAttribute('quick-edit');
}

if (window.trustedTypes && window.trustedTypes.createPolicy) {
  const innerTT = window.trustedTypes.createPolicy('tt-inner', {
    createHTML: (s) => s, // avoid stack overflow
  });

  window.trustedTypes.createPolicy('default', {
    createHTML: (input, type, sink) => {
      let processedInput = input;
      if (/srcdoc\s*=/i.test(processedInput)) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('iframe[srcdoc]').forEach((el) => el.removeAttribute('srcdoc'));
        processedInput = doc.body.innerHTML;
      }
      if (sink.includes('createContextualFragment') || sink.includes('Document write')) {
        const doc = new DOMParser().parseFromString(innerTT.createHTML(processedInput), 'text/html');
        doc.querySelectorAll('script').forEach((el) => el.remove());
        processedInput = doc.body.innerHTML;
      }
      return processedInput;
    },
    createScriptURL: (input) => input,
    createScript: (input) => input,
  });
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks(main) {
  try {
    // auto load `*/fragments/*` references
    const fragments = [...main.querySelectorAll('a[href*="/fragments/"]')].filter((f) => !f.closest('.fragment'));
    if (fragments.length > 0) {
      // eslint-disable-next-line import/no-cycle
      import('../blocks/fragment/fragment.js').then(({ loadFragment }) => {
        fragments.forEach(async (fragment) => {
          try {
            const { pathname } = new URL(fragment.href);
            const frag = await loadFragment(pathname);
            fragment.parentElement.replaceWith(...frag.children);
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error('Fragment loading failed', error);
          }
        });
      });
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Decorates formatted links to style them as buttons.
 * @param {HTMLElement} main The main container element
 */
function decorateButtons(main) {
  main.querySelectorAll('p a[href]').forEach((a) => {
    a.title = a.title || a.textContent;
    const p = a.closest('p');
    const text = a.textContent.trim();

    // quick structural checks
    if (a.querySelector('img') || p.textContent.trim() !== text) return;

    // skip URL display links
    try {
      if (new URL(a.href).href === new URL(text, window.location).href) return;
    } catch { /* continue */ }

    // require authored formatting for buttonization
    const strong = a.closest('strong');
    const em = a.closest('em');
    if (!strong && !em) return;

    p.className = 'button-wrapper';
    a.className = 'button';
    if (strong && em) { // high-impact call-to-action
      a.classList.add('accent');
      const outer = strong.contains(em) ? strong : em;
      outer.replaceWith(a);
    } else if (strong) {
      a.classList.add('primary');
      strong.replaceWith(a);
    } else {
      a.classList.add('secondary');
      em.replaceWith(a);
    }
  });
}

const CATEGORY_PATH = /^\/(blocks|pages|delivery|authoring|systems|flows)\/?$/;

/**
 * True when the paragraph holds only icons (authored `:name:` syntax).
 * @param {Element} p paragraph
 */
function isIconOnly(p) {
  return p.querySelector('.icon') && !p.textContent.trim();
}

/**
 * True when the paragraph holds a single link and nothing else.
 * @param {Element} p paragraph
 */
function soleLink(p) {
  const links = p.querySelectorAll('a');
  const only = links.length === 1 && p.textContent.trim() === links[0].textContent.trim();
  return only ? links[0] : null;
}

/**
 * Adds role classes to authored default content in styled sections.
 * Classifies the cell owners; never moves or rebuilds authored text.
 * @param {Element} main The main element
 */
function decorateSectionRoles(main) {
  main.querySelectorAll('.section.title .default-content-wrapper p').forEach((p) => {
    const link = soleLink(p);
    const isCategory = link && CATEGORY_PATH.test(new URL(link.href, window.location).pathname);
    if (isIconOnly(p)) p.classList.add('title-icon');
    else if (isCategory) p.classList.add('title-category');
    else p.classList.add('title-summary');
  });

  main.querySelectorAll('.section.hero, .section.promo').forEach((section) => {
    section.querySelectorAll('.default-content-wrapper p').forEach((p) => {
      const em = p.querySelector('em');
      if (em && !p.querySelector('a') && p.textContent.trim() === em.textContent.trim()) {
        p.classList.add('concept-label');
      }
    });
  });

  const here = window.location.pathname.replace(/\/$/, '') || '/';
  main.querySelectorAll('.section.filters a[href]').forEach((a) => {
    const path = new URL(a.href, window.location).pathname.replace(/\/$/, '') || '/';
    if (path === here) a.setAttribute('aria-current', 'page');
  });
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
export function decorateMain(main) {
  decorateIcons(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
  decorateButtons(main);
  decorateSectionRoles(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Document} doc The document
 */
async function loadEager(doc) {
  doc.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    doc.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Document} doc The document
 */
async function loadLazy(doc) {
  const header = doc.querySelector('body > header');
  if (header) loadHeader(header);

  const main = doc.querySelector('main');
  if (main) await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element && !isAuthoring()) element.scrollIntoView();

  const footer = doc.querySelector('body > footer');
  if (footer) loadFooter(footer);

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  if (isAuthoring()) return;
  import('./consent-check.js');
}

/**
 * One fully awaited path: Canvas calls it again after each body replacement.
 * @param {Document} doc The document
 */
export async function loadPage(doc = document) {
  await loadEager(doc);
  await loadLazy(doc);
  loadDelayed();
}

/* Load quick-edit ourselves, so preview.da.live serves this file unchanged. */
if (QUICK_EDIT) {
  let payload = {};
  try {
    const q = params.get('quick-edit');
    payload = q && q !== 'on' ? JSON.parse(decodeURIComponent(q)) : {};
  } catch { /* plain flag */ }
  try {
    // eslint-disable-next-line import/no-unresolved
    const { default: loadQuickEdit } = await import('https://da.live/nx/public/plugins/quick-edit/quick-edit.js');
    await loadQuickEdit(payload, loadPage);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('quick-edit unavailable outside Canvas', error);
  }
}

loadPage();
