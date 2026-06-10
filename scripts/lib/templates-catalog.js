// Template HTML del reporte de catálogo (portada + resumen + grilla + detalle).
// Mantiene el formato del reporte de referencia y embebe un dataset legible por
// máquina (<script id="scrap-data">) para que /scrap compare sea exacto.

const { fmtInt, fmtPrice, esc, truncate, fmtDateTime } = require("./format");

function priceLabel(p) {
  if (p.minPrice != null && p.maxPrice != null && p.minPrice !== p.maxPrice) {
    return `${fmtPrice(p.minPrice)} – ${fmtPrice(p.maxPrice)}`;
  }
  return p.priceShort || fmtPrice(p.price);
}

function categoryLine(p, withInicio) {
  const parts = (p.crumbs && p.crumbs.length ? p.crumbs : ["Inicio"]).slice();
  const full = parts.concat([p.name]);
  return (withInicio ? full : full.filter((x) => x !== "Inicio")).join(" › ");
}

function sizeMiniTable(p) {
  if (!p.variants.length) return "";
  const rows = p.variants
    .map(
      (v) =>
        `<tr class="${v.stock ? "" : "z"}"><td>${esc(v.size)}</td><td class="num">${
          v.stock == null ? "—" : v.stock
        }</td></tr>`
    )
    .join("");
  return `<table class="mini"><thead><tr><th>${esc(
    p.sizeOptionName
  )}</th><th>Stock</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function gridCard(p) {
  const badge = p.available
    ? `<div class="stock">Stock: ${p.stockTotal} u.</div>`
    : `<div class="stock out">SIN STOCK</div>`;
  return `<div class="card">
    <div class="thumb">${p.mainImage ? `<img src="${esc(p.mainImage)}">` : ""}</div>
    <div class="name">${esc(p.name)}</div>
    <div class="price">${esc(priceLabel(p))}</div>
    ${badge}
    ${sizeMiniTable(p)}
    <div class="meta">${p.brand ? `<b>Marca:</b> ${esc(p.brand)}<br>` : ""}<b>Categoría:</b> ${esc(
    categoryLine(p, false)
  )}<br><b>ID:</b> ${esc(p.id)}</div>
    <div class="desc">${esc(truncate(p.description, 150))}</div>
  </div>`;
}

function variantRows(p) {
  return p.variants
    .map((v) => {
      const out = !v.stock;
      return `<tr class="${out ? "z" : ""}">
        <td>${esc(v.size)}</td>
        <td>${v.sku ? esc(v.sku) : "—"}</td>
        <td class="num">${v.stock == null ? "—" : v.stock}</td>
        <td class="disp">${v.available ? '<span class="ok">✓</span>' : '<span class="no">✗</span>'}</td>
        <td>${esc(v.priceShort || fmtPrice(p.price))}</td>
        <td>${v.promoShort ? esc(v.promoShort) : "—"}</td>
        <td>${v.compareShort ? esc(v.compareShort) : "—"}</td>
      </tr>`;
    })
    .join("");
}

function detailBlock(p) {
  const badge = p.available
    ? `<div class="d-stock">Stock: ${p.stockTotal} u.</div>`
    : `<div class="d-stock out">SIN STOCK</div>`;
  const soldRow = p.soldQty != null ? `<tr><td class="k">Vendidas</td><td>${p.soldQty} u.</td></tr>` : "";
  return `<section class="detail">
    <div class="d-head">
      <div class="d-img">${p.mainImage ? `<img src="${esc(p.mainImage)}">` : ""}</div>
      <div class="d-info">
        <h3>${esc(p.name)}</h3>
        <div class="price big">${esc(priceLabel(p))}</div>
        ${badge}
        <table class="kv">
          <tr><td class="k">ID producto</td><td>${esc(p.id)}</td></tr>
          <tr><td class="k">Marca</td><td>${esc(p.brand || "—")}</td></tr>
          <tr><td class="k">URL</td><td>${esc(p.url)}</td></tr>
          <tr><td class="k">Categoría</td><td>${esc(categoryLine(p, true))}</td></tr>
          <tr><td class="k">Variantes</td><td>${p.variants.length} (stock total: ${p.stockTotal} u.)</td></tr>
          ${soldRow}
          <tr><td class="k">SEO title</td><td>${esc(p.seoTitle || "—")}</td></tr>
          <tr><td class="k">Meta description</td><td>${esc(truncate(p.metaDescription, 90))}</td></tr>
        </table>
      </div>
    </div>
    <div class="d-sec">Descripción</div>
    <p class="d-desc">${esc(p.description || "—")}</p>
    <div class="d-sec">Variantes y stock</div>
    <table class="vtable">
      <thead><tr><th>${esc(
        p.sizeOptionName
      )}</th><th>SKU</th><th>Stock</th><th>Disp.</th><th>Precio</th><th>Promo</th><th>Compare-at</th></tr></thead>
      <tbody>${variantRows(p)}</tbody>
    </table>
    ${
      p.payDiscount
        ? `<div class="paynote"><b>Precio con descuento por pago:</b> ${esc(
            p.payDiscount
          )} (transferencia / efectivo)</div>`
        : ""
    }
  </section>`;
}

// Dataset compacto embebido para la comparación (sin descripciones ni imágenes).
function buildDataset(meta) {
  return {
    skill: "scrap",
    version: "1.0.0",
    platform: "tiendanube",
    brand: meta.brand,
    source: meta.source,
    scrapedAt: meta.scrapedAt.toISOString(),
    summary: meta.summary,
    products: meta.products.map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand,
      price: p.price,
      stock: p.stockTotal,
      soldQty: p.soldQty,
      available: p.available,
      variants: p.variants.map((v) => ({ size: v.size, stock: v.stock, sku: v.sku })),
    })),
  };
}

function buildCatalogHtml(meta) {
  const products = meta.products;
  const inStock = products.filter((p) => p.available).length;
  const grid = products.map(gridCard).join("\n");
  const details = products.map(detailBlock).join("\n");
  const dataset = buildDataset(meta);

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<script type="application/json" id="scrap-data">${JSON.stringify(dataset)}</script>
<style>
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; font-size: 12px; }
  h2 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #777; margin: 0 0 18px; font-size: 12px; }
  .cover { background: #111; color: #fff; padding: 60px 48px 40px; }
  .cover h1 { font-size: 46px; margin: 0 0 12px; letter-spacing: -1px; }
  .cover .c1 { color: #cfcfcf; font-size: 16px; margin: 0 0 6px; }
  .cover .c2 { color: #9a9a9a; font-size: 13px; }
  .wrap { padding: 32px 48px; }
  table.summary { width: 100%; border-collapse: collapse; margin: 6px 0 16px; }
  table.summary td { padding: 9px 4px; border-bottom: 1px solid #eee; }
  table.summary td.k { color: #555; font-weight: 700; width: 230px; }
  .fields { color: #444; font-size: 12px; line-height: 1.5; }
  .fields b { color: #1a1a1a; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 22px 20px; }
  .card { break-inside: avoid; border-top: 1px solid #eaeaea; padding-top: 14px; }
  .thumb { background: #f4f4f5; aspect-ratio: 1/1; display: flex; align-items: center; justify-content: center; overflow: hidden; margin-bottom: 10px; }
  .thumb img { width: 100%; height: 100%; object-fit: contain; }
  .card .name { font-weight: 700; font-size: 13px; margin-bottom: 2px; }
  .price { color: #c8202b; font-weight: 700; font-size: 16px; margin-bottom: 2px; }
  .price.big { font-size: 22px; margin: 4px 0 6px; }
  .stock { color: #0e7c66; font-weight: 700; font-size: 12px; margin-bottom: 8px; }
  .stock.out, .d-stock.out { color: #c8202b; }
  .d-stock { color: #0e7c66; font-weight: 700; font-size: 12px; margin: 0 0 10px; }
  table.mini { border-collapse: collapse; margin: 0 0 10px; min-width: 130px; }
  table.mini th { background: #111; color: #fff; font-size: 10px; text-align: left; padding: 3px 14px 3px 8px; font-weight: 600; }
  table.mini td { border: 1px solid #ececec; padding: 2px 8px; font-size: 11px; }
  table.mini td.num { font-weight: 700; color: #0e7c66; }
  table.mini tr.z td, table.mini tr.z td.num { color: #c2c2c2; }
  .meta { font-size: 11px; color: #555; line-height: 1.5; margin-bottom: 6px; }
  .meta b { color: #222; }
  .desc { font-size: 10.5px; color: #888; font-style: italic; line-height: 1.45; }
  .detail { break-inside: avoid; border-bottom: 1px solid #e6e6e6; padding: 18px 0 22px; }
  .d-head { display: flex; gap: 26px; }
  .d-img { width: 250px; flex: none; background: #f4f4f5; aspect-ratio: 1/1; display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .d-img img { width: 100%; height: 100%; object-fit: contain; }
  .d-info { flex: 1; }
  .d-info h3 { font-size: 26px; margin: 0; }
  table.kv { border-collapse: collapse; width: 100%; margin-top: 6px; }
  table.kv td { padding: 6px 6px; border-bottom: 1px solid #f0f0f0; vertical-align: top; font-size: 12px; }
  table.kv td.k { color: #666; font-weight: 600; width: 130px; }
  .d-sec { font-weight: 700; font-size: 14px; margin: 18px 0 6px; }
  .d-desc { font-size: 12px; color: #333; line-height: 1.5; margin: 0 0 4px; }
  table.vtable { border-collapse: collapse; width: 100%; }
  table.vtable th { background: #111; color: #fff; font-size: 11px; text-align: left; padding: 7px 10px; font-weight: 600; }
  table.vtable td { border-bottom: 1px solid #eee; padding: 7px 10px; font-size: 12px; }
  table.vtable td.num { font-weight: 700; color: #0e7c66; }
  table.vtable tr.z td { background: #fdecec; color: #b9b9b9; }
  table.vtable .disp .ok { color: #1a8f3c; }
  table.vtable .disp .no { color: #c8202b; }
  .paynote { color: #666; font-size: 11px; margin-top: 8px; }
  .section-break { break-before: page; }
</style></head><body>
  <div class="cover">
    <h1>Scrap ${esc(meta.brand)}</h1>
    <div class="c1">Catálogo scrapeado desde ${esc(new URL(meta.source).hostname)}</div>
    <div class="c2">${products.length} productos · stock total ${fmtInt(
    meta.summary.stockTotal
  )} u. · rango ${fmtPrice(meta.summary.minPrice)}–${fmtPrice(meta.summary.maxPrice)}</div>
  </div>
  <div class="wrap">
    <h2>Resumen</h2>
    <table class="summary">
      <tr><td class="k">Productos scrapeados</td><td>${products.length}</td></tr>
      <tr><td class="k">Stock total (unidades)</td><td>${fmtInt(meta.summary.stockTotal)}</td></tr>
      <tr><td class="k">Productos en stock</td><td>${inStock}</td></tr>
      <tr><td class="k">Productos sin stock</td><td>${products.length - inStock}</td></tr>
      <tr><td class="k">Rango de precios</td><td>${fmtPrice(meta.summary.minPrice)} – ${fmtPrice(
    meta.summary.maxPrice
  )}</td></tr>
      <tr><td class="k">Fuente</td><td>${esc(new URL(meta.source).hostname)} (Tienda Nube)</td></tr>
      <tr><td class="k">Fecha y hora del scrap</td><td>${fmtDateTime(meta.scrapedAt)}</td></tr>
    </table>
    <p class="fields"><b>Campos extraídos por producto:</b> ID, nombre, marca, URL,
    breadcrumb (categoría), título SEO, meta description, descripción, imagen principal,
    precio (mínimo y máximo), precio con descuento por pago, precio promocional,
    compare-at price, unidades vendidas, y por cada variante: talle/opciones, SKU, stock,
    disponibilidad, ID interno e imagen.</p>

    <div class="section-break"></div>
    <h2>Grilla de productos</h2>
    <p class="sub">Vista resumida de todos los productos. Detalle ampliado en la sección siguiente.</p>
    <div class="grid">${grid}</div>

    <div class="section-break"></div>
    <h2>Detalle por producto</h2>
    <p class="sub">Ficha completa con tabla de variantes, stock por talle, precios y SEO.</p>
    ${details}
  </div>
</body></html>`;
}

module.exports = { buildCatalogHtml };
