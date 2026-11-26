# Edge Checklist

Checklists for AEM Edge Delivery Services teams: blocks, pages, delivery, authoring, connected
systems and flows. Every check says how it is verified (machine, agent or human) and links the doc
or code that backs it. The design idea follows [checklist.design](https://www.checklist.design/).

A concept by somarc. Not an Adobe product.

## Environments

| Surface | URL |
|---|---|
| Preview | https://main--edge-checklist--somarc.aem.page/ |
| Live (not published yet) | https://main--edge-checklist--somarc.aem.live/ |
| Content (DA / Experience Workspace) | https://da.live/#/somarc/edge-checklist |
| Code | https://github.com/somarc/edge-checklist |

Local: `npx -y @adobe/aem-cli up` (local code, previewed content) on http://localhost:3000.

## Scope

- 6 categories, 67 checklists, 569 checks. Each checklist is one DA page at `/{category}/{id}`.
- Category index pages at `/blocks`, `/pages`, `/delivery`, `/authoring`, `/systems`, `/flows`,
  plus `/browse` (all), `/skill` and `/sidekick` (concept pages).
- No query-index dependency while the site is preview-only: every list is authored link rows.
  Search reads `/query-index.json` when it has rows and falls back to the footer's links.

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
  Helix admin tools (tools.aem.live), Adobe and public tools, and somarc's unpublished checkers,
  each as a `checkers` table with check and checklist counts. `tools/checkers.py` holds the mapping.

### Fragments

- `/nav`: brand (`:logo: Edge Checklist`), sections (Browse with nested category list, Agent skill,
  Sidekick), tools (Search link to `/browse`, upgraded to a search dialog).
- `/footer`: brand + CTA list, `columns` block with one column per category, bottom line.

## Data and generator

The checklist content was researched from aem.live, Experience League and the boilerplate and
block-collection code; `tools/` holds the generator that writes the DA pages from `tools/data/`.
Edit pages in DA after seeding; the generator is for the first seed and bulk rewrites only.

## Quality gates

- `npm run lint`
- `node ~/.agents/skills/eds-build-contract/scripts/eds-guard.mjs .` reports 0 errors
- PageSpeed Insights 100 on the preview URL of changed pages
