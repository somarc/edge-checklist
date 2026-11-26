#!/usr/bin/env python3
"""Generate the Edge Checklist DA pages from tools/data/*.json.

Usage: python3 tools/generate.py <output-dir>

Writes DA source HTML (<body><header><main>…</main><footer>) for every checklist,
category index, home, browse, concept pages, nav and footer. Upload the output
with `da --org somarc --repo edge-checklist content put-tree <output-dir>`.
This is a first-seed and bulk-rewrite tool: after seeding, DA is the source of truth.
"""
import html
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from urllib.parse import urlparse

from checkers import HELIX_TOOLS, SKILLS_REPO, checker

HERE = Path(__file__).resolve().parent
DATA_FILES = ['blocks', 'pages', 'delivery-a', 'delivery-b', 'authoring', 'systems-a', 'systems-b', 'flows']

CATEGORIES = [
    ('blocks', 'Blocks', 'What authors place on a page, and the contract every block keeps.'),
    ('pages', 'Pages', 'Templates readers land on, from the homepage to the 404.'),
    ('delivery', 'Delivery', 'The platform under every page: speed, metadata, indexing, CDN.'),
    ('authoring', 'Authoring', 'How content gets made: models, editors, Sidekick, locales.'),
    ('systems', 'Connected systems', 'Commerce, Assets, Forms, Target, analytics and everything wired in.'),
    ('flows', 'Flows', 'Multi-step jobs from going live to rolling back.'),
]
CAT_NAME = {c[0]: c[1] for c in CATEGORIES}

ICON = {
    'any-block': 'box', 'hero': 'mountain-snow', 'cards': 'layout-grid', 'columns': 'columns-2', 'tabs': 'panel-top',
    'accordion': 'list-collapse', 'carousel': 'gallery-horizontal', 'header': 'menu', 'footer': 'panel-bottom',
    'fragment': 'puzzle', 'embed': 'circle-play', 'table': 'table',
    'homepage': 'house', 'landing-page': 'megaphone', 'article': 'newspaper', 'article-index': 'library',
    'product-detail': 'shopping-bag', 'product-listing': 'layout-list', 'search-results': 'search',
    'page-404': 'map-pin-off', 'locale-root': 'globe',
    'performance': 'gauge', 'loading-phases': 'layers', 'head-html': 'code-xml', 'fonts': 'type', 'images': 'images',
    'headers': 'shield-check', 'byo-cdn': 'network', 'metadata': 'tags', 'redirects': 'signpost', 'sitemap': 'map',
    'query-index': 'database', 'robots': 'bot', 'site-config': 'settings', 'site-auth': 'lock-keyhole',
    'content-model': 'shapes', 'document-authoring': 'file-pen-line', 'universal-editor': 'mouse-pointer-click',
    'sidekick': 'pocket-knife', 'placeholders': 'braces', 'bulk-metadata': 'files', 'spreadsheets': 'sheet',
    'in-context-editing': 'pencil-line', 'block-library': 'library-big', 'translation': 'languages',
    'access-roles': 'key-round',
    'commerce': 'shopping-cart', 'assets': 'folder-open', 'forms': 'text-cursor-input', 'site-search': 'scan-search',
    'cloud-manager': 'cloud', 'github': 'git-branch', 'martech': 'chart-line', 'target': 'target',
    'experimentation': 'flask-conical', 'rum': 'activity', 'consent': 'cookie', 'app-builder': 'plug',
    'going-live': 'rocket', 'migrating-a-page': 'arrow-right-left', 'adding-a-block': 'square-plus',
    'preview-to-publish': 'send', 'adding-a-locale': 'flag', 'going-repoless': 'git-fork',
    'retiring-a-page': 'archive', 'reviewing-a-pr': 'git-pull-request', 'rolling-back': 'history',
}
FEATURED_CHIPS = {
    'blocks': ['any-block', 'hero', 'cards', 'header', 'carousel', 'tabs', 'fragment', 'embed'],
    'pages': ['homepage', 'article', 'product-detail', 'product-listing', 'landing-page', 'search-results', 'page-404', 'locale-root'],
    'delivery': ['performance', 'loading-phases', 'metadata', 'redirects', 'sitemap', 'byo-cdn', 'images', 'headers'],
    'authoring': ['content-model', 'document-authoring', 'universal-editor', 'sidekick', 'in-context-editing', 'translation', 'placeholders'],
    'systems': ['commerce', 'assets', 'forms', 'martech', 'target', 'experimentation', 'rum', 'consent'],
    'flows': ['going-live', 'migrating-a-page', 'adding-a-block', 'preview-to-publish', 'adding-a-locale', 'going-repoless', 'reviewing-a-pr', 'rolling-back', 'retiring-a-page'],
}
FEATURED_TILES = ['performance', 'hero', 'going-live', 'commerce', 'content-model', 'redirects',
                  'page-404', 'in-context-editing', 'experimentation', 'product-detail', 'reviewing-a-pr', 'site-auth']
