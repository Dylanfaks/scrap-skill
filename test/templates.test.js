// Tests de humo de los templates HTML: dataset embebido, stock desconocido y
// variantes ausentes no deben romper el reporte ni imprimir "null".
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const LIB = path.join(__dirname, "..", "scripts", "lib");
const { buildCatalogHtml } = require(path.join(LIB, "templates-catalog"));
const { buildSalesHtml } = require(path.join(LIB, "templates-sales"));
const { compare } = require(path.join(__dirname, "..", "scripts", "compare"));
const { lightenImagesForPdf } = require(path.join(LIB, "render"));

const productoTN = {
  id: "1",
  name: "Remera <Test> & Co",
  brand: "Marca",
  url: "https://x.store/productos/remera/",
  crumbs: ["Remeras"],
  seoTitle: "Remera",
  metaDescription: "desc",
  description: "descripción larga",
  mainImage: "https://d1.mitiendanube.com/foto-1024-1024.webp",
  priceShort: "$1.000",
  price: 1000,
  minPrice: 1000,
  maxPrice: 1000,
  compareShort: null,
  promoShort: null,
  payDiscount: null,
  stockTotal: 5,
  soldQty: 12,
  available: true,
  sizeOptionName: "Talle",
  variants: [{ size: "M", sku: "R1", stock: 5, available: true, priceShort: "$1.000", promoShort: null, compareShort: null, payDiscountShort: null, image: null }],
};

const productoShopify = {
  ...productoTN,
  id: "2",
  name: "Zapa Sin Stock Numérico",
  stockTotal: null,
  soldQty: null,
  variants: [],
  mainImage: "https://cdn.shopify.com/s/files/1/foto.png?v=123",
};

function catalogo(products, platform, platformLabel, stockTotal) {
  return buildCatalogHtml({
    brand: "Marca",
    source: "https://x.store",
    platform,
    platformLabel,
    currency: "ARS",
    scrapedAt: new Date("2026-08-16T12:00:00Z"),
    summary: { stockTotal, stockKnown: stockTotal == null ? 0 : 1, minPrice: 1000, maxPrice: 1000 },
    products,
  });
}

test("catálogo: dataset embebido v2 con plataforma y moneda", () => {
  const html = catalogo([productoTN], "tiendanube", "Tienda Nube", 5);
  const d = JSON.parse(html.match(/id="scrap-data">(.*?)<\/script>/s)[1]);
  assert.strictEqual(d.version, "2.2.0");
  assert.strictEqual(d.platform, "tiendanube");
  assert.strictEqual(d.currency, "ARS");
  assert.strictEqual(d.products[0].stock, 5);
  assert.strictEqual(d.products[0].soldQty, 12);
});

test("catálogo: producto sin stock numérico no imprime null", () => {
  const html = catalogo([productoShopify], "shopify", "Shopify", null);
  assert.ok(!/Stock: null/.test(html));
  assert.ok(!/null u\./.test(html));
  assert.ok(/Disponible/.test(html));
  assert.ok(/no público en esta plataforma/.test(html));
  assert.ok(/Shopify/.test(html));
});

test("catálogo: escapa HTML en nombres", () => {
  const html = catalogo([productoTN], "tiendanube", "Tienda Nube", 5);
  assert.ok(html.includes("Remera &lt;Test&gt; &amp; Co"));
});

test("reporte de ventas TN: unidades, transferencia y sold_qty", () => {
  const mk = (daysFromStart, stock, soldQty) => ({
    brand: "Marca",
    platform: "tiendanube",
    currency: "ARS",
    date: new Date(Date.UTC(2026, 7, 1 + daysFromStart)),
    products: [{ id: 1, name: "A", price: 1000, stock, soldQty, available: stock > 0 }],
    byId: new Map([["1", { id: 1, name: "A", price: 1000, stock, soldQty }]]),
  });
  const cmp = compare([mk(0, 10, 50), mk(7, 6, 54)]);
  const html = buildSalesHtml(cmp);
  assert.ok(/Unidades vendidas/.test(html));
  assert.ok(/transferencia/.test(html));
  assert.ok(/sold_qty/.test(html));
});

