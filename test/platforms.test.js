// Tests de los 4 adapters de plataforma contra fixtures REALES (capturadas de
// tiendas en producción — ver fixtures/README.md). Los valores esperados están
// anclados a esos datos: si un refactor cambia el parseo, estos tests lo cantan.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const FIX = path.join(__dirname, "fixtures");
const LIB = path.join(__dirname, "..", "scripts", "lib");

const tiendanube = require(path.join(LIB, "platforms", "tiendanube"));
const shopify = require(path.join(LIB, "platforms", "shopify"));
const woocommerce = require(path.join(LIB, "platforms", "woocommerce"));
const generic = require(path.join(LIB, "platforms", "generic"));
const { sniffPlatform, brandFromHtml } = require(path.join(LIB, "detect"));

// ---------- Tienda Nube (ficha real de twohip.store, ago 2026) ----------

const tnHtml = fs.readFileSync(path.join(FIX, "tiendanube-product.html"), "utf8");
const tnUrl = "https://www.twohip.store/productos/2-mystery-box-emerald-diamond-1c0kv/";
const tnBase = "https://www.twohip.store";

test("TN: parseProduct ancla los valores de la ficha real", () => {
  const p = tiendanube.parseProduct(tnHtml, tnUrl, tnBase);
  assert.strictEqual(p.name, "2 Mystery Box - (Emerald/Diamond)");
  // gotcha real: price del objeto producto viene en centavos; acá ya normalizado a pesos
  assert.strictEqual(p.price, 135000);
  assert.strictEqual(p.stockTotal, 0);
  assert.strictEqual(p.soldQty, 0);
  assert.strictEqual(p.available, false);
  assert.strictEqual(p.variants.length, 80);
  // en la data real algunas variantes traen stock null (TN lo permite): se respeta
  assert.ok(p.variants.every((v) => v.stock === null || typeof v.stock === "number"));
  assert.match(p.priceShort, /^\$135\.000/);
});

test("TN: sniff detecta señales de la plataforma", () => {
  assert.ok(tiendanube.sniff(tnHtml) || tiendanube.sniff('<script>var LS = window.LS = {};</script>'));
  assert.ok(tiendanube.sniff('<img src="https://d123.mitiendanube.com/x.jpg">'));
  assert.ok(!tiendanube.sniff('<html><body>una web cualquiera</body></html>'));
});

test("TN: COUNTRY_SEG filtra prefijos de país del sitemap", () => {
  const seg = tiendanube.COUNTRY_SEG;
  assert.ok(seg.test("/mx/productos/remera/"));
  assert.ok(seg.test("/br/productos/remera/"));
  assert.ok(!seg.test("/productos/remera-mx/"));
});

// ---------- Shopify (products.json real de allbirds.com, ago 2026) ----------

const shData = JSON.parse(fs.readFileSync(path.join(FIX, "shopify-products.json"), "utf8"));
const shBase = "https://www.allbirds.com";

test("Shopify: normalizeProduct ancla los valores del products.json real", () => {
  const p = shopify.normalizeProduct(shData.products[0], shBase);
  assert.strictEqual(p.id, "7199699927120");
  assert.strictEqual(p.name, "Men's Strider - Medium Grey (Blizzard Sole)");
  assert.strictEqual(p.brand, "Allbirds");
  assert.strictEqual(p.stockTotal, null); // Shopify no publica stock numérico
  assert.strictEqual(p.soldQty, null);
  assert.strictEqual(p.url, shBase + "/products/mens-strider-medium-grey");
  // variante real: price 91.00 con compare_at 130.00 → está en promo
  const v = p.variants[0];
  assert.strictEqual(v.size, "8");
  assert.strictEqual(v.sku, "A11718M080");
  assert.strictEqual(v.promoShort, "$91");
  assert.strictEqual(v.compareShort, "$130");
  assert.strictEqual(p.price, 91);
  assert.strictEqual(p.sizeOptionName, "Size");
});

test("Shopify: sniff y currencyFromHtml", () => {
  assert.ok(shopify.sniff('<script src="https://cdn.shopify.com/x.js"></script>'));
  assert.ok(shopify.sniff("Shopify.shop = 'x.myshopify.com';"));
  assert.ok(!shopify.sniff("<html>nada</html>"));
  assert.strictEqual(
    shopify.currencyFromHtml('Shopify.currency = {"active":"USD","rate":"1.0"};'),
    "USD"
  );
});