KINDS = ['machine', 'agent', 'human']
KIND_BLURB = {
    'machine': 'A deterministic tool settles it: PageSpeed Insights, Lighthouse, curl, the Admin API.',
    'agent': 'An agent reads the rendered page, the markup or the repo and judges it.',
    'human': 'Needs business context or taste. The list tells you who to ask.',
}


def e(text):
    return html.escape(str(text), quote=True)


def page(sections):
    body = ''.join(f'<div>{s}</div>' for s in sections)
    return f'<body><header></header><main>{body}</main><footer></footer></body>\n'


def block(name, rows):
    inner = ''.join('<div>' + ''.join(f'<div>{c}</div>' for c in row) + '</div>' for row in rows)
    return f'<div class="{name}">{inner}</div>'


def kv_block(name, pairs):
    return block(name, [[e(k), e(v)] for k, v in pairs])


def section_style(style):
    return kv_block('section-metadata', [('style', style)])


def path(c):
    return f"/{c['category']}/{c['id']}"


def icon_link(c):
    return f'<a href="{path(c)}">:{ICON.get(c["id"], "list-checks")}:{e(c["title"])}</a>'


def mix(c):
    n = Counter(it['verify']['by'] for it in c['items'])
    return n


def mix_text(c):
    n = mix(c)
    return ', '.join(f'{n[k]} {k}' for k in KINDS)


def index_rows(lists):
    return [[icon_link(c), e(CAT_NAME[c['category']]), f"{len(c['items'])} checks", mix_text(c)] for c in lists]


HOST_LABELS = {
    'raw.githubusercontent.com': 'GitHub',
    'github.com': 'GitHub',
    'experienceleague.adobe.com': 'Experience League',
    'developer.adobe.com': 'Adobe Developer',
    'w3.org': 'W3C',
}


def host_label(url):
    h = urlparse(url).netloc.replace('www.', '')
    if h in HOST_LABELS:
        return HOST_LABELS[h]
    parts = h.split('--')
    if len(parts) == 3 and h.endswith(('.aem.live', '.aem.page')):
        return 'Block Collection' if parts[1] == 'aem-block-collection' else f'{parts[1]} on aem.live'
    return h


def verify_cell(v):
    found = checker(v['how'])
    label = f"{e(v['by'].capitalize())}: "
    if found and found[1]:
        return f'{label}<a href="{e(found[1])}">{e(v["how"])}</a>'
    return label + e(v['how'])


def verify_with(c):
    """Distinct linked checkers this checklist uses, most used first."""
    seen = {}
    for it in c['items']:
        found = checker(it['verify']['how'])
        if found and found[1]:
            name, url, kind = found
            seen.setdefault(url, [name, kind, 0])[2] += 1
    rows = sorted(seen.items(), key=lambda kv: -kv[1][2])[:6]
    links = ''.join(f'<li><a href="{e(url)}">{e(name)}</a> {e(kind)}</li>' for url, (name, kind, _) in rows)
    return (f'<h2>Verify with</h2><ul>{links}</ul>' if links else '<h2>Verify with</h2>') + \
        f'<p><a href="{HELIX_TOOLS}">All Helix admin tools on tools.aem.live</a></p>'