test("reporte de ventas availability-only: sin unidades inventadas", () => {
  const mk = (daysFromStart, available) => {
    const products = [{ id: 1, name: "A", price: 90, stock: null, available }];
    return {
      brand: "Marca",
      platform: "shopify",
      currency: "USD",
      date: new Date(Date.UTC(2026, 7, 1 + daysFromStart)),
      products,
      byId: new Map(products.map((p) => [String(p.id), p])),
    };
  };
  const cmp = compare([mk(0, true), mk(5, false)]);
  const html = buildSalesHtml(cmp);
  assert.ok(/no publica stock numérico/.test(html));
  assert.ok(/Se agotaron \(1\)/.test(html));
  assert.ok(!/Más vendidos del período/.test(html));
  assert.ok(!/Tamaño de la marca/.test(html));
});

// --- v2.2: reportes en inglés (solo repo público — Dylan usa siempre español) ---

test("catálogo: lang default (es) no cambia respecto al comportamiento previo", () => {
  const html = catalogo([productoTN], "tiendanube", "Tienda Nube", 5);
  assert.ok(/<html lang="es">/.test(html));
  assert.ok(/Resumen</.test(html));
  assert.ok(/Detalle por producto/.test(html));
  assert.ok(!/Summary</.test(html));
});

test("catálogo: lang=en traduce los labels de la interfaz, no el contenido scrapeado", () => {
  const html = buildCatalogHtml({
    brand: "Marca",
    source: "https://x.store",
    platform: "tiendanube",
    platformLabel: "Tienda Nube",
    currency: "ARS",
    scrapedAt: new Date("2026-08-16T12:00:00Z"),
    summary: { stockTotal: 5, stockKnown: 1, minPrice: 1000, maxPrice: 1000 },
    products: [productoTN],
    lang: "en",
  });
  assert.ok(/<html lang="en">/.test(html));
  assert.ok(/Summary</.test(html));
  assert.ok(/Product detail/.test(html));
  assert.ok(/Product grid/.test(html));
  // el contenido scrapeado (nombre de producto) no se traduce:
  assert.ok(/Remera &lt;Test&gt; &amp; Co/.test(html));
  assert.ok(!/Resumen</.test(html));
});

test("catálogo: lang inválido (typo, no 'en') cae a español por defecto, no revienta", () => {
  const html = buildCatalogHtml({
    brand: "Marca",
    source: "https://x.store",
    platform: "tiendanube",
    platformLabel: "Tienda Nube",
    currency: "ARS",
    scrapedAt: new Date("2026-08-16T12:00:00Z"),
    summary: { stockTotal: 5, stockKnown: 1, minPrice: 1000, maxPrice: 1000 },
    products: [productoTN],
    lang: "fr",
  });
  assert.ok(/<html lang="es">/.test(html));
  assert.ok(/Resumen</.test(html));
});

test("reporte de ventas: lang=en traduce el reporte, el default sigue en español", () => {
  const mk = (daysFromStart, stock, soldQty) => ({
    brand: "Marca",
    platform: "tiendanube",
    currency: "ARS",
    date: new Date(Date.UTC(2026, 7, 1 + daysFromStart)),
    products: [{ id: 1, name: "A", price: 1000, stock, soldQty, available: stock > 0 }],
    byId: new Map([["1", { id: 1, name: "A", price: 1000, stock, soldQty }]]),
  });
  const cmp = compare([mk(0, 10, 50), mk(7, 6, 54)]);

  const htmlEs = buildSalesHtml(cmp);
  assert.ok(/<html lang="es">/.test(htmlEs));
  assert.ok(/Unidades vendidas/.test(htmlEs));

  cmp.lang = "en";
  const htmlEn = buildSalesHtml(cmp);
  assert.ok(/<html lang="en">/.test(htmlEn));
  assert.ok(/Units sold/.test(htmlEn));
  assert.ok(/Method and limits/.test(htmlEn));
  assert.ok(!/Unidades vendidas/.test(htmlEn));
});

test("lightenImagesForPdf: reduce imágenes de los CDNs conocidos", () => {
  const out = lightenImagesForPdf(
    '<img src="https://d1.mitiendanube.com/foto-1024-1024.webp">' +
      '<img src="https://cdn.shopify.com/s/files/1/foto.png?v=123">'
  );
  assert.ok(out.includes("foto-320-320.webp"));
  assert.ok(/cdn\.shopify\.com\/s\/files\/1\/foto\.png\?v=123&(amp;)?width=320/.test(out));
});
