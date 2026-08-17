# scrap — e-commerce catalog scraper & sales estimator (Claude Code skill)

[![tests](https://github.com/Dylanfaks/scrap-skill/actions/workflows/test.yml/badge.svg)](https://github.com/Dylanfaks/scrap-skill/actions/workflows/test.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**[Leé esto en español → README.es.md](README.es.md)**

`/scrap` is a [Claude Code](https://claude.com/claude-code) skill that scrapes the
**public catalog of any online store** into a clean **PDF + HTML report**, and compares
snapshots over time to **estimate a store's sales, revenue and trend** — all from data
the store itself makes public. No API keys, no login, no credentials.

Works with **Tienda Nube / Nuvemshop**, **Shopify**, **WooCommerce** and, as a fallback,
**any store with standard structured data** (JSON-LD / Open Graph — Magento, PrestaShop,
VTEX, BigCommerce, custom builds…). The platform is **auto-detected** from the URL: you
never have to say which one it is.

## What you get

- **Catalog report** (`/scrap <url>`): every product with prices, promos, variants,
  stock (where public), images, categories and SEO metadata — as a print-ready PDF and a
  lightweight HTML with the full dataset embedded (machine-readable).
- **Sales estimation** (`/scrap compare`): give it 2+ reports of the same store from
  different dates and it estimates **units sold, revenue, average ticket, restocks,
  top sellers and per-period trend** — with an honest methodology section in the report.

## Quick start

1. Clone or download this repo.
2. Copy it into your Claude Code skills directory:
   ```bash
   cp -r scrap ~/.claude/skills/scrap
   ```
3. Install dependencies (once):
   ```bash
   npm install --prefix ~/.claude/skills/scrap
   ```
4. In Claude Code:
   ```
   /scrap https://somestore.com
   ```
   …and days later, attach two reports and run `/scrap compare`.

**Requirements:** Node.js ≥ 18 and Google Chrome or Chromium (only for the PDF; the HTML
report works without it). Chrome is auto-detected on macOS, Windows and Linux — override
with the `CHROME_PATH` environment variable.

You can also use the scripts standalone, without Claude Code:

```bash
node scripts/scrape.js https://somestore.com            # full catalog
node scripts/scrape.js somestore.com --limit 20         # quick test
node scripts/compare.js output/.compare/*.json          # sales estimate
```

## How does it detect the platform?

`scripts/lib/detect.js` fetches the URL (following the usual redirects, and even finding
the real store when you pass a brand's marketing site) and looks for platform signals in
the HTML; if none are found it actively probes the platform's public endpoints:

| Platform | Detection signal | Catalog source | Stock granularity |
|---|---|---|---|
| **Tienda Nube / Nuvemshop** | `LS.product`, `mitiendanube.com` CDN | sitemap → each product page (embedded product JSON + variants) | **numeric stock per variant + lifetime units sold (`sold_qty`)** |
| **Shopify** | `cdn.shopify.com`, `Shopify.shop` | public `/products.json` (paginated) | availability only (in/out of stock) |
| **WooCommerce** | `wp-content/plugins/woocommerce` | public Store API `/wp-json/wc/store/v1/products` | availability only |
| **Generic (fallback)** | always matches | sitemap → pages with JSON-LD `Product` / Open Graph | availability only |

## How is the sales estimate calculated?

Reports are matched **by product ID** and ordered by scrape date. For each pair of
consecutive scraps, the engine uses the **best public signal available per product**:

1. **`sold_qty` delta** (Tienda Nube): the platform publishes a lifetime units-sold
   counter — its delta between scraps is exact and even catches sales through restocks.
2. **Stock drop**: whatever stock went down, sold. This is a **floor** — restocks that
   happened between scraps hide sales.
3. **Availability transitions** (Shopify / WooCommerce / generic): without numeric stock,
   the report tracks which products **sold out** or **came back in stock**. No invented units.

Revenue is valued at the list price at the start of each period. Every report includes a
**method & limits** section saying exactly which signal was used — the goal is an honest
estimate, not an impressive number.

> **The more scraps, the better.** Scraping every few days shortens the blind window
> between snapshots, catches restocks, and turns the estimate into a real trend line.

## FAQ

### Is this legal / ethical?

The skill reads only what the store **publishes to every visitor**: its public catalog
pages, its sitemap, its public JSON endpoints. It sends a normal browser User-Agent, runs
with **low concurrency (3)** and **respects rate limiting** (HTTP 429 + `Retry-After`).
It never logs in, never bypasses protections, never touches private data. Even so, you're
responsible for using it in accordance with each site's terms of service and your local
laws. It's built for **competitive analysis and market research** on data anyone can see.

### Why is stock only available for Tienda Nube?

Because the other platforms don't make it public. Shopify's `/products.json` and Woo's
Store API expose availability (in/out of stock) but not unit counts. The reports are
explicit about this instead of guessing.

### Can it estimate sales for a Shopify store then?

Partially: it reports which products **sold out** and which **came back** between scraps —
a real demand signal — but it won't invent unit counts it can't observe.

### What if the store is temporarily closed (password page)?

Tienda Nube stores show a password page pre-drop. If you scraped before, the skill
regenerates the report from its local cache and tells you.

### Does it work outside Argentina?

Yes. Tienda Nube country subcatalogs are filtered to the local one; Shopify/Woo/generic
stores work worldwide. Currency is detected and shown (report text is in Spanish for now —
PRs welcome).

## Project structure

```
scrap/
├── SKILL.md                    # instructions Claude Code follows
├── README.md / README.es.md
├── package.json                # dependency: puppeteer-core (PDF only)
├── scripts/
│   ├── scrape.js               # /scrap <url> — orchestrator
│   ├── compare.js              # /scrap compare — sales engine
│   └── lib/
│       ├── detect.js           # platform auto-detection
│       ├── platforms/          # tiendanube.js · shopify.js · woocommerce.js · generic.js
│       ├── templates-*.js      # report HTML (catalog & sales)
│       ├── render.js           # HTML → PDF via system Chrome (light images)
│       ├── net.js / normalize.js / format.js / chrome.js
└── test/                       # node --test; fixtures with real store data
```

## Testing

```bash
npm test
```

42 tests, no network needed: parsing anchored to **real fixtures** captured from live
stores of each platform (see `test/fixtures/README.md`), sales-engine math, template
rendering, and CLI behavior (bad input, corrupt datasets).

## Contributing

Issues and PRs welcome — especially new platform adapters (an adapter is one file in
`scripts/lib/platforms/` exporting `sniff()` + `getCatalog()` with the shared product
shape) and report i18n.

## License

[MIT](LICENSE).