def checklist_page(c, by_id):
    cat = c['category']
    items = []
    for it in c['items']:
        verify = verify_cell(it['verify'])
        src = f'<a href="{e(it["source"])}">{e(host_label(it["source"]))}</a>' if it.get('source') else 'No public source'
        items.append([f'<h3>{e(it["title"])}</h3><p>{e(it["detail"])}</p>', e(it['level'].capitalize()), verify, src])
    related = []
    for rid in c.get('related', []):
        r = by_id.get(rid)
        if r:
            related.append(f'<li>{icon_link(r)} {e(CAT_NAME[r["category"]])}</li>')
    sections = [
        f'<p>:{ICON.get(c["id"], "list-checks")}:</p><h1>{e(c["title"])}</h1>'
        f'<p><a href="/{cat}">{e(CAT_NAME[cat])}</a></p><p>{e(c["summary"])}</p>{section_style("title")}',
        block('checklist', items)
        + block('related', ([[f'<h2>Related</h2><ul>{"".join(related)}</ul>']] if related else []) + [[verify_with(c)]])
        + section_style('checklist-layout'),
    ]
    if c.get('wild'):
        refs = [[f'<a href="{e(w["url"])}">{e(w["label"])}</a>', e(w.get('note', ''))] for w in c['wild']]
        sections.append(f'<h2>In the wild</h2>{block("references", refs)}{section_style("wild")}')
    sections.append(kv_block('metadata', [
        ('title', f"{c['title']} · {CAT_NAME[cat]} checklist"),
        ('description', c['summary']),
        ('template', 'checklist-page'),
        ('theme', f'cat-{cat}'),
        ('category', CAT_NAME[cat]),
        ('icon', ICON.get(c['id'], 'list-checks')),
        ('checks', str(len(c['items']))),
        ('verify-mix', mix_text(c)),
        ('keywords', ', '.join(it['title'] for it in c['items'])),
    ]))
    return page(sections)


def filters(all_lists, by_cat):
    links = [f'<li><a href="/browse">All {len(all_lists)}</a></li>']
    links += [f'<li><a href="/{cid}">{e(name)} {len(by_cat[cid])}</a></li>' for cid, name, _ in CATEGORIES]
    return f'<ul>{"".join(links)}</ul>{section_style("filters")}'


def index_page(title, blurb, lists, all_lists, by_cat, meta_title, theme=None):
    meta = [('title', meta_title), ('description', blurb), ('template', 'index')]
    if theme:
        meta.append(('theme', theme))
    return page([
        f'<h1>{e(title)}</h1><p>{e(blurb)}</p>{section_style("title")}',
        filters(all_lists, by_cat),
        block('checklist-index', index_rows(lists)),
        kv_block('metadata', meta),
    ])


def top_checkers(lists, kind, n=4):
    counter = Counter(it['verify']['how'] for c in lists for it in c['items'] if it['verify']['by'] == kind)
    return counter.most_common(n)


