"""Experience Workspace library for Edge Checklist (Config > Library in da.live).

Writes, under the content output dir:
  library/blocks/<block>.html     one document per block: variants + library-metadata
  library/templates/<name>.html   page templates
  library/blocks.json             sheets `blocks` (name, path) and `options` (block options)
  library/templates.json          key, value
  library/icons.json              key, value, icon
  placeholders.json               Key, Text (UI text the site code reads)

Follows https://www.aem.live/docs/ew/administering/set-up-library.
"""
import html
import json
import re
from pathlib import Path

ORG, SITE = 'somarc', 'edge-checklist'
DA = f'https://content.da.live/{ORG}/{SITE}'
LIVE = f'https://main--{SITE}--{ORG}.aem.live'
REPO = Path(__file__).resolve().parent.parent


def e(text):
    return html.escape(str(text), quote=True)


def page(sections):
    body = ''.join(f'<div>{s}</div>' for s in sections)
    return f'<body><header></header><main>{body}</main><footer></footer></body>\n'


def block(name, rows):
    inner = ''.join('<div>' + ''.join(f'<div>{c}</div>' for c in row) + '</div>' for row in rows)
    return f'<div class="{name}">{inner}</div>'


def describe(text):
    return block('library-metadata', [['description', e(text)]])


def sheet(rows):
    return {'total': len(rows), 'limit': len(rows), 'offset': 0, 'data': rows, ':type': 'sheet'}


def multi(**sheets):
    out = {name: {'total': len(r), 'limit': len(r), 'offset': 0, 'data': r} for name, r in sheets.items()}
    out[':names'] = list(sheets)
    out[':version'] = 3
    out[':type'] = 'multi-sheet'
    return out


def block_docs(lists, by_id, h):
    """h: helpers from generate.py (icon_link, index_rows, verify_cell, source_cell, legend rows…)."""
    hero = by_id['hero']
    docs = {}

    docs['checklist'] = page([
        block('checklist', [h['item_row'](it) for it in hero['items'][:3]])
        + describe('The checklist itself. One row per check: a heading and one sentence of detail, then Must, '
                   'Should or Could, then "Machine:", "Agent:" or "Human:" and the tool, then the source link. '
                   'On the published page it adds checkboxes, progress, the Must filter, Reset and export buttons.'),
    ])
    docs['related'] = page([
        block('related', [[f'<h2>Related</h2><ul>{"".join(h["related_items"](hero))}</ul>'],
                          [h['verify_with'](hero)]])
        + describe('The side card next to a checklist: related checklists (icon link, then the category name) '
                   'and the checkers that verify it, ending with a link to tools.aem.live.'),
    ])
    docs['references'] = page([
        block('references', [[f'<a href="{e(w["url"])}">{e(w["label"])}</a>', e(w.get('note', ''))]
                             for w in hero['wild'][:2]])
        + describe('"In the wild" links under a checklist: the link, then a short note. External links open '
                   'in a new tab and show their host.'),
    ])
    sample = [by_id[i] for i in ('performance', 'hero', 'going-live', 'commerce') if i in by_id]
    featured = [by_id[i] for i in ('performance', 'hero', 'going-live', 'commerce', 'content-model') if i in by_id]
    docs['checklist-index'] = page([
        block('checklist-index', h['index_rows'](sample))
        + describe('Tiles linking to checklists: icon link, category, check count, and the machine, agent and '
                   'human mix (shown as a bar). Used on /browse and the category pages.'),
        block('checklist-index featured', h['index_rows'](featured))
        + describe('Same tiles with every few tiles drawn wide, for the home page.'),
    ])
    docs['category-cards'] = page([
        block('category-cards', h['category_rows'](['blocks', 'pages']))
        + describe('Home page category cards: the category heading, a one-line blurb and a "View all" link to the '
                   'category page, then a list of checklist links with icons. The tint comes from the link.'),
    ])
    docs['verify-legend'] = page([
        block('verify-legend', h['legend_rows']())
        + describe('Three cards for machine, agent and human checks: the count, a heading and blurb, then the '
                   'checkers they use most with their counts.'),
    ])
    docs['checkers'] = page([
        block('checkers', h['checker_rows'](4))
        + describe('A table of checkers: first row is the header, then checker, kind, number of checks and '
                   'number of checklists. The bar shows each checker\'s share.'),
    ])
    docs['chat'] = page([
        block('chat', [
            ['You', 'Check <code>feat-hero--brand-site--acme.aem.page</code> before I merge.'],
            ['Steps', '<ul><li>Matched Hero · Blocks</li><li>Ran PageSpeed Insights on the branch preview</li></ul>'],
            ['Edge Checklist', '<ul><li>✅ The hero image is the LCP. <code>machine · PageSpeed Insights</code></li>'
                               '<li>🤔 The hero heading is an h2. <code>agent · rendered DOM</code></li></ul>'],
        ])
        + describe('A short agent conversation. Speaker "You" is the user, "Steps" shows progress lines, any '
                   'other speaker is the agent; start each finding with an emoji and end with code for the checker.'),
    ])
    docs['sidekick-demo'] = page([
        h['sidekick_demo']()
        + describe('An illustration of the checklist running in Sidekick: the URL, a title and subtitle, three '
                   'counts (number, then label), then one row per finding starting with ✅, 🤔 or ⛔.'),
    ])
    docs['columns'] = page([
        block('columns', [['<p>Left column text.</p>', '<p>Right column text.</p>']])
        + describe('Plain columns: one row, one cell per column. The footer uses it for the category lists.'),
        block('columns steps', [[
            '<h3>First step</h3><p>One or two sentences.</p>',
            '<h3>Second step</h3><p>One or two sentences.</p>',
            '<h3>Third step</h3><p>One or two sentences.</p>',
        ]])
        + describe('Numbered step cards, one per cell. Put an h2 before the block so headings stay in order.'),
    ])
    styles = [
        ('Title section', 'title', 'Icon, h1, category link and summary on checklist and index pages.'),
        ('Checklist layout', 'checklist-layout', 'Checklist block with the related card beside it.'),
        ('In the wild', 'wild', 'Aligns the references section with the checklist column.'),
        ('Hero', 'hero', 'Centered display heading, lede and tool links or a code line.'),
        ('Intro', 'intro', 'Centered heading and lede above a block.'),
        ('Promo', 'promo', 'White card with copy beside the Sidekick demo.'),
        ('Filters', 'filters', 'Category links above an index; the current page is highlighted.'),
    ]
    docs['section-metadata'] = page([
        f'<h2>{e(label)}</h2>' + block('section-metadata', [['style', style]]) + describe(note)
        for label, style, note in styles
    ])
    return docs


