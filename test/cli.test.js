// Tests del CLI como lo usaría un usuario (sin red, sin Chrome): argumentos
// inválidos, datasets corruptos y el flujo compare completo con --html-only.
const test = require("node:test");
const assert = require("node:assert");
const { spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const SCRIPTS = path.join(__dirname, "..", "scripts");

function run(script, args, opts = {}) {
  const r = spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], {
    encoding: "utf8",
    ...opts,
  });
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

test("scrape.js sin URL: sale con código 1 y uso claro", () => {
  const r = run("scrape.js", []);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /Falta la URL/);
});

test("scrape.js con --lang inválido: sale con código 1 y lista los idiomas soportados", () => {
  const r = run("scrape.js", ["https://ejemplo.com", "--lang", "fr"]);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /--lang inválido.*es, en/);
});

test("compare.js con --lang inválido: sale con código 1", () => {
  const r = run("compare.js", ["a.json", "b.json", "--lang", "pt"]);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /--lang inválido.*es, en/);
});

test("compare.js --lang en: el reporte de ventas sale en inglés end-to-end", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-cli-"));
  const mk = (day, stock, soldQty) =>
    JSON.stringify({
      brand: "Marca CLI",
      platform: "tiendanube",
      currency: "ARS",
      scrapedAt: `2026-08-${String(day).padStart(2, "0")}T12:00:00Z`,
      products: [{ id: 7, name: "Producto CLI", price: 2000, stock, soldQty, available: stock > 0 }],
    });
  fs.writeFileSync(path.join(dir, "a.json"), mk(1, 10, 30));
  fs.writeFileSync(path.join(dir, "b.json"), mk(8, 4, 36));

  const r = run("compare.js", [
    path.join(dir, "a.json"),
    path.join(dir, "b.json"),
    "--lang",
    "en",
    "--html-only",
    "--out",
    path.join(dir, "out"),
  ]);
  assert.strictEqual(r.code, 0);

  const html = fs
    .readdirSync(path.join(dir, "out"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => fs.readFileSync(path.join(dir, "out", f), "utf8"))[0];
  assert.ok(/<html lang="en">/.test(html));
  assert.ok(/Units sold/.test(html));
  assert.ok(!/Unidades vendidas/.test(html));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("scrape.js con --limit inválido: sale con código 1", () => {
  const r = run("scrape.js", ["https://ejemplo.com", "--limit", "abc"]);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /--limit necesita un número/);
});

test("compare.js con menos de 2 datasets: sale con código 1", () => {
  const r = run("compare.js", ["solo-uno.json"]);
  assert.strictEqual(r.code, 1);
  assert.match(r.out, /al menos 2 datasets/);
});

test("compare.js end-to-end offline: datasets válidos → HTML con estimación", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-cli-"));
  const mk = (day, stock, soldQty) =>
    JSON.stringify({
      brand: "Marca CLI",
      platform: "tiendanube",
      currency: "ARS",
      scrapedAt: `2026-08-${String(day).padStart(2, "0")}T12:00:00Z`,
      products: [{ id: 7, name: "Producto CLI", price: 2000, stock, soldQty, available: stock > 0 }],
    });
  fs.writeFileSync(path.join(dir, "a.json"), mk(1, 10, 30));
  fs.writeFileSync(path.join(dir, "b.json"), mk(8, 4, 36));

  const r = run("compare.js", [
    path.join(dir, "a.json"),
    path.join(dir, "b.json"),
    "--html-only",
    "--out",
    path.join(dir, "out"),
  ]);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /6 u\. estimadas/); // sold_qty 30→36

  const html = fs
    .readdirSync(path.join(dir, "out"))
    .filter((f) => f.endsWith(".html"))
    .map((f) => fs.readFileSync(path.join(dir, "out", f), "utf8"))[0];
  assert.ok(/Producto CLI/.test(html));
  assert.ok(/Marca CLI/.test(html));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("compare.js con un dataset corrupto: acumula errores y sigue con los válidos", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-cli-"));
  const mk = (day, stock) =>
    JSON.stringify({
      brand: "Marca CLI",
      scrapedAt: `2026-08-${String(day).padStart(2, "0")}T12:00:00Z`,
      products: [{ id: 7, name: "P", price: 100, stock, available: true }],
    });
  fs.writeFileSync(path.join(dir, "a.json"), mk(1, 10));
  fs.writeFileSync(path.join(dir, "b.json"), mk(8, 5));
  fs.writeFileSync(path.join(dir, "malo.json"), "{{{corrupto");

  const r = run("compare.js", [
    path.join(dir, "malo.json"),
    path.join(dir, "a.json"),
    path.join(dir, "b.json"),
    "--html-only",
    "--out",
    path.join(dir, "out"),
  ]);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /malo\.json: no es JSON válido/);
  assert.match(r.out, /Sigo con los 2 datasets válidos/);
  assert.match(r.out, /5 u\. estimadas/);
  fs.rmSync(dir, { recursive: true, force: true });
});