def home_page(lists, by_cat, by_id, totals):
    cards = []
    for cid, name, blurb in CATEGORIES:
        chips = ''.join(f'<li>{icon_link(by_id[i])}</li>' for i in FEATURED_CHIPS[cid] if i in by_id)
        cards.append([f'<h2>{e(name)}</h2><p>{e(blurb)}</p><p><a href="/{cid}">View all {len(by_cat[cid])}</a></p>',
                      f'<ul>{chips}</ul>'])
    legend = []
    for k in KINDS:
        top = ''.join(f'<li>{e(how)} <em>{n}</em></li>' for how, n in top_checkers(lists, k))
        legend.append([str(totals[k]), f'<h3>{k.capitalize()} checks</h3><p>{e(KIND_BLURB[k])}</p>', f'<ul>{top}</ul>'])
    items_total = sum(totals.values())
    machine_pct = round(totals['machine'] / items_total * 100)
    sourced = sum(1 for c in lists for it in c['items'] if it.get('source'))
    featured = [by_id[i] for i in FEATURED_TILES if i in by_id]
    return page([
        '<h1>Check every block, keep it 100.</h1>'
        '<p>Checklists for AEM Edge Delivery: blocks, pages, delivery, authoring and every system wired into it. '
        'Browse or search below.</p>'
        '<ul><li><a href="/skill">:square-terminal:Agent skill</a></li>'
        '<li><a href="/sidekick">:pocket-knife:Sidekick</a></li></ul>'
        + section_style('hero'),
        block('category-cards', cards),
        f'<h2>Find exactly what you need</h2><p>{len(lists)} checklists and {items_total} checks. '
        f'{sourced} of them link the doc or code that says so.</p>'
        + block('checklist-index featured', index_rows(featured))
        + f'<p><a href="/browse">Browse all {len(lists)} checklists</a></p>'
        + section_style('intro'),
        '<h2>Every check says who can verify it.</h2>'
        f'<p>Edge Delivery is measurable: {machine_pct}% of these checks are a tool run, not an opinion. '
        'Each item is tagged so a pipeline, an agent or a person knows it is theirs.</p>'
        + block('verify-legend', legend) + section_style('intro'),
        '<p><em>Concept</em></p><h2>The gut check, inside Sidekick.</h2>'
        '<p>Open any preview page and the Sidekick picks the checklists that match its template and blocks. '
        'Machine checks run on the spot; the rest becomes a short list for the agent or the author.</p>'
        '<p><strong><a href="/sidekick">See how it works</a></strong></p>'
        '<p><em><a href="/skill">Agent skill</a></em></p>'
        + sidekick_demo() + section_style('promo'),
        kv_block('metadata', [
            ('title', 'Edge Checklist: check every block, keep it 100'),
            ('description', f'{len(lists)} checklists and {items_total} checks for AEM Edge Delivery Services '
                            'teams: blocks, pages, delivery, authoring, connected systems and flows.'),
        ]),
    ])


def sidekick_demo():
    return block('sidekick-demo', [
        ['main--brand-site--acme.aem.page/products/trail-runner'],
        ['Product detail · Pages', 'matched by template'],
        ['<p>9</p><p>pass</p>', '<p>2</p><p>review</p>', '<p>1</p><p>missing</p>'],
        ['✅', 'Product image is the LCP and loads eagerly'],
        ['✅', 'Title and description metadata present'],
        ['🤔', 'Price renders after a client fetch; check the layout shift'],
        ['⛔', 'No Product structured data on the page'],
    ])


