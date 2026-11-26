"""Where each verify.how points: a public URL and a provenance kind.

Kinds: Adobe skill (github.com/adobe/skills), Helix tool (tools.aem.live),
Adobe tool, Public tool. Shell commands stay unlinked.
"""
import re

ADOBE_SKILLS = {
    'edge-delivery-services': [
        'code-review', 'content-modeling', 'block-collection-and-party', 'ue-component-model',
        'find-test-content', 'building-blocks', 'page-import', 'preview-import', 'testing-blocks',
    ],
    'edge-delivery-services-content-ops': [
        'accessibility-fix', 'content-audit', 'cwv-optimizer', 'bulk-metadata', 'link-rot-scanner',
        'sitemap-audit', 'heading-optimizer', 'image-seo', 'internal-linking',
    ],
}
SKILL_PLUGIN = {s: p for p, names in ADOBE_SKILLS.items() for s in names}
SKILLS_REPO = 'https://github.com/adobe/skills'
HELIX_TOOLS = 'https://tools.aem.live/'


T = 'https://tools.aem.live/tools/'
RULES = [  # (regex on verify.how, name shown on /sources, url, kind)
    (r'^Index Admin|^Admin API /index|admin\.hlx\.page/index', 'Index Admin', T + 'index-admin/index.html', 'Helix tool'),
    (r'^Admin API (preview )?status', 'Page Status', T + 'page-status/index.html', 'Helix tool'),
    (r'^Admin API logs', 'Log Viewer', T + 'log-viewer/index.html', 'Helix tool'),
    (r'^Admin API versions', 'Version Admin', T + 'version-admin/index.html', 'Helix tool'),
    (r'^Admin API', 'Admin Edit', T + 'admin-edit/index.html', 'Helix tool'),
    (r'^read headers config', 'HTTP Headers', T + 'headers-edit/index.html', 'Helix tool'),
    (r'^tools\.aem\.live user admin', 'User Admin', T + 'user-admin/index.html', 'Helix tool'),
    (r'CDN config', 'CDN Setup', T + 'cdn-setup/index.html', 'Helix tool'),
    (r'^site config review', 'Simple Config Editor', T + 'simple-config-editor/index.html', 'Helix tool'),
    (r'^OpTel', 'OpTel explorer', 'https://www.aem.live/tools/oversight/explorer.html', 'Adobe tool'),
    (r'^Sidekick', 'AEM Sidekick', 'https://www.aem.live/docs/sidekick', 'Adobe tool'),
    (r'Code Sync', 'AEM Code Sync', 'https://github.com/apps/aem-code-sync', 'Adobe tool'),
    (r'^aem up', 'AEM CLI', 'https://github.com/adobe/helix-cli', 'Adobe tool'),
    (r'^Experience Workspace layout view', 'Experience Workspace layout view',
     'https://www.aem.live/docs/ew/developing/layout-view', 'Adobe tool'),
    (r'^Experience Workspace|^da\.live', 'Experience Workspace', 'https://da.live/', 'Adobe tool'),
    (r'^Adobe Experience Platform Debugger', 'Experience Platform Debugger',
     'https://experienceleague.adobe.com/en/docs/experience-platform/debugger/home', 'Adobe tool'),
    (r'^PageSpeed Insights|^PSI', 'PageSpeed Insights', 'https://pagespeed.web.dev/', 'Public tool'),
    (r'^Lighthouse', 'Lighthouse', 'https://developer.chrome.com/docs/lighthouse/overview', 'Public tool'),
    (r'^axe DevTools', 'axe DevTools', 'https://www.deque.com/axe/devtools/', 'Public tool'),
    (r'^Rich Results Test', 'Rich Results Test', 'https://search.google.com/test/rich-results', 'Public tool'),
    (r'^URL Inspection Tool|^Google Search Console', 'Google Search Console',
     'https://search.google.com/search-console/about', 'Public tool'),
]


def checker(how):
    """Return (name, url, kind) for a verify.how, or None for plain commands."""
    h = how.strip()
    if h.startswith('/'):
        name = h.split()[0].lstrip('/')
        if name in SKILL_PLUGIN:
            return (f'/{name}', f'{SKILLS_REPO}/tree/main/plugins/aem/{SKILL_PLUGIN[name]}/skills/{name}', 'Adobe skill')
        return None
    for pattern, name, url, kind in RULES:
        if re.search(pattern, h):
            return (name, url, kind)
    return None


def all_urls():
    urls = {f'{SKILLS_REPO}/tree/main/plugins/aem/{p}/skills/{s}' for s, p in SKILL_PLUGIN.items()}
    urls |= {r[2] for r in RULES}
    urls |= {SKILLS_REPO, HELIX_TOOLS}
    return sorted(urls)
