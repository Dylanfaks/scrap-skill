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

test("compare.js con todos los datasets rotos: sale con código 1", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-cli-"));
  fs.writeFileSync(path.join(dir, "x.json"), "nope");
  fs.writeFileSync(path.join(dir, "y.json"), "tampoco");
  const r = run("compare.js", [path.join(dir, "x.json"), path.join(dir, "y.json")]);
  assert.strictEqual(r.code, 1);
  fs.rmSync(dir, { recursive: true, force: true });
});