def skill_page(lists):
    tally = defaultdict(lambda: {'n': 0, 'by': '', 'lists': set()})
    for c in lists:
        for it in c['items']:
            if it['verify']['by'] == 'human':
                continue
            t = tally[it['verify']['how']]
            t['n'] += 1
            t['by'] = it['verify']['by']
            t['lists'].add(c['id'])
    rows = [['Checker', 'Kind', 'Checks', 'Lists']]
    for how, t in sorted(tally.items(), key=lambda kv: -kv[1]['n'])[:14]:
        found = checker(how)
        cell = f'<a href="{e(found[1])}">{e(how)}</a>' if found and found[1] else e(how)
        rows.append([cell, t['by'].capitalize(), str(t['n']), str(len(t['lists']))])
    chat = block('chat', [
        ['You', 'Check <code>feat-hero--brand-site--acme.aem.page</code> before I merge.'],
        ['Steps', '<ul><li>Rendered the branch preview, mobile and desktop</li>'
                  '<li>Matched to Hero · Blocks, Homepage · Pages, Lighthouse 100 · Delivery</li>'
                  '<li>Ran PageSpeed Insights and /code-review on the branch</li></ul>'],
        ['Edge Checklist', '<ul>'
         '<li>✅ Hero image sits in the first section and is the LCP; mobile Lighthouse is 100. <code>machine · PageSpeed Insights</code></li>'
         '<li>✅ Block works from the authored table alone; no new dependencies. <code>agent · /code-review</code></li>'
         '<li>🤔 The hero heading is an h2 and the page has no h1; authors will copy this. <code>agent · rendered DOM</code></li>'
         '<li>⛔ The analytics tag moved into the lazy phase; it belongs in delayed. <code>agent · scripts.js diff</code></li>'
         '</ul>'],
    ])
    steps = block('columns steps', [[
        '<h3>Point it at a page</h3><p>A preview URL, a branch URL from a pull request, or localhost:3000 from aem up. '
        'It reviews what renders, plus the repo when it has it.</p>',
        '<h3>It finds the checklists</h3><p>Template metadata, the blocks in the DOM and the scripts on the page tell it '
        'which checklists apply. If nothing fits, it says so.</p>',
        '<h3>It splits the work</h3><p>Machine checks run, agent checks get a verdict with evidence, and human checks '
        'come back as a short list with who should answer.</p>',
    ]])
    modes = block('columns modes', [[
        '<p><code>/edge-checklist audit</code></p><h3>Coverage</h3><p>Item by item: present, partial or missing, and '
        'whether the gap matters on this page.</p><ul><li>✅ LCP image eager</li><li>✅ Title and description</li>'
        '<li>⚠️ og:image falls back to the first image</li><li>⛔ No canonical on the locale root</li></ul>',
        '<p><code>/edge-checklist critique</code></p><h3>Judgement</h3><p>A reviewer\'s opinion from the same knowledge: '
        'what is working, what to reconsider.</p><ul><li>✅ Cards keep one rhythm across all nine teasers</li>'
        '<li>🤔 Two carousels on one page split attention</li><li>🤔 The footer repeats the header links</li></ul>',
    ]])
    return page([
        '<p><em>Concept</em></p><h1>Give your agent an Edge Delivery eye.</h1>'
        '<p>Every checklist, bundled into one skill. Point it at a preview URL, a branch or a block, and it audits '
        'against the checklists that match, running the machine checks itself.</p>'
        '<pre><code>npx skills add &lt;your-org&gt;/edge-checklist</code></pre>' + section_style('hero'),
        chat,
        '<h2>How it works</h2>' + steps + modes + section_style('intro'),
        f'<h2>Built on checkers you already run.</h2><p>The skill writes no new rules. It routes each item to the tool '
        f'named on it. These are the ones the {len(lists)} checklists lean on most.</p>'
        + block('checkers', rows)
        + '<p><a href="/sources">Every source, skill and tool behind the checks</a></p>' + section_style('intro'),
        kv_block('metadata', [
            ('title', 'Agent skill · Edge Checklist'),
            ('description', 'Concept: every Edge Checklist bundled into one agent skill that audits a preview URL, '
                            'branch or block and routes each check to the tool named on it.'),
        ]),
    ])


def sidekick_page():
    steps = block('columns steps', [[
        '<h3>Matches the page</h3><p>Reads the page\'s template metadata and the blocks it renders, then opens the '
        'checklists that apply.</p>',
        '<h3>Runs what a machine can</h3><p>Metadata, headings, image loading, redirects and index entries are checked '
        'on the preview. No one ticks those by hand.</p>',
        '<h3>Leaves the rest to people</h3><p>Human items stay as a short list next to Publish, with the doc that '
        'explains each one.</p>',
    ]])
    return page([
        '<p><em>Concept</em></p><h1>The gut check, inside Sidekick.</h1>'
        '<p>Authors and developers already open every page through the Sidekick. A checklist plugin there meets them '
        'on the preview, before publish.</p>' + section_style('hero'),
        sidekick_demo(),
        steps,
        kv_block('metadata', [
            ('title', 'Sidekick plugin · Edge Checklist'),
            ('description', 'Concept: the Edge Checklist as a Sidekick plugin that matches the preview page to its '
                            'checklists and runs the machine checks before publish.'),
        ]),
    ])


