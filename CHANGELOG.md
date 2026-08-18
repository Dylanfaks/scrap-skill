# Changelog

All notable changes to this skill are documented here.

## [2.2.0] — 2026-08-18

Bilingual reports.

- **`--lang es|en` on `scrape.js` and `compare.js`** — every HTML and PDF report can now be
  generated in Spanish (default) or English. Only interface labels are translated (headers,
  table columns, footnotes); scraped content — product names, brands, descriptions,
  categories — is always kept exactly as the store publishes it, in whatever language that is.
- `compare.js --lang` is independent from the language the input scraps were generated in:
  mix a Spanish catalog scrape with an English sales report, or vice versa.
- New `scripts/lib/i18n.js` dictionary; `format.js`'s locale-aware helpers (`fmtPrice`,
  `fmtDateTime`, etc.) now accept the target language.

## [2.1.0] — 2026-08-17

Standalone-friendly CLI: the scripts now work great outside Claude Code too.

- **`compare.js` accepts HTML reports directly** — pass the catalog HTML files and it
  extracts the embedded dataset itself. JSON datasets still work; mix them freely.
- **`--json` flag on `scrape.js`** — also export the raw dataset (`Scrap_<Brand>_<stamp>.json`)
  for programmatic use.
- **Works without Chrome** — if Chrome/Chromium isn't installed, reports are still
  delivered as HTML; the PDF is skipped with a clear warning instead of failing.
- `CHROME_PATH` is now strict: if set to a path that doesn't exist, the skill says so
  instead of silently falling back to another browser.

## [2.0.0] — 2026-08-16

Multi-platform release.

- **Automatic platform detection** — no flags needed: Tienda Nube, Shopify, WooCommerce,
  or a generic fallback (JSON-LD / Open Graph structured data) for everything else.
- **Shopify adapter** — public `products.json` pagination, prices and availability.
- **WooCommerce adapter** — public Store API (`wp-json/wc/store/v1/products`) with
  sitemap + JSON-LD fallback.
- **Generic adapter** — sitemap discovery plus JSON-LD `Product` / Open Graph parsing.
- **Smarter sales estimation** — uses the best signal available per product:
  `sold_qty` delta (Tienda Nube) > numeric stock drop > availability transitions.
- Multi-currency awareness, per-platform image lightening for small PDFs,
  cache per host, 45-test suite with real fixtures from all four platforms, CI.

## [1.0.0] — 2026-06-10

Initial release.

- Tienda Nube catalog scraper: sitemap discovery, embedded-JS product parsing
  (prices, per-variant stock, `sold_qty`, SEO fields), PDF + HTML reports with an
  embedded machine-readable dataset.
- Sales estimation by stock-drop comparison between two or more snapshots.
- Local page cache, rate-limit backoff, closed-store (password page) fallback.
