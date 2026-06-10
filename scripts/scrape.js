#!/usr/bin/env node
// scrape.js — scrapea el catálogo de una tienda Tienda Nube y genera el reporte
// PDF + HTML (con dataset embebido para la comparación posterior).
//
// Uso:  node scripts/scrape.js <url> [--out DIR] [--fresh] [--limit N]
//   --out DIR   carpeta de salida (default: ./output)
//   --fresh     ignora el cache local y vuelve a bajar todo
//   --limit N   procesa solo N productos (prueba rápida)

const fs = require("fs");
const path = require("path");
const { detectStore, getProductUrls, fetchText, parseProduct } = require("./lib/tiendanube");
const { buildCatalogHtml } = require("./lib/templates-catalog");
const { renderPdf } = require("./lib/render");
const { fmtInt, fmtDateTime, slug, stamp } = require("./lib/format");

const CONCURRENCY = 3; // Tienda Nube tira HTTP 429 si lo apuramos

function parseArgs(argv) {
  const a = { url: null, out: null, fresh: false, limit: Infinity };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--fresh") a.fresh = true;
    else if (v === "--out") a.out = argv[++i];
    else if (v === "--limit") a.limit = parseInt(argv[++i], 10);
    else if (!a.url) a.url = v;
  }
  return a;
}

async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    console.error("Falta la URL. Uso: node scripts/scrape.js <url> [--out DIR] [--fresh] [--limit N]");
    process.exit(1);
  }
  const OUT = path.resolve(args.out || path.join(process.cwd(), "output"));
  fs.mkdirSync(OUT, { recursive: true });

  console.log("· Detectando tienda…");
  const { base, brand } = await detectStore(args.url);
  console.log(`  marca: ${brand}  ·  tienda: ${base}`);

  const cacheDir = path.join(OUT, ".cache", new URL(base).hostname);
  fs.mkdirSync(cacheDir, { recursive: true });
  const cachedFiles = () =>
    fs.readdirSync(cacheDir).filter((f) => f.endsWith(".html"));

  console.log("· Leyendo sitemap…");
  let urls = [];
  let storeClosed = false;
  try {
    urls = await getProductUrls(base);
  } catch (e) {
    if (e.code === "STORE_CLOSED") storeClosed = true;
    else throw e;
  }

  // Si la tienda está cerrada pero tenemos fichas en cache, regeneramos desde ahí.
  if (!urls.length && !args.fresh && cachedFiles().length) {
    urls = cachedFiles().map((f) => base + "/productos/" + f.replace(/\.html$/, "") + "/");
    console.warn(`⚠ ${storeClosed ? "Tienda cerrada" : "Sitemap vacío"}: regenerando desde ${urls.length} fichas en cache.`);
  }
  if (!urls.length) {
    throw new Error(
      storeClosed
        ? "La tienda está cerrada temporalmente (Tienda Nube /password) y no hay cache previo. Probá cuando reabra."
        : "No encontré productos en el sitemap de esta tienda."
    );
  }
  if (args.limit !== Infinity) urls = urls.slice(0, args.limit);
  console.log(`· ${urls.length} productos a scrapear (concurrencia ${CONCURRENCY})`);

  let done = 0;
  const products = (
    await mapLimit(urls, CONCURRENCY, async (url) => {
      try {
        const key = url.replace(/.*\/productos\//, "").replace(/[^a-z0-9]+/gi, "_") + ".html";
        const file = path.join(cacheDir, key);
        let html;
        if (!args.fresh && fs.existsSync(file)) html = fs.readFileSync(file, "utf8");
        else {
          html = (await fetchText(url)).text;
          fs.writeFileSync(file, html);
        }
        const p = parseProduct(html, url, base);
        process.stdout.write(`\r  ${++done}/${urls.length}  ${p.name.slice(0, 38)}`.padEnd(58));
        return p;
      } catch (err) {
        console.warn(`\n  ! ${url.split("/productos/")[1] || url}: ${err.message}`);
        return null;
      }
    })
  ).filter(Boolean);
  console.log(`\n· ${products.length} productos parseados OK`);
  if (!products.length) throw new Error("No pude parsear ningún producto.");

  // Orden: en stock primero, luego sin stock; dentro de cada grupo, lexicográfico (ASCII).
  products.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

  const scrapedAt = new Date();
  const summary = {
    stockTotal: products.reduce((s, p) => s + (p.stockTotal || 0), 0),
    minPrice: Math.min(...products.map((p) => p.minPrice ?? p.price ?? Infinity)),
    maxPrice: Math.max(...products.map((p) => p.maxPrice ?? p.price ?? 0)),
  };

  const html = buildCatalogHtml({ brand, source: base, scrapedAt, summary, products });

  const baseName = `Scrap_${slug(brand)}_${stamp(scrapedAt)}`;
  const htmlPath = path.join(OUT, baseName + ".html");
  const pdfPath = path.join(OUT, baseName + ".pdf");
  fs.writeFileSync(htmlPath, html);

  console.log("· Generando PDF…");
  await renderPdf(html, pdfPath, { footerLeft: `Scrap ${brand} · ${new URL(base).hostname} · ${fmtDateTime(scrapedAt)}` });

  console.log("\n✓ Listo");
  console.log("  PDF:  " + pdfPath);
  console.log("  HTML: " + htmlPath);
  console.log(
    `  ${products.length} productos · stock ${fmtInt(summary.stockTotal)} u. · ${fmtDateTime(scrapedAt)}`
  );
}

main().catch((e) => {
  console.error("\nFATAL:", e.message);
  process.exit(1);
});