SOURCE_HOSTS = [
    ('www.aem.live', 'aem.live documentation', 'https://www.aem.live/docs/'),
    ('experienceleague.adobe.com', 'Experience League', 'https://experienceleague.adobe.com/'),
    ('github.com', 'Adobe code on GitHub (aem-boilerplate, aem-block-collection, …)', 'https://github.com/adobe'),
    ('raw.githubusercontent.com', 'Adobe code on GitHub (raw files)', 'https://github.com/adobe'),
    ('docs.da.live', 'Experience Workspace documentation', 'https://docs.da.live/'),
    ('w3.org', 'W3C (WCAG, ARIA practices)', 'https://www.w3.org/WAI/'),
]


def sources_page(lists):
    items = [(c['id'], it) for c in lists for it in c['items']]
    # documentation, grouped by host
    by_host = defaultdict(lambda: [0, set()])
    for cid, it in items:
        if it.get('source'):
            host = urlparse(it['source']).netloc
            host = host[4:] if host.startswith('www.') and host != 'www.aem.live' else host
            key = host if any(host == h for h, _, _ in SOURCE_HOSTS) else 'other'
            by_host[key][0] += 1
            by_host[key][1].add(cid)
    doc_rows = [['Source', 'Kind', 'Checks', 'Lists']]
    for host, label, url in SOURCE_HOSTS:
        if host in by_host:
            n, ids = by_host[host]
            doc_rows.append([f'<a href="{url}">{e(label)}</a>', 'Documentation', str(n), str(len(ids))])
    if 'other' in by_host:
        n, ids = by_host['other']
        doc_rows.append(['Other public pages (vendor and platform docs)', 'Documentation', str(n), str(len(ids))])
    unsourced = sum(1 for _, it in items if not it.get('source'))

    # checkers, grouped by provenance
    groups = defaultdict(dict)
    for cid, it in items:
        found = checker(it['verify']['how'])
        if not found:
            continue
        name, url, kind = found
        row = groups[kind].setdefault(name, [url, 0, set()])
        row[1] += 1
        row[2].add(cid)

    def table(kind, label):
        rows = [[label, 'Kind', 'Checks', 'Lists']]
        for name, (url, n, ids) in sorted(groups[kind].items(), key=lambda kv: -kv[1][1]):
            cell = f'<a href="{e(url)}">{e(name)}</a>' if url else e(name)
            rows.append([cell, e(kind), str(n), str(len(ids))])
        return block('checkers', rows)

    count = lambda kind: sum(v[1] for v in groups[kind].values())  # noqa: E731
    return page([
        '<h1>Sources</h1><p>What each check says comes from public documentation and Adobe code. How each check is '
        'verified points to Adobe\'s agent skills, the Helix admin tools and other public tools. This page lists all '
        'of them, with how many checks lean on each.</p>' + section_style('title'),
        f'<h2>Documentation</h2><p>{len(items) - unsourced} of {len(items)} checks link the page or file that backs '
        f'them. {unsourced} come from agent skills only and say so on the check.</p>' + block('checkers', doc_rows)
        + section_style('intro'),
        f'<h2>Adobe agent skills</h2><p>{count("Adobe skill")} checks name a skill from Adobe\'s open-source '
        f'<a href="{SKILLS_REPO}">skills for Edge Delivery Services</a>, the edge-delivery-services and '
        'edge-delivery-services-content-ops plugins.</p>' + table('Adobe skill', 'Skill') + section_style('intro'),
        f'<h2>Helix admin tools</h2><p>{count("Helix tool")} checks are settled in the '
        f'<a href="{HELIX_TOOLS}">admin tools at tools.aem.live</a>: index, page status, headers, CDN setup, '
        'users and configuration.</p>' + table('Helix tool', 'Tool') + section_style('intro'),
        f'<h2>Adobe and public tools</h2><p>{count("Adobe tool") + count("Public tool")} checks name a tool such as '
        'Sidekick, the OpTel explorer, PageSpeed Insights or axe.</p>'
        + table('Adobe tool', 'Adobe tool') + table('Public tool', 'Public tool') + section_style('intro'),
        kv_block('metadata', [
            ('title', 'Sources · Edge Checklist'),
            ('description', 'Where the Edge Checklist comes from: aem.live and Experience League documentation, '
                            'Adobe\'s agent skills, the Helix admin tools at tools.aem.live and public tools.'),
        ]),
    ])


