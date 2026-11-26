# Edge Checklist

Checklists for AEM Edge Delivery Services teams: blocks, pages, delivery, authoring, connected
systems and flows. Every check says how it is verified (machine, agent or human) and links the doc
or code that backs it. The design idea follows [checklist.design](https://www.checklist.design/).

A concept by somarc. Not an Adobe product.

## Environments

| Surface | URL |
|---|---|
| Preview | https://main--edge-checklist--somarc.aem.page/ |
| Live | https://main--edge-checklist--somarc.aem.live/ |
| Content (DA / Experience Workspace) | https://da.live/#/somarc/edge-checklist |
| Code | https://github.com/somarc/edge-checklist |

Local: `npx -y @adobe/aem-cli up` (local code, previewed content) on http://localhost:3000.

## Scope

- 6 categories, 67 checklists, 569 checks. Each checklist is one DA page at `/{category}/{id}`.
- Category index pages at `/blocks`, `/pages`, `/delivery`, `/authoring`, `/systems`, `/flows`,
  plus `/browse` (all), `/skill` and `/sidekick` (concept pages).
- Every list (browse, categories, related, footer) is authored link rows, so pages render
  without the index. Search reads `/query-index.json` (title, category, icon and check titles as
  `keywords`) and falls back to the footer's links when the index is unavailable.

## Content model

Authors see these tables in DA. Blocks classify authored nodes and add chrome; they never rebuild
authored text (Canvas / quick-edit rule).

### Checklist page (`/{category}/{id}`)

Metadata: `Title`, `Description`, `Template: checklist-page`, `Theme: cat-{category}`,
`Category`, `Icon` (icon name), `Checks` (count), `Keywords` (item titles).

1. **Title section** (section style `title`): `:icon:` paragraph, `h1`, category link paragraph
   (`/{category}`), summary paragraph.
2. **Checklist section** (section style `checklist-layout`):
   - `checklist` block, one row per check:

     | Check (h3 + detail p) | Level | Verify | Source |
     |---|---|---|---|
     | `### First section` + one sentence | Must / Should / Could | `Machine: PageSpeed Insights` | link |

     `Verify` starts with `Machine`, `Agent` or `Human`, then `:` and the tool, linked when the
     tool is public (Adobe skill on github.com/adobe/skills, tools.aem.live tool, public tool). The block adds
     the progress header, checkboxes (saved per page in localStorage), the Must filter, Reset
     and the export bar (plain text, Markdown, GitHub, Jira, Slack, agent prompt).
   - `related` block, one row per card: `## Related` + links `:icon: Title` followed by the
     category name, e.g. `[:gauge: Lighthouse 100](/delivery/performance) Delivery`; then
     `## Verify with` + links to the checkers this checklist uses and a closing link to
     https://tools.aem.live/.
3. **In the wild section**: `h2` + `references` block, rows `| [label](url) | note |`.

### Index pages (`/browse`, `/{category}`, home "Find exactly what you need")

- `checklist-index` block, rows `| [:icon: Title](/cat/id) | Category | 9 checks | 4 machine, 3 agent, 2 human |`.
  Variant `featured` makes some tiles wide.
- Category filter: a list of links in a section with style `filters`.

### Home

- Section style `hero`: `h1`, lede, `ul` of tool links.
- `category-cards`: one row per category, `| h2 + blurb + [View all N](/cat) | ul of :icon: links |`.
- `verify-legend`: rows `| 241 | h3 Machine checks + blurb | ul of top checkers |`.
- Section style `promo`: default content + `sidekick-demo` block.

### Concept pages

- `chat`: rows `| You / Edge Checklist | message |`, emoji first in agent findings.
- `columns (steps)` and `columns (modes)`: boilerplate columns with variants.
- `checkers`: rows `| checker | kind | checks | lists |` (generated from the data).
- `sidekick-demo`: rows: URL, `| title | subtitle |`, `| 9 pass | 2 review | 1 missing |`, then `| emoji | finding |`.

### Sources (`/sources`)

- Generated from the data: documentation by host, Adobe agent skills (github.com/adobe/skills),
  Helix admin tools (tools.aem.live) and Adobe and public tools, each as a `checkers` table with check and checklist counts. `tools/checkers.py` holds the mapping.

### Fragments

- `/nav`: brand (`:logo: Edge Checklist`), sections (Browse with nested category list, Agent skill,
  Sidekick), tools (Search link to `/browse`, upgraded to a search dialog).
- `/footer`: brand + CTA list, `columns` block with one column per category, bottom line.

## Data and generator

The checklist content was researched from aem.live, Experience League and the boilerplate and
block-collection code; `tools/` holds the generator that writes the DA pages from `tools/data/`.
Edit pages in DA after seeding; the generator is for the first seed and bulk rewrites only.

## Platform configuration

- Query index `default` (Configuration Service, see Index Admin on tools.aem.live): `/**` minus
  `/nav`, `/footer`, `/drafts/**`; fields title, description, image, category, icon, checks,
  verify-mix, keywords, robots, template. Filled on publish.
- Sitemap: generated from published pages at `/sitemap.xml`; fragments are not listed.
- Social image: `default-meta-image.png` (1200×630) in the repo root; favicon in `favicon.ico`.
- Search engines: `*.aem.live` sends `X-Robots-Tag: noindex` and a disallowing `robots.txt` by
  design. Indexing starts with a production domain (`cdn.prod.host`, BYO or Adobe-managed CDN), a
  custom robots.txt naming the sitemap, and Search Console. See `/delivery/robots` and
  `/flows/going-live` on the site.

## Release

1. Code: merge to `main` (Code Sync deploys it).
2. Content: edit in DA, or regenerate with `python3 tools/generate.py <dir>` and upload with
   `da --org somarc --repo edge-checklist --commit content put-tree <dir> --yes`.
3. `da ... --commit preview pages / --bulk --yes`, check `.aem.page`, then
   `da ... --commit publish pages / --bulk --yes`.

## Quality gates

- `npm run lint`
- Canvas: open the page in Experience Workspace layout view; no modal, lock or page errors
- PageSpeed Insights 100 on the preview URL of changed pages