def templates(h):
    checklist = page([
        '<p>:list-checks:</p><h1>Checklist title</h1><p><a href="/blocks">Blocks</a></p>'
        '<p>One to three sentences: what this is in Edge Delivery and why the checklist matters.</p>'
        + block('section-metadata', [['style', 'title']]),
        block('checklist', [
            ['<h3>First check</h3><p>One plain sentence, at most 150 characters.</p>', 'Must',
             'Machine: PageSpeed Insights', '<a href="https://www.aem.live/docs/">aem.live</a>'],
            ['<h3>Second check</h3><p>One plain sentence, at most 150 characters.</p>', 'Should',
             'Agent: /code-review', '<a href="https://www.aem.live/docs/">aem.live</a>'],
        ])
        + block('related', [['<h2>Related</h2><ul><li><a href="/delivery/performance">:gauge:Lighthouse 100</a> '
                             'Delivery</li></ul>'],
                            [f'<h2>Verify with</h2><p><a href="https://tools.aem.live/">All Helix admin tools on '
                             'tools.aem.live</a></p>']])
        + block('section-metadata', [['style', 'checklist-layout']]),
        '<h2>In the wild</h2>'
        + block('references', [['<a href="https://www.aem.live/docs/">Reference</a>', 'What it shows']])
        + block('section-metadata', [['style', 'wild']]),
        block('metadata', [
            ['title', 'Checklist title · Category checklist'], ['description', 'The summary above.'],
            ['template', 'checklist-page'], ['theme', 'cat-blocks'], ['category', 'Blocks'],
            ['icon', 'list-checks'], ['checks', '2'], ['verify-mix', '1 machine, 1 agent, 0 human'],
            ['keywords', 'First check, Second check'],
        ]),
    ])
    index = page([
        '<h1>Category</h1><p>One line about this category.</p>' + block('section-metadata', [['style', 'title']]),
        '<ul><li><a href="/browse">All</a></li><li><a href="/blocks">Blocks</a></li></ul>'
        + block('section-metadata', [['style', 'filters']]),
        block('checklist-index', [['<a href="/blocks/hero">:mountain-snow:Hero</a>', 'Blocks', '9 checks',
                                   '5 machine, 3 agent, 1 human']]),
        block('metadata', [['title', 'Category checklists · Edge Checklist'], ['description', 'One line.'],
                           ['template', 'index'], ['theme', 'cat-blocks']]),
    ])
    concept = page([
        '<p><em>Concept</em></p><h1>Page title</h1><p>One or two sentences that say what this is.</p>'
        + block('section-metadata', [['style', 'hero']]),
        '<h2>How it works</h2>'
        + block('columns steps', [['<h3>First</h3><p>One or two sentences.</p>',
                                   '<h3>Second</h3><p>One or two sentences.</p>',
                                   '<h3>Third</h3><p>One or two sentences.</p>']])
        + block('section-metadata', [['style', 'intro']]),
        block('metadata', [['title', 'Page title · Edge Checklist'], ['description', 'One line.']]),
    ])
    return {'checklist-page': checklist, 'category-index': index, 'concept-page': concept}


