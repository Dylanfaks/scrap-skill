#!/usr/bin/env node
// compare.js — compara 2+ datasets de scrap de la misma marca (ordenados por su
// fecha/hora) y estima ventas por caída de stock, generando un reporte PDF + HTML.
//
// Uso:  node scripts/compare.js <data1.json> <data2.json> [...] [--out DIR]
//
// Cada JSON debe tener: { brand, scrapedAt (ISO), products:[{id,name,price,stock,soldQty?}] }.
// Es el mismo objeto que la skill embebe en cada HTML de catálogo (<script id="scrap-data">).

const fs = require("fs");
const path = require("path");
const { buildSalesHtml } = require("./lib/templates-sales");
const { renderPdf } = require("./lib/render");
const { slug, stamp, fmtDateTime } = require("./lib/format");

const DAY = 86400000;

function parseArgs(argv) {
  const files = [];
  let out = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") out = argv[++i];
    else files.push(argv[i]);
  }
  return { files, out };
}

function loadDataset(file) {
  const d = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!d.scrapedAt) throw new Error(`${path.basename(file)} no tiene "scrapedAt" (fecha del scrap).`);
  if (!Array.isArray(d.products)) throw new Error(`${path.basename(file)} no tiene "products".`);
  return {
    brand: d.brand || "Marca",
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
      if (!firstStock.has(id)) firstStock.set(id, p.stock);
      lastStock.set(id, p.stock);
    }
  }

  const soldById = new Map(); // unidades vendidas acumuladas en el span
  const revById = new Map(); // facturación acumulada (a precio del inicio de cada período)
  const restockById = new Map(); // unidades que reentraron (reposición)
  const periods = [];
  let totalSold = 0;
  let totalRev = 0;

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
      const delta = (pa.stock || 0) - (pb.stock || 0);
      if (delta > 0) {
        const rev = delta * (pa.price || 0);
        pSold += delta;
        pRev += rev;
        soldById.set(id, (soldById.get(id) || 0) + delta);
        revById.set(id, (revById.get(id) || 0) + rev);
      } else if (delta < 0) {
        restockById.set(id, (restockById.get(id) || 0) - delta);
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
      fromStock: firstStock.get(id) ?? 0,
      toStock: lastStock.get(id) ?? 0,
    }))
    .sort((a, b) => b.vendidas - a.vendidas);

  const topRevenue = [...topSold].sort((a, b) => b.revenue - a.revenue);

  const reposiciones = [...restockById.entries()]
    .map(([id, restock]) => ({ name: nameById.get(id) || id, restock }))
    .sort((a, b) => b.restock - a.restock);

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

  return {
    brand: last.brand,
    generatedAt: new Date(),
    firstAt: first.date,
    lastAt: last.date,
    totalDays: Math.max(1, Math.round(totalDaysExact)),
    nScraps: datasets.length,
    productsActivos: last.products.length,
    productsBaja: [...first.byId.keys()].filter((id) => !last.byId.has(id)).length,
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
    periods,
    histU,
    histTop,
  };
}

async function main() {
  const { files, out } = parseArgs(process.argv.slice(2));
  if (files.length < 2) {
    console.error("Necesito al menos 2 datasets. Uso: node scripts/compare.js <d1.json> <d2.json> [...]");
    process.exit(1);
  }
  const OUT = path.resolve(out || path.join(process.cwd(), "output"));
  fs.mkdirSync(OUT, { recursive: true });

  const datasets = files.map(loadDataset);
  const brands = new Set(datasets.map((d) => d.brand.toLowerCase().trim()));
  if (brands.size > 1) {
    console.warn("⚠ Los scraps parecen de marcas distintas:", [...new Set(datasets.map((d) => d.brand))].join(", "));
  }

  const cmp = compare(datasets);
  const html = buildSalesHtml(cmp);

  const baseName = `Reporte_Ventas_${slug(cmp.brand)}_${stamp(cmp.generatedAt)}`;
  const htmlPath = path.join(OUT, baseName + ".html");
  const pdfPath = path.join(OUT, baseName + ".pdf");
  fs.writeFileSync(htmlPath, html);

  console.log("· Generando reporte de ventas…");
  await renderPdf(html, pdfPath, { footerLeft: `Reporte de ventas · ${cmp.brand} · estimación · ${fmtDateTime(cmp.generatedAt)}` });

  console.log("\n✓ Listo");
  console.log("  PDF:  " + pdfPath);
  console.log("  HTML: " + htmlPath);
  console.log(
    `  ${cmp.nScraps} scraps · ${cmp.firstAt.toLocaleDateString("es-AR")} → ${cmp.lastAt.toLocaleDateString(
      "es-AR"
    )} · ${cmp.total.sold} u. estimadas`
  );
}

main().catch((e) => {
  console.error("\nFATAL:", e.message);
  process.exit(1);
});
