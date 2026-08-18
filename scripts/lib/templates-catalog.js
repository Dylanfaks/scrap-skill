// Template HTML del reporte de catálogo (portada + resumen + grilla + detalle).
// Mantiene el formato del reporte de referencia y embebe un dataset legible por
// máquina (<script id="scrap-data">) para que /scrap compare sea exacto.
// Soporta reportes en español o inglés vía meta.lang ("es" default | "en") —
// solo traduce los labels de la interfaz, nunca el contenido scrapeado.

const { fmtInt, fmtPrice, esc, truncate, fmtDateTime } = require("./format");
const { t } = require("./i18n");

function priceLabel(p, tr, lang) {
  if (p.minPrice != null && p.maxPrice != null && p.minPrice !== p.maxPrice) {
    return `${fmtPrice(p.minPrice, lang)} – ${fmtPrice(p.maxPrice, lang)}`;
  }
  return p.priceShort || fmtPrice(p.price, lang);
}

function categoryLine(p, withHome, tr) {
  const home = tr.htmlLang === "en" ? "Home" : "Inicio";
  const parts = (p.crumbs && p.crumbs.length ? p.crumbs : [home]).slice();
  const full = parts.concat([p.name]);
  return (withHome ? full : full.filter((x) => x !== home)).join(" › ");
}

function sizeMiniTable(p, tr) {
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
  )}</th><th>${tr.stockLabel}</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// Con stock numérico mostramos unidades; sin él (Shopify/Woo/genérico) solo
// disponibilidad, que es lo único que la plataforma hace público.
function stockBadge(p, cls, tr) {
  if (!p.available) return `<div class="${cls} out">${p.stockTotal == null ? tr.soldOut : tr.outOfStock}</div>`;
  if (p.stockTotal == null) return `<div class="${cls}">${tr.available}</div>`;
  return `<div class="${cls}">${tr.stockUnits(p.stockTotal)}</div>`;
}

function gridCard(p, tr, lang) {
  const badge = stockBadge(p, "stock", tr);
  return `<div class="card">
    <div class="thumb">${p.mainImage ? `<img src="${esc(p.mainImage)}">` : ""}</div>
    <div class="name">${esc(p.name)}</div>
    <div class="price">${esc(priceLabel(p, tr, lang))}</div>
    ${badge}
    ${sizeMiniTable(p, tr)}
    <div class="meta">${p.brand ? `<b>${tr.brandField}:</b> ${esc(p.brand)}<br>` : ""}<b>${
    tr.categoryField
  }:</b> ${esc(categoryLine(p, false, tr))}<br><b>${tr.idField}:</b> ${esc(p.id)}</div>
    <div class="desc">${esc(truncate(p.description, 150))}</div>
  </div>`;
}

function variantRows(p, tr, lang) {
  return p.variants
    .map((v) => {
      const out = !v.stock;
      return `<tr class="${out ? "z" : ""}">
        <td>${esc(v.size)}</td>
        <td>${v.sku ? esc(v.sku) : "—"}</td>
        <td class="num">${v.stock == null ? "—" : v.stock}</td>
        <td class="disp">${v.available ? '<span class="ok">✓</span>' : '<span class="no">✗</span>'}</td>
        <td>${esc(v.priceShort || fmtPrice(p.price, lang))}</td>
        <td>${v.promoShort ? esc(v.promoShort) : "—"}</td>
        <td>${v.compareShort ? esc(v.compareShort) : "—"}</td>
      </tr>`;
    })
    .join("");
}

function detailBlock(p, tr, lang) {
  const badge = stockBadge(p, "d-stock", tr);
  const soldRow = p.soldQty != null ? `<tr><td class="k">${tr.sold}</td><td>${p.soldQty} u.</td></tr>` : "";
  return `<section class="detail">
    <div class="d-head">
      <div class="d-img">${p.mainImage ? `<img src="${esc(p.mainImage)}">` : ""}</div>
      <div class="d-info">
        <h3>${esc(p.name)}</h3>
        <div class="price big">${esc(priceLabel(p, tr, lang))}</div>
        ${badge}
        <table class="kv">
          <tr><td class="k">${tr.productId}</td><td>${esc(p.id)}</td></tr>
          <tr><td class="k">${tr.brandField}</td><td>${esc(p.brand || "—")}</td></tr>
          <tr><td class="k">${tr.urlField}</td><td>${esc(p.url)}</td></tr>
          <tr><td class="k">${tr.categoryField}</td><td>${esc(categoryLine(p, true, tr))}</td></tr>
          ${
            p.variants.length
              ? `<tr><td class="k">${tr.variantsField}</td><td>${p.variants.length}${
                  p.stockTotal != null ? tr.stockTotalParen(p.stockTotal) : ""
                }</td></tr>`
              : ""
          }
          ${soldRow}
          <tr><td class="k">${tr.seoTitle}</td><td>${esc(p.seoTitle || "—")}</td></tr>
          <tr><td class="k">${tr.metaDescription}</td><td>${esc(truncate(p.metaDescription, 90))}</td></tr>
        </table>
      </div>
    </div>
    <div class="d-sec">${tr.description}</div>
    <p class="d-desc">${esc(p.description || "—")}</p>
    ${
      p.variants.length
        ? `<div class="d-sec">${tr.variantsAndStock}</div>
    <table class="vtable">
      <thead><tr><th>${esc(p.sizeOptionName)}</th><th>${tr.sku}</th><th>${tr.stockLabel}</th><th>${
            tr.availabilityShort
          }</th><th>${tr.price}</th><th>${tr.promo}</th><th>${tr.compareAt}</th></tr></thead>
      <tbody>${variantRows(p, tr, lang)}</tbody>
    </table>`
        : ""
    }
    ${p.payDiscount ? `<div class="paynote">${tr.payDiscountNote(esc(p.payDiscount))}</div>` : ""}
  </section>`;
}

