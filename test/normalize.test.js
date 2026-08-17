// Tests de los helpers de parseo/normalización compartidos.
const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const {
  parsePrice,
  extractBalanced,
  decodeEntities,
  jsonLdBlocks,
  metaContent,
  fmtPriceShort,
} = require(path.join(__dirname, "..", "scripts", "lib", "normalize"));

test("parsePrice: precios localizados AR (miles con punto)", () => {
  // el gotcha real: parseFloat("78.600") da 78.6 — acá tiene que dar 78600
  assert.strictEqual(parsePrice("78.600"), 78600);
  assert.strictEqual(parsePrice("135.000"), 135000);
  assert.strictEqual(parsePrice("$ 89.490"), 89490);
});

test("parsePrice: decimales reales se conservan", () => {
  assert.strictEqual(parsePrice("78.600,50"), 78600.5);
  assert.strictEqual(parsePrice("91.00"), 91);
  assert.strictEqual(parsePrice("1,299.00"), 1299);
  assert.strictEqual(parsePrice("9.95"), 9.95);
});

test("parsePrice: números y basura", () => {
  assert.strictEqual(parsePrice(135000), 135000);
  assert.strictEqual(parsePrice(null), null);
  assert.strictEqual(parsePrice(""), null);
  assert.strictEqual(parsePrice("gratis"), null);
});

test("extractBalanced: objetos anidados y llaves dentro de strings", () => {
  const src = 'x = {"a":{"b":"tiene } llave"},"c":[1,2,{"d":"y \\" escape"}]}; resto';
  const out = extractBalanced(src, src.indexOf("{"));
  assert.strictEqual(JSON.parse(out).c[2].d, 'y " escape');
});

test("decodeEntities: entidades comunes y acentos", () => {
  assert.strictEqual(decodeEntities("Camisa &quot;Fit&quot; &amp; Ni&ntilde;o &eacute;xito"), 'Camisa "Fit" & Niño éxito');
});

test("jsonLdBlocks: parsea bloques y @graph", () => {
  const html =
    '<script type="application/ld+json">{"@type":"Product","name":"A"}</script>' +
    '<script type="application/ld+json">{"@graph":[{"@type":"BreadcrumbList"}]}</script>' +
    '<script type="application/ld+json">roto{{{</script>';
  const blocks = jsonLdBlocks(html);
  assert.strictEqual(blocks.length, 2);
  assert.strictEqual(blocks[0].name, "A");
});

test("metaContent: property y name, en cualquier orden de atributos", () => {
  const html =
    '<meta property="og:title" content="Mi producto"/>' +
    '<meta content="ARS" property="product:price:currency">';
  assert.strictEqual(metaContent(html, "og:title"), "Mi producto");
  assert.strictEqual(metaContent(html, "product:price:currency"), "ARS");
});

test("fmtPriceShort: formato es-AR", () => {
  assert.strictEqual(fmtPriceShort(135000), "$135.000");
  assert.strictEqual(fmtPriceShort(null), null);
});
