#!/usr/bin/env node
// scrape.js — scrapea el catálogo público de una tienda online y genera el
// reporte PDF + HTML (con dataset embebido para la comparación posterior).
// Detecta la plataforma automáticamente: Tienda Nube, Shopify, WooCommerce o
// genérica (datos estructurados JSON-LD / Open Graph).
//
// Uso:  node scripts/scrape.js <url> [--out DIR] [--fresh] [--limit N] [--html-only] [--json]
//   --out DIR    carpeta de salida (default: ./output)
//   --fresh      ignora el cache local y vuelve a bajar todo
//   --limit N    procesa solo N productos (prueba rápida)
//   --html-only  no genera PDF (más rápido; el HTML tiene todos los datos)
//   --json       además exporta el dataset crudo a un .json (uso programático)

const fs = require("fs");
const path = require("path");
const { detectStore } = require("./lib/detect");
const woocommerce = require("./lib/platforms/woocommerce");
const generic = require("./lib/platforms/generic");
const { buildCatalogHtml, buildDataset } = require("./lib/templates-catalog");
const { renderPdf } = require("./lib/render");
const { findChrome } = require("./lib/chrome");
const { fmtInt, fmtDateTime, slug, stamp } = require("./lib/format");

const CONCURRENCY = 3; // las tiendas tiran HTTP 429 si las apuramos; scraping respetuoso

function parseArgs(argv) {
  const a = { url: null, out: null, fresh: false, limit: Infinity, htmlOnly: false, json: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--fresh") a.fresh = true;
    else if (v === "--html-only") a.htmlOnly = true;
    else if (v === "--json") a.json = true;
    else if (v === "--out") a.out = argv[++i];
    else if (v === "--limit") a.limit = parseInt(argv[++i], 10);
    else if (!a.url) a.url = v;
  }
  if (a.limit != null && !Number.isFinite(a.limit)) {
    if (a.limit !== Infinity) {
      console.error("--limit necesita un número (ej: --limit 20).");
      process.exit(1);
    }
  }
  return a;
}

// Cache en disco por host: los adapters guardan/leen páginas por clave.
function makeCache(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return {
    get(key) {
      const f = path.join(dir, key);
      try {
        return fs.existsSync(f) ? fs.readFileSync(f, "utf8") : null;
      } catch {
        return null;
      }
    },
    put(key, text) {
      try {
        fs.writeFileSync(path.join(dir, key), text);
      } catch {}
    },
    keys() {
      try {
        return fs.readdirSync(dir);
      } catch {
        return [];
      }
    },
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) {
    console.error(
      "Falta la URL. Uso: node scripts/scrape.js <url> [--out DIR] [--fresh] [--limit N] [--html-only]"
    );
    process.exit(1);
  }
  const OUT = path.resolve(args.out || path.join(process.cwd(), "output"));
  fs.mkdirSync(OUT, { recursive: true });

  console.log("· Detectando tienda y plataforma…");
  const det = await detectStore(args.url);
  let { platform } = det;
  const { base, brand, homeHtml } = det;
  console.log(`  marca: ${brand}  ·  tienda: ${base}  ·  plataforma: ${platform.label}`);

  const cacheDir = path.join(OUT, ".cache", new URL(base).hostname);
  const ctx = {
    limit: args.limit,
    fresh: args.fresh,
    concurrency: CONCURRENCY,
    cache: makeCache(cacheDir),
    homeHtml,
    log: (msg) => console.warn(msg.startsWith("·") || msg.startsWith("⚠") ? msg : msg),
    progress: (msg) => process.stdout.write(`\r  ${msg}`.padEnd(58)),
  };

  let result;
  try {
    result = await platform.getCatalog(base, ctx);
  } catch (e) {
    // WooCommerce con Store API deshabilitada → probamos el flujo genérico.
    if (e.code === "WC_STORE_API_UNAVAILABLE" || (platform === woocommerce && /Store API/.test(e.message))) {
      console.warn(`⚠ ${e.message}`);
      platform = generic;
      result = await generic.getCatalog(base, ctx);
    } else throw e;
  }
  const { products, currency } = result;
  console.log(`\n· ${products.length} productos parseados OK`);

  // La home a veces da un og:site_name de marketing ("Marca Comfortable Shoes…").
  // Si la mayoría del catálogo declara la misma marca/vendor y es más corta, gana.
  let brandFinal = brand;
  const vendorCount = new Map();
  for (const p of products) {
    if (p.brand) vendorCount.set(p.brand, (vendorCount.get(p.brand) || 0) + 1);
  }
  const [topVendor, topCount] = [...vendorCount.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  // exigimos mayoría Y muestra mínima: en retailers multimarca el vendor top no es la tienda
  if (
    topVendor &&
    topCount >= Math.max(5, products.length / 2) &&
    topVendor.length < brand.length
  ) {
    brandFinal = topVendor;
  }
  if (!products.length) throw new Error("No pude parsear ningún producto.");

  // Orden: en stock primero, luego sin stock; dentro de cada grupo, lexicográfico (ASCII).
  products.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
  });

  const scrapedAt = new Date();
  const withStock = products.filter((p) => p.stockTotal != null);
  const prices = products.map((p) => p.minPrice ?? p.price).filter((n) => n != null);
  const maxes = products.map((p) => p.maxPrice ?? p.price).filter((n) => n != null);
  const summary = {
    stockTotal: withStock.length ? withStock.reduce((s, p) => s + p.stockTotal, 0) : null,
    stockKnown: withStock.length,
    minPrice: prices.length ? Math.min(...prices) : null,
    maxPrice: maxes.length ? Math.max(...maxes) : null,
  };

  const meta = {
    brand: brandFinal,
    source: base,
    platform: platform.id,
    platformLabel: platform.label,
    currency: currency || null,
    scrapedAt,
    summary,
    products,
  };
  const html = buildCatalogHtml(meta);

  const baseName = `Scrap_${slug(brandFinal)}_${stamp(scrapedAt)}`;
  const htmlPath = path.join(OUT, baseName + ".html");
  const pdfPath = path.join(OUT, baseName + ".pdf");
  const jsonPath = path.join(OUT, baseName + ".json");
  fs.writeFileSync(htmlPath, html);
  if (args.json) fs.writeFileSync(jsonPath, JSON.stringify(buildDataset(meta), null, 2));

  let pdfDone = false;
  if (!args.htmlOnly) {
    if (!findChrome()) {
      console.warn(
        "⚠ PDF omitido: no encontré Chrome/Chromium (el HTML tiene todos los datos).\n" +
          "  Instalá Chrome o revisá CHROME_PATH si querés el PDF."
      );
    } else {
      console.log("· Generando PDF…");
      await renderPdf(html, pdfPath, {
        footerLeft: `Scrap ${brandFinal} · ${new URL(base).hostname} · ${fmtDateTime(scrapedAt)}`,
      });
      pdfDone = true;
    }
  }

  console.log("\n✓ Listo");
  if (pdfDone) console.log("  PDF:  " + pdfPath);
  console.log("  HTML: " + htmlPath);
  if (args.json) console.log("  JSON: " + jsonPath);
  console.log(
    `  ${products.length} productos · ${
      summary.stockTotal != null ? `stock ${fmtInt(summary.stockTotal)} u. · ` : "stock no público · "
    }${platform.label} · ${fmtDateTime(scrapedAt)}`
  );
}

main().catch((e) => {
  console.error("\nFATAL:", e.message);
  process.exit(1);
});