// v2.1: compare.js acepta los HTML de catálogo directamente (sin extraer el JSON a mano).
test("compare.js con HTML de catálogo reales: extrae el dataset embebido y estima", () => {
  const { buildCatalogHtml } = require(path.join(SCRIPTS, "lib", "templates-catalog.js"));
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-cli-"));
  const producto = (stock, soldQty) => ({
    id: 9,
    name: "Remera HTML",
    brand: "",
    url: "https://x.test/productos/remera/",
    crumbs: [],
    seoTitle: "",
    metaDescription: "",
    description: "",
    mainImage: null,
    priceShort: "$5.000",
    price: 5000,
    minPrice: 5000,
    maxPrice: 5000,
    compareShort: null,
    promoShort: null,
    payDiscount: null,
    stockTotal: stock,
    soldQty,
    available: stock > 0,
    sizeOptionName: "Talle",
    variants: [{ size: "U", sku: "R1", stock, available: stock > 0 }],
  });
  const mkHtml = (day, stock, soldQty) =>
    buildCatalogHtml({
      brand: "Marca HTML",
      source: "https://x.test",
      platform: "tiendanube",
      platformLabel: "Tienda Nube",
      currency: "ARS",
      scrapedAt: new Date(`2026-08-${String(day).padStart(2, "0")}T12:00:00Z`),
      summary: { stockTotal: stock, stockKnown: 1, minPrice: 5000, maxPrice: 5000 },
      products: [producto(stock, soldQty)],
    });
  fs.writeFileSync(path.join(dir, "a.html"), mkHtml(1, 12, 40));
  fs.writeFileSync(path.join(dir, "b.html"), mkHtml(9, 5, 47));

  const r = run("compare.js", [
    path.join(dir, "a.html"),
    path.join(dir, "b.html"),
    "--html-only",
    "--out",
    path.join(dir, "out"),
  ]);
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /7 u\. estimadas/); // soldQty 40→47 (mejor señal que stock 12→5)
  fs.rmSync(dir, { recursive: true, force: true });
});

test("compare.js con un HTML sin dataset embebido: error claro y no revienta", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-cli-"));
  fs.writeFileSync(path.join(dir, "raro.html"), "<!doctype html><html><body>hola</body></html>");
  fs.writeFileSync(path.join(dir, "b.json"), JSON.stringify({
    brand: "M", scrapedAt: "2026-08-01T12:00:00Z",
    products: [{ id: 1, name: "P", price: 100, stock: 5, available: true }],
  }));
  const r = run("compare.js", [path.join(dir, "raro.html"), path.join(dir, "b.json")]);
  assert.strictEqual(r.code, 1); // queda un solo dataset válido
  assert.match(r.out, /raro\.html: es HTML pero no trae el dataset embebido/);
  fs.rmSync(dir, { recursive: true, force: true });
});

// v2.1: sin Chrome no se cae — avisa, omite el PDF y entrega el HTML igual.
test("compare.js sin Chrome disponible: omite el PDF con aviso y sale 0", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-cli-"));
  const mk = (day, stock) =>
    JSON.stringify({
      brand: "Marca CLI",
      scrapedAt: `2026-08-${String(day).padStart(2, "0")}T12:00:00Z`,
      products: [{ id: 7, name: "P", price: 100, stock, available: true }],
    });
  fs.writeFileSync(path.join(dir, "a.json"), mk(1, 10));
  fs.writeFileSync(path.join(dir, "b.json"), mk(8, 4));
  const r = run(
    "compare.js",
    [path.join(dir, "a.json"), path.join(dir, "b.json"), "--out", path.join(dir, "out")],
    { env: { ...process.env, CHROME_PATH: path.join(dir, "no-existe-chrome") } }
  );
  assert.strictEqual(r.code, 0);
  assert.match(r.out, /PDF omitido/);
  assert.ok(fs.readdirSync(path.join(dir, "out")).some((f) => f.endsWith(".html")));
  assert.ok(!fs.readdirSync(path.join(dir, "out")).some((f) => f.endsWith(".pdf")));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("compare.js con todos los datasets rotos: sale con código 1", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-cli-"));
  fs.writeFileSync(path.join(dir, "x.json"), "nope");
  fs.writeFileSync(path.join(dir, "y.json"), "tampoco");
  const r = run("compare.js", [path.join(dir, "x.json"), path.join(dir, "y.json")]);
  assert.strictEqual(r.code, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});
