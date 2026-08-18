---
name: scrap
description: Use when the user runs /scrap with an online store URL to scrape its public catalog into a report (works on Tienda Nube, Shopify, WooCommerce and generic stores with structured data — platform is auto-detected), or /scrap compare to estimate sales from two or more previously generated scrap reports of the same store.
---

# scrap

Scrapes the public catalog of any online store into a **PDF + HTML report**, and compares
scraps from different dates to estimate **sales, revenue and trend**. The platform
(Tienda Nube, Shopify, WooCommerce, or generic structured-data stores) is **detected
automatically** — the user never has to say which one it is.

`{SKILL_DIR}` = this skill's directory (passed when invoked, e.g. `~/.claude/skills/scrap`).
Run the commands **from the user's current directory** (not the skill's) so output lands
in `./output` near them. Reports are generated in Spanish (es-AR formatting).

## Setup (once)

If `{SKILL_DIR}/node_modules/puppeteer-core` doesn't exist, install dependencies:
```bash
npm install --prefix "{SKILL_DIR}" --no-audit --no-fund
```
Requires Node ≥18 and Google Chrome/Chromium (auto-detected on Mac/Windows/Linux;
override with `CHROME_PATH`). Chrome is only needed for the PDF — `--html-only` works without it.

## Choosing the mode

The first argument decides:
- starts with `http`/a domain → **catalog mode** (scrape that store).
- is `compare` → **comparison mode** (uses the attached reports).

## Catalog mode — `/scrap <url>`

```bash
node "{SKILL_DIR}/scripts/scrape.js" "<url>"
```
Generates `./output/Scrap_<Brand>_<date_time>.pdf` + `.html`. Report the real output to
the user: both absolute paths + product/stock summary + **which platform was detected**.

Notes by platform (the script handles this alone; just relay it):
- **Tienda Nube**: full data — numeric stock per variant and `sold_qty` (units sold).
- **Shopify / WooCommerce / generic**: prices and availability, but **no numeric stock**
  (those platforms don't make it public). Sales comparison will be availability-based.
- If the store can't be detected or has no structured data, the script says so clearly.

Useful flags: `--limit N` (quick test), `--fresh` (ignore cache), `--html-only` (skip PDF),
`--json` (also export the raw dataset), `--lang es|en` (report language, default `es` —
only translates interface labels, never product names/descriptions), `--out DIR`. Without
Chrome installed the script still delivers the HTML (it warns and skips the PDF). If the
user asks for the report in English (or their message is in English), pass `--lang en`.

## Comparison mode — `/scrap compare`

The user attaches **2+** reports (PDF or HTML) generated earlier with `/scrap`, from
**the same store**.

**1. Prepare each attached file:**
- **If it's an HTML from this skill:** nothing to do — `compare.js` accepts catalog HTML
  files directly and extracts the embedded dataset itself.
- **If it's a PDF from this skill:** build a JSON dataset by hand: read the cover
  (*"Fecha y hora del scrap"* → `scrapedAt`) and the *"Detalle por producto"* section.
  Per product build `{ "id", "name", "price" (number), "stock" (total or null),
  "soldQty" ("Vendidas" row if present), "available" }`. Save it to
  `./output/.compare/<n>.json`.
- **If it's an old/external PDF without a date:** ask the user for that scrap's date (and time).

**2. Run the comparison** — HTML files and JSON datasets can be mixed freely, and can come
from scraps in either language (the report language is independent from the input):
```bash
node "{SKILL_DIR}/scripts/compare.js" reporte1.html ./output/.compare/2.json [...] --lang en
```
Generates `./output/Reporte_Ventas_<Brand>_<date_time>.pdf` + `.html`. Give the user the
paths + the headline (estimated units and revenue — or, for stores without numeric stock,
which products sold out in the period).

## Rules

- **Always deliver both PDF and HTML** and report absolute paths. The **HTML is the primary
  deliverable** (lightweight, full data, machine-readable dataset embedded); highlight it.
- **Light PDF by default:** `render.js` downsizes images to 320px for the PDF (the HTML keeps
  full quality) so big catalogs don't produce 100+ MB PDFs. Don't raise `PDF_IMG_SIZE`
  unless explicitly asked.
- The comparison is an **estimate from public data** (not the store's real books): with
  numeric stock it's a floor; without it, it only detects sold-out transitions. Say so when
  delivering, as the report itself does.
- More scraps, closer together = better estimates. Suggest scraping every few days.
- Don't invent data: if a PDF has no date, ask; if a store exposes nothing, say so.

## Technical detail

- Platform detection: `scripts/lib/detect.js`. Adapters: `scripts/lib/platforms/*.js`
  (one per platform, same normalized product shape). Sales math: `scripts/compare.js`.
- Local page cache in `./output/.cache/<host>/` — re-runs are fast and a closed Tienda Nube
  store (password page) can regenerate from cache. `--fresh` forces re-download.
- Tests: `npm test` (fixtures with real store data live in `test/fixtures/`).