// ---------- WooCommerce (Store API real de barefootbuttons.com, ago 2026) ----------

const wooData = JSON.parse(fs.readFileSync(path.join(FIX, "woocommerce-products.json"), "utf8"));

test("Woo: normalizeProduct ancla los valores de la Store API real", () => {
  const p = woocommerce.normalizeProduct(wooData[0], "https://barefootbuttons.com");
  assert.strictEqual(p.id, "1475");
  assert.strictEqual(p.name, "Replacement Set Screw and Allen Wrench Kit");
  // gotcha: la Store API da precios en unidades menores ("195" + minor_unit 2 = 1.95)
  assert.strictEqual(p.price, 1.95);
  assert.strictEqual(p.available, true);
  assert.strictEqual(p.stockTotal, null);
  assert.deepStrictEqual(p.crumbs, ["Accessories"]);
  assert.strictEqual(p.sizeOptionName, "Set Screw Size");
});

test("Woo: sniff detecta señales de WooCommerce", () => {
  assert.ok(woocommerce.sniff('<link href="/wp-content/plugins/woocommerce/style.css">'));
  assert.ok(woocommerce.sniff('<body class="archive woocommerce-page">'));
  assert.ok(!woocommerce.sniff("<html>nada</html>"));
});

// ---------- Genérico (página real de fravega.com — VTEX, ago 2026) ----------

const genHtml = fs.readFileSync(path.join(FIX, "generic-product.html"), "utf8");
const genUrl =
  "https://www.fravega.com/p/10-correas-elasticas-butifacion-para-apple-watch-22961531";

test("genérico: parseProduct ancla los valores del JSON-LD real", () => {
  const p = generic.parseProduct(genHtml, genUrl);
  assert.match(p.name, /^10 Correas Elasticas Butifacion/);
  assert.strictEqual(p.price, 89490);
  assert.strictEqual(p.currency, "ARS");
  assert.strictEqual(p.stockTotal, null);
  assert.strictEqual(p.available, true);
});

test("genérico: página sin señales de producto devuelve null", () => {
  assert.strictEqual(generic.parseProduct("<html><body>un blog</body></html>", "https://x.com/post"), null);
});

test("genérico: PRODUCT_PATH matchea patrones comunes de URL de producto", () => {
  const re = generic.PRODUCT_PATH;
  assert.ok(re.test("/products/remera-negra"));
  assert.ok(re.test("/producto/zapatilla"));
  assert.ok(re.test("/item/123-mesa"));
  assert.ok(re.test("/10-correas/p")); // estilo VTEX
  assert.ok(re.test("/zapatilla-runner-p-482910")); // estilo Falabella
  assert.ok(!re.test("/nosotros"));
  assert.ok(!re.test("/blog/como-elegir-talle"));
});

// ---------- Detección de plataforma ----------

test("detect: sniffPlatform elige la plataforma correcta por el HTML", () => {
  assert.strictEqual(sniffPlatform(tnHtml)?.id, "tiendanube");
  assert.strictEqual(sniffPlatform('<script src="https://cdn.shopify.com/a.js"></script>')?.id, "shopify");
  assert.strictEqual(sniffPlatform('<link href="/wp-content/plugins/woocommerce/a.css">')?.id, "woocommerce");
  assert.strictEqual(sniffPlatform("<html>nada</html>"), null);
});

test("detect: brandFromHtml maneja títulos con tagline y og:site_name", () => {
  assert.strictEqual(
    brandFromHtml("<title>Frávega: Electrodomésticos, Tecnología y Artículos para el Hogar</title>", "https://www.fravega.com"),
    "Frávega"
  );
  assert.strictEqual(
    brandFromHtml('<meta property="og:site_name" content="TwoHip"><title>Inicio - TwoHip</title>', "https://www.twohip.store"),
    "TwoHip"
  );
  assert.strictEqual(
    brandFromHtml("<title>Remera Oversize - Comprar en TwoHip</title>", "https://www.twohip.store"),
    "TwoHip"
  );
});
