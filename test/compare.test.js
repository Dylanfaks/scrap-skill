// Tests del motor de comparación de ventas (compare.js): señales sold_qty /
// caída de stock / disponibilidad, reposiciones, períodos y validación.
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");

const { compare, loadDataset } = require(path.join(__dirname, "..", "scripts", "compare"));

const day = (n) => new Date(Date.UTC(2026, 7, 1 + n)).toISOString();

function ds(daysFromStart, products, extra = {}) {
  return {
    brand: "Marca Test",
    platform: extra.platform ?? "tiendanube",
    currency: "ARS",
    date: new Date(day(daysFromStart)),
    products,
    byId: new Map(products.map((p) => [String(p.id), p])),
  };
}

test("caída de stock simple: lo que bajó, se vendió", () => {
  const cmp = compare([
    ds(0, [{ id: 1, name: "A", price: 1000, stock: 10 }]),
    ds(7, [{ id: 1, name: "A", price: 1000, stock: 6 }]),
  ]);
  assert.strictEqual(cmp.total.sold, 4);
  assert.strictEqual(cmp.total.revenueList, 4000);
  assert.strictEqual(cmp.totalDays, 7);
  assert.strictEqual(cmp.availabilityOnly, false);
});

test("sold_qty gana a la caída de stock: capta ventas con reposición", () => {
  // stock cayó 2 pero sold_qty subió 5 → vendieron 5 y repusieron 3
  const cmp = compare([
    ds(0, [{ id: 1, name: "A", price: 1000, stock: 10, soldQty: 100 }]),
    ds(7, [{ id: 1, name: "A", price: 1000, stock: 8, soldQty: 105 }]),
  ]);
  assert.strictEqual(cmp.total.sold, 5);
  assert.strictEqual(cmp.usedSoldQty, true);
  assert.strictEqual(cmp.total.reposiciones[0].restock, 3);
});

test("restock neto (stock subió) no cuenta ventas negativas", () => {
  const cmp = compare([
    ds(0, [{ id: 1, name: "A", price: 1000, stock: 5 }]),
    ds(7, [{ id: 1, name: "A", price: 1000, stock: 12 }]),
  ]);
  assert.strictEqual(cmp.total.sold, 0);
  assert.strictEqual(cmp.total.reposiciones[0].restock, 7);
});

test("availability-only (Shopify/Woo): detecta agotados y reapariciones", () => {
  const cmp = compare([
    ds(0, [
      { id: 1, name: "A", price: 90, stock: null, available: true },
      { id: 2, name: "B", price: 50, stock: null, available: false },
    ], { platform: "shopify" }),
    ds(5, [
      { id: 1, name: "A", price: 90, stock: null, available: false },
      { id: 2, name: "B", price: 50, stock: null, available: true },
    ], { platform: "shopify" }),
  ]);
  assert.strictEqual(cmp.availabilityOnly, true);
  assert.deepStrictEqual(cmp.agotados.map((x) => x.name), ["A"]);
  assert.deepStrictEqual(cmp.reaparecidos.map((x) => x.name), ["B"]);
  assert.strictEqual(cmp.total.sold, 0); // sin stock numérico no se inventan unidades
});

test("precio del inicio de cada período valoriza las ventas", () => {
  // período 1: vende 2 a $100; período 2: vende 3 a $200 (subió el precio)
  const cmp = compare([
    ds(0, [{ id: 1, name: "A", price: 100, stock: 10 }]),
    ds(3, [{ id: 1, name: "A", price: 200, stock: 8 }]),
    ds(6, [{ id: 1, name: "A", price: 200, stock: 5 }]),
  ]);
  assert.strictEqual(cmp.total.sold, 5);
  assert.strictEqual(cmp.total.revenueList, 2 * 100 + 3 * 200);
  assert.strictEqual(cmp.periods.length, 2);
});

test("productos nuevos/reactivados no suman al período pero se listan", () => {
  const cmp = compare([
    ds(0, [{ id: 1, name: "A", price: 100, stock: 5 }]),
    ds(7, [
      { id: 1, name: "A", price: 100, stock: 5 },
      { id: 2, name: "Nuevo", price: 300, stock: 10, soldQty: 44 },
    ]),
  ]);
  assert.strictEqual(cmp.total.sold, 0);
  assert.deepStrictEqual(cmp.total.nuevos.map((n) => n.name), ["Nuevo"]);
  assert.strictEqual(cmp.productsActivos, 2);
});

test("productos dados de baja se cuentan", () => {
  const cmp = compare([
    ds(0, [
      { id: 1, name: "A", price: 100, stock: 5 },
      { id: 2, name: "B", price: 100, stock: 5 },
    ]),
    ds(7, [{ id: 1, name: "A", price: 100, stock: 5 }]),
  ]);
  assert.strictEqual(cmp.productsBaja, 1);
});

test("datasets desordenados se ordenan por fecha", () => {
  const cmp = compare([
    ds(7, [{ id: 1, name: "A", price: 100, stock: 6 }]),
    ds(0, [{ id: 1, name: "A", price: 100, stock: 10 }]),
  ]);
  assert.strictEqual(cmp.total.sold, 4); // 10 → 6, no al revés
});

test("loadDataset acumula TODOS los errores de un archivo", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-test-"));
  const f = path.join(dir, "malo.json");
  fs.writeFileSync(f, JSON.stringify({ products: [{ name: "sin id" }] })); // sin scrapedAt + sin id
  const errors = [];
  const d = loadDataset(f, errors);
  assert.strictEqual(d, null);
  assert.strictEqual(errors.length, 1);
  assert.match(errors[0], /scrapedAt/);
  assert.match(errors[0], /sin "id"/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("loadDataset: JSON corrupto reporta sin tirar excepción", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scrap-test-"));
  const f = path.join(dir, "corrupto.json");
  fs.writeFileSync(f, "esto no es json{{{");
  const errors = [];
  assert.strictEqual(loadDataset(f, errors), null);
  assert.match(errors[0], /no es JSON válido/);
  fs.rmSync(dir, { recursive: true, force: true });
});
