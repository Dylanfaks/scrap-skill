#!/usr/bin/env node
// compare.js — compara 2+ datasets de scrap de la misma marca (ordenados por su
// fecha/hora) y estima ventas, generando un reporte PDF + HTML.
//
// Uso:  node scripts/compare.js <scrap1.json|.html> <scrap2.json|.html> [...] [--out DIR] [--html-only]
//
// Acepta datasets JSON o directamente los HTML de catálogo que genera scrape.js
// (extrae solo el dataset embebido <script id="scrap-data">).
// Cada dataset tiene: { brand, scrapedAt (ISO), products:[{id,name,price,stock,soldQty?,available?}] }.
//
// Señales, de mejor a peor (se usa la mejor disponible por producto):
//  1. delta de soldQty (Tienda Nube): ventas exactas del período, capta reposiciones.
//  2. caída de stock numérico: piso de ventas (no capta reposiciones no vistas).
//  3. transición de disponibilidad (Shopify/Woo/genérico): solo detecta agotados.

const fs = require("fs");
const path = require("path");
const { buildSalesHtml } = require("./lib/templates-sales");
const { renderPdf } = require("./lib/render");
const { findChrome } = require("./lib/chrome");
const { slug, stamp, fmtDateTime } = require("./lib/format");

const DAY = 86400000;

function parseArgs(argv) {
  const files = [];
  let out = null;
  let htmlOnly = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out = argv[++i];
    else if (argv[i] === "--html-only") htmlOnly = true;
    else files.push(argv[i]);
  }
  return { files, out, htmlOnly };
}

// Valida y carga un dataset. Acumula TODOS los problemas del archivo antes de
// reportar, para no obligar a corregir de a un error por corrida.
// Dataset embebido en los HTML de catálogo que genera scrape.js.
function datasetFromHtml(text) {
  const m = text.match(/<script type="application\/json" id="scrap-data">([\s\S]*?)<\/script>/);
  return m ? m[1] : null;
}

function loadDataset(file, errors) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf8");
  } catch (e) {
    errors.push(`${path.basename(file)}: no pude leerlo (${e.message})`);
    return null;
  }
  if (/\.html?$/i.test(file) || raw.trimStart().startsWith("<")) {
    const embedded = datasetFromHtml(raw);
    if (!embedded) {
      errors.push(
        `${path.basename(file)}: es HTML pero no trae el dataset embebido (id="scrap-data"). ` +
          "Pasame el HTML de catálogo que genera scrape.js (no el reporte de ventas)."
      );
      return null;
    }
    raw = embedded;
  }
  let d;
  try {
    d = JSON.parse(raw);
  } catch (e) {
    errors.push(`${path.basename(file)}: no es JSON válido (${e.message})`);
    return null;
  }
  const errs = [];
  if (!d.scrapedAt) errs.push('no tiene "scrapedAt" (fecha del scrap)');
  else if (isNaN(new Date(d.scrapedAt).getTime())) errs.push(`"scrapedAt" inválida: ${d.scrapedAt}`);
  if (!Array.isArray(d.products)) errs.push('no tiene "products" (lista de productos)');
  else if (!d.products.length) errs.push('"products" está vacío');
  else {
    const bad = d.products.filter((p) => p == null || p.id == null).length;
    if (bad) errs.push(`${bad} producto(s) sin "id"`);
  }
  if (errs.length) {
    errors.push(`${path.basename(file)}: ${errs.join("; ")}`);
    return null;
  }
  return {
    brand: d.brand || "Marca",
    platform: d.platform || null,
    currency: d.currency || null,
    date: new Date(d.scrapedAt),
    products: d.products,
    byId: new Map(d.products.map((p) => [String(p.id), p])),
  };
}