def nav_page():
    cats = ''.join(f'<li><a href="/{cid}">{e(name)}</a></li>' for cid, name, _ in CATEGORIES)
    return page([
        '<p><a href="/">:logo:Edge Checklist</a></p>',
        f'<ul><li><a href="/">Home</a></li><li><p>Browse</p><ul>{cats}<li><a href="/browse">All checklists</a></li></ul></li>'
        '<li><a href="/skill">Agent skill</a></li><li><a href="/sidekick">Sidekick</a></li></ul>',
        '<p><a href="/browse">Search</a></p>',
    ])


def footer_page(lists, by_cat, items_total):
    cols = []
    for cid, name, _ in CATEGORIES:
        links = ''.join(f'<li><a href="{path(c)}">{e(c["title"])}</a></li>' for c in by_cat[cid])
        cols.append(f'<h2>{e(name)}</h2><ul>{links}</ul>')
    return page([
        '<p><a href="/">:logo:Edge Checklist</a></p>'
        '<p>A concept for AEM Edge Delivery Services teams. Checks cite aem.live, Experience League and the '
        'boilerplate code.</p>'
        '<ul><li><a href="/skill">Run it as an agent skill</a></li><li><a href="/sidekick">Use it in Sidekick</a></li></ul>',
        block('columns', [cols]),
        '<p>Design idea after checklist.design by George Hatzis. Checks cite aem.live, Experience League, '
        '<a href="/sources">Adobe skills and tools.aem.live</a>. Not an Adobe product.</p>'
        f'<p>{len(lists)} checklists · {items_total} checks</p>',
    ])


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else 'content').expanduser().resolve()
    order = [c[0] for c in CATEGORIES]
    lists = [c for f in DATA_FILES for c in json.loads((HERE / 'data' / f'{f}.json').read_text())]
    lists.sort(key=lambda c: order.index(c['category']))
    by_id = {c['id']: c for c in lists}
    by_cat = defaultdict(list)
    for c in lists:
        by_cat[c['category']].append(c)
    totals = Counter(it['verify']['by'] for c in lists for it in c['items'])
    items_total = sum(totals.values())

    files = {}
    for c in lists:
        files[f"{c['category']}/{c['id']}.html"] = checklist_page(c, by_id)
    for cid, name, blurb in CATEGORIES:
        files[f'{cid}.html'] = index_page(name, blurb, by_cat[cid], lists, by_cat,
                                          f'{name} checklists · Edge Checklist', theme=f'cat-{cid}')
    files['browse.html'] = index_page(
        f'All {len(lists)} checklists',
        'Every checklist, every category. The bar on each card shows the mix of machine, agent and human checks.',
        lists, lists, by_cat, 'All checklists · Edge Checklist')
    files['index.html'] = home_page(lists, by_cat, by_id, totals)
    files['skill.html'] = skill_page(lists)
    files['sidekick.html'] = sidekick_page()
    files['sources.html'] = sources_page(lists)
    files['nav.html'] = nav_page()
    files['footer.html'] = footer_page(lists, by_cat, items_total)

    for rel, content in files.items():
        target = out / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding='utf-8')
    print(f'{len(files)} files, {len(lists)} checklists, {items_total} checks -> {out}')


if __name__ == '__main__':
    main()