// Dataset compacto embebido para la comparación (sin descripciones ni imágenes).
// No lleva `lang`: el dataset es datos, no presentación — se compara igual sin
// importar en qué idioma se generó el reporte que lo contiene.
function buildDataset(meta) {
  return {
    skill: "scrap",
    version: "2.2.0",
    platform: meta.platform || "tiendanube",
    brand: meta.brand,
    source: meta.source,
    currency: meta.currency || null,
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
  const lang = meta.lang === "en" ? "en" : "es";
  const tr = t(lang);
  const products = meta.products;
  const inStock = products.filter((p) => p.available).length;
  const grid = products.map((p) => gridCard(p, tr, lang)).join("\n");
  const details = products.map((p) => detailBlock(p, tr, lang)).join("\n");
  const dataset = buildDataset(meta);

  return `<!doctype html><html lang="${tr.htmlLang}"><head><meta charset="utf-8">
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
    <h1>${esc(tr.catalogTitle(meta.brand))}</h1>
    <div class="c1">${esc(tr.scrapedFrom(new URL(meta.source).hostname, meta.platformLabel || "Tienda Nube"))}</div>
    <div class="c2">${esc(tr.productsCount(products.length))}${
    meta.summary.stockTotal != null ? ` · ${esc(tr.stockTotalInline(fmtInt(meta.summary.stockTotal, lang)))}` : ""
  } · ${esc(tr.priceRangeInline(fmtPrice(meta.summary.minPrice, lang), fmtPrice(meta.summary.maxPrice, lang)))}${
    meta.currency && meta.currency !== "ARS" ? " " + esc(meta.currency) : ""
  }</div>
  </div>
  <div class="wrap">
    <h2>${tr.summary}</h2>
    <table class="summary">
      <tr><td class="k">${tr.scrapedProducts}</td><td>${products.length}</td></tr>
      ${
        meta.summary.stockTotal != null
          ? `<tr><td class="k">${tr.stockTotalUnits}</td><td>${fmtInt(meta.summary.stockTotal, lang)}</td></tr>`
          : `<tr><td class="k">${tr.numericStock}</td><td>${tr.numericStockNotPublic}</td></tr>`
      }
      <tr><td class="k">${tr.availableProducts}</td><td>${inStock}</td></tr>
      <tr><td class="k">${tr.outOfStockProducts}</td><td>${products.length - inStock}</td></tr>
      <tr><td class="k">${tr.priceRange}</td><td>${fmtPrice(meta.summary.minPrice, lang)} – ${fmtPrice(
    meta.summary.maxPrice,
    lang
  )}${meta.currency ? " " + esc(meta.currency) : ""}</td></tr>
      <tr><td class="k">${tr.source}</td><td>${esc(new URL(meta.source).hostname)} (${esc(
    meta.platformLabel || "Tienda Nube"
  )})</td></tr>
      <tr><td class="k">${tr.scrapedAt}</td><td>${fmtDateTime(meta.scrapedAt, lang)}</td></tr>
    </table>
    <p class="fields"><b>${tr.fieldsExtracted}</b> ${tr.fieldsExtractedBody}</p>

    <div class="section-break"></div>
    <h2>${tr.productGrid}</h2>
    <p class="sub">${tr.productGridSub}</p>
    <div class="grid">${grid}</div>

    <div class="section-break"></div>
    <h2>${tr.productDetail}</h2>
    <p class="sub">${tr.productDetailSub}</p>
    ${details}
  </div>
</body></html>`;
}

module.exports = { buildCatalogHtml, buildDataset };