function compare(datasets) {
  datasets.sort((a, b) => a.date - b.date);
  const first = datasets[0];
  const last = datasets[datasets.length - 1];

  // nombre y precio "más reciente" por id (datasets posteriores pisan a los previos)
  const nameById = new Map();
  for (const d of datasets) for (const p of d.products) nameById.set(String(p.id), p.name);

  // primer y último stock observado por id (a lo largo de todo el span)
  const firstStock = new Map();
  const lastStock = new Map();
  for (const d of datasets) {
    for (const p of d.products) {
      const id = String(p.id);
      if (!firstStock.has(id) && p.stock != null) firstStock.set(id, p.stock);
      if (p.stock != null) lastStock.set(id, p.stock);
    }
  }

  const soldById = new Map(); // unidades vendidas acumuladas en el span
  const revById = new Map(); // facturación acumulada (a precio del inicio de cada período)
  const restockById = new Map(); // unidades que reentraron (reposición detectada)
  const periods = [];
  let totalSold = 0;
  let totalRev = 0;
  let usedSoldQty = false;

  for (let i = 0; i + 1 < datasets.length; i++) {
    const A = datasets[i];
    const B = datasets[i + 1];
    const daysExact = Math.max((B.date - A.date) / DAY, 0.04);
    let pSold = 0;
    let pRev = 0;
    for (const pb of B.products) {
      const id = String(pb.id);
      const pa = A.byId.get(id);
      if (!pa) continue; // apareció en este período (reactivado/nuevo); se cuenta aparte

      const soldDelta =
        pa.soldQty != null && pb.soldQty != null ? Math.max(0, pb.soldQty - pa.soldQty) : null;
      const stockDrop = pa.stock != null && pb.stock != null ? pa.stock - pb.stock : null;

      // mejor señal disponible: sold_qty (exacta) > caída de stock (piso)
      let sold = 0;
      if (soldDelta != null) {
        sold = Math.max(soldDelta, Math.max(stockDrop ?? 0, 0));
        if (soldDelta > 0) usedSoldQty = true;
      } else if (stockDrop != null && stockDrop > 0) {
        sold = stockDrop;
      }

      // reposición: el stock cayó menos de lo que se vendió (o directamente subió)
      if (soldDelta != null && stockDrop != null && soldDelta - stockDrop > 0) {
        restockById.set(id, (restockById.get(id) || 0) + (soldDelta - stockDrop));
      } else if (stockDrop != null && stockDrop < 0) {
        restockById.set(id, (restockById.get(id) || 0) - stockDrop);
      }

      if (sold > 0) {
        const rev = sold * (pa.price || 0);
        pSold += sold;
        pRev += rev;
        soldById.set(id, (soldById.get(id) || 0) + sold);
        revById.set(id, (revById.get(id) || 0) + rev);
      }
    }
    totalSold += pSold;
    totalRev += pRev;
    periods.push({
      fromAt: A.date,
      toAt: B.date,
      days: Math.max(1, Math.round(daysExact)),
      sold: pSold,
      revenueList: pRev,
      perDay: pSold / Math.max(daysExact, 0.5),
    });
  }

  const totalDaysExact = Math.max((last.date - first.date) / DAY, 0.5);

  const topSold = [...soldById.entries()]
    .map(([id, vendidas]) => ({
      name: nameById.get(id) || id,
      vendidas,
      revenue: revById.get(id) || 0,
      fromStock: firstStock.get(id) ?? null,
      toStock: lastStock.get(id) ?? null,
    }))
    .sort((a, b) => b.vendidas - a.vendidas);

  const topRevenue = [...topSold].sort((a, b) => b.revenue - a.revenue);

  const reposiciones = [...restockById.entries()]
    .map(([id, restock]) => ({ name: nameById.get(id) || id, restock }))
    .sort((a, b) => b.restock - a.restock);

  // transiciones de disponibilidad (la única señal en plataformas sin stock numérico)
  const agotados = [];
  const reaparecidos = [];
  for (const pl of last.products) {
    const id = String(pl.id);
    const pf = first.byId.get(id);
    if (!pf) continue;
    const avF = pf.available ?? (pf.stock != null ? pf.stock > 0 : null);
    const avL = pl.available ?? (pl.stock != null ? pl.stock > 0 : null);
    if (avF === true && avL === false) agotados.push({ name: pl.name });
    else if (avF === false && avL === true) reaparecidos.push({ name: pl.name });
  }

  // reactivados/nuevos: en el último scrap pero no en el primero
  const nuevos = last.products
    .filter((p) => !first.byId.has(String(p.id)))
    .map((p) => ({ name: p.name, soldQty: p.soldQty ?? null, stock: p.stock ?? 0 }))
    .sort((a, b) => (b.soldQty || 0) - (a.soldQty || 0));

  const histU = last.products.reduce((a, p) => a + (p.soldQty || 0), 0);
  const histTop = [...last.products]
    .filter((p) => p.soldQty != null)
    .sort((a, b) => (b.soldQty || 0) - (a.soldQty || 0))
    .slice(0, 8)
    .map((p) => ({ name: p.name, soldQty: p.soldQty }));

  const ticket = totalSold ? totalRev / totalSold : 0;

  // cobertura de señal: cuántos productos del último scrap tienen datos numéricos
  const stockKnown = last.products.filter((p) => p.stock != null).length;

  return {
    brand: last.brand,
    platform: last.platform,
    currency: last.currency,
    generatedAt: new Date(),
    firstAt: first.date,
    lastAt: last.date,
    totalDays: Math.max(1, Math.round(totalDaysExact)),
    nScraps: datasets.length,
    productsActivos: last.products.length,
    productsBaja: [...first.byId.keys()].filter((id) => !last.byId.has(id)).length,
    stockKnown,
    usedSoldQty,
    availabilityOnly: stockKnown === 0 && !usedSoldQty,
    total: {
      sold: totalSold,
      revenueList: totalRev,
      revenueTransfer: Math.round(totalRev * 0.9),
      ticket,
      perDay: totalSold / totalDaysExact,
      perDayRevenue: totalRev / totalDaysExact,
      monthly: (totalRev * 30) / totalDaysExact,
      topSold,
      topRevenue,
      reposiciones,
      nuevos,
    },
    agotados,
    reaparecidos,
    periods,
    histU,
    histTop,
  };
}