OPTIONS = [
    ('style', 'section-metadata', 'title | checklist-layout | wild | hero | intro | promo | filters', 'single',
     'Section style'),
    ('title', 'metadata', '', '', 'Page title'),
    ('description', 'metadata', '', '', 'Description'),
    ('category', 'metadata', 'Blocks | Pages | Delivery | Authoring | Connected systems | Flows', 'single',
     'Category'),
    ('theme', 'metadata', 'Blocks=cat-blocks | Pages=cat-pages | Delivery=cat-delivery | Authoring=cat-authoring '
     '| Connected systems=cat-systems | Flows=cat-flows', 'single', 'Page colour'),
    ('template', 'metadata', 'Checklist page=checklist-page | Index=index', 'single', 'Template'),
    ('icon', 'metadata', '', '', 'Icon (file name in /icons, e.g. gauge)'),
    ('checks', 'metadata', '', '', 'Number of checks'),
    ('verify-mix', 'metadata', '', '', 'Verify mix (e.g. 4 machine, 3 agent, 2 human)'),
    ('keywords', 'metadata', '', '', 'Check titles, comma-separated (search)'),
    ('robots', 'metadata', 'noindex', 'single', 'Robots'),
]

BLOCK_NAMES = [
    ('Checklist', 'checklist'), ('Related', 'related'), ('References', 'references'),
    ('Checklist index', 'checklist-index'), ('Category cards', 'category-cards'),
    ('Verify legend', 'verify-legend'), ('Checkers', 'checkers'), ('Chat', 'chat'),
    ('Sidekick demo', 'sidekick-demo'), ('Columns', 'columns'), ('Section metadata', 'section-metadata'),
]
TEMPLATE_NAMES = [('Checklist page', 'checklist-page'), ('Category index', 'category-index'),
                  ('Concept page', 'concept-page')]


def placeholder_rows():
    src = (REPO / 'scripts' / 'placeholders.js').read_text()
    body = src[src.index('const DEFAULTS = {'):src.index('};', src.index('const DEFAULTS = {'))]
    return [{'Key': k, 'Text': v} for k, v in re.findall(r"'([\w-]+)':\s*'((?:[^'\\]|\\.)*)'", body)]


def icon_rows():
    names = sorted(p.stem for p in (REPO / 'icons').glob('*.svg') if p.stem not in ('check-white',))
    return [{'key': n, 'value': n.replace('-', ' ').capitalize(), 'icon': f'{LIVE}/icons/{n}.svg'} for n in names]


def write(out, lists, by_id, helpers):
    files = {}
    for name, content in block_docs(lists, by_id, helpers).items():
        files[f'library/blocks/{name}.html'] = content
    for name, content in templates(helpers).items():
        files[f'library/templates/{name}.html'] = content
    blocks_rows = [{'name': n, 'path': f'{DA}/library/blocks/{p}'} for n, p in BLOCK_NAMES]
    option_rows = [{'key': k, 'blocks': b, 'values': v, 'type': t, 'label': lbl} for k, b, v, t, lbl in OPTIONS]
    jsons = {
        'library/blocks.json': multi(blocks=blocks_rows, options=option_rows),
        'library/templates.json': sheet([{'key': n, 'value': f'{DA}/library/templates/{p}'}
                                         for n, p in TEMPLATE_NAMES]),
        'library/icons.json': sheet(icon_rows()),
        'placeholders.json': sheet(placeholder_rows()),
    }
    for rel, content in files.items():
        (out / rel).parent.mkdir(parents=True, exist_ok=True)
        (out / rel).write_text(content, encoding='utf-8')
    for rel, data in jsons.items():
        (out / rel).parent.mkdir(parents=True, exist_ok=True)
        (out / rel).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    return len(files) + len(jsons)


LIBRARY_CONFIG = [
    {'title': 'Blocks', 'path': f'{DA}/library/blocks.json', 'format': '', 'ref': '', 'icon': '', 'experience': ''},
    {'title': 'Templates', 'path': f'{DA}/library/templates.json', 'format': '', 'ref': '', 'icon': '',
     'experience': ''},
    {'title': 'Icons', 'path': f'{DA}/library/icons.json', 'format': ':<content>:', 'ref': '', 'icon': '',
     'experience': ''},
]