async function main() {
  const { files, out, htmlOnly } = parseArgs(process.argv.slice(2));
  if (files.length < 2) {
    console.error(
      "Necesito al menos 2 datasets. Uso: node scripts/compare.js <d1.json> <d2.json> [...]"
    );
    process.exit(1);
  }
  const OUT = path.resolve(out || path.join(process.cwd(), "output"));
  fs.mkdirSync(OUT, { recursive: true });

  const errors = [];
  const datasets = files.map((f) => loadDataset(f, errors)).filter(Boolean);
  if (errors.length) {
    console.error("Datasets con problemas:\n  - " + errors.join("\n  - "));
    if (datasets.length < 2) process.exit(1);
    console.error(`Sigo con los ${datasets.length} datasets válidos.`);
  }

  const brands = new Set(datasets.map((d) => d.brand.toLowerCase().trim()));
  if (brands.size > 1) {
    console.warn(
      "⚠ Los scraps parecen de marcas distintas:",
      [...new Set(datasets.map((d) => d.brand))].join(", ")
    );
  }

  const cmp = compare(datasets);
  const html = buildSalesHtml(cmp);

  const baseName = `Reporte_Ventas_${slug(cmp.brand)}_${stamp(cmp.generatedAt)}`;
  const htmlPath = path.join(OUT, baseName + ".html");
  const pdfPath = path.join(OUT, baseName + ".pdf");
  fs.writeFileSync(htmlPath, html);

  let pdfDone = false;
  if (!htmlOnly) {
    if (!findChrome()) {
      console.warn(
        "⚠ PDF omitido: no encontré Chrome/Chromium (el HTML tiene todos los datos).\n" +
          "  Instalá Chrome o revisá CHROME_PATH si querés el PDF."
      );
    } else {
      console.log("· Generando reporte de ventas…");
      await renderPdf(html, pdfPath, {
        footerLeft: `Reporte de ventas · ${cmp.brand} · estimación · ${fmtDateTime(cmp.generatedAt)}`,
      });
      pdfDone = true;
    }
  }

  console.log("\n✓ Listo");
  if (pdfDone) console.log("  PDF:  " + pdfPath);
  console.log("  HTML: " + htmlPath);
  console.log(
    `  ${cmp.nScraps} scraps · ${cmp.firstAt.toLocaleDateString("es-AR")} → ${cmp.lastAt.toLocaleDateString(
      "es-AR"
    )} · ${
      cmp.availabilityOnly
        ? `${cmp.agotados.length} productos agotados detectados`
        : `${cmp.total.sold} u. estimadas`
    }`
  );
}

if (require.main === module) {
  main().catch((e) => {
    console.error("\nFATAL:", e.message);
    process.exit(1);
  });
}

module.exports = { compare, loadDataset };
