// Template HTML del reporte de ventas (comparación de 2+ scraps de la misma marca).
// Mismo lenguaje visual que el catálogo: portada negra, acento rojo/verde, tarjetas,
// barras sin librerías. Recibe el objeto `cmp` que arma compare.js.

const { fmtPrice, fmtMoney, esc, fmtDateTime } = require("./format");

const GREEN = "#0e7c66";
const RED = "#c8202b";

const card = (label, big, sub, color) =>
  `<div class="metric"><div class="m-label">${label}</div><div class="m-big" style="color:${
    color || "#111"
  }">${big}</div><div class="m-sub">${sub || ""}</div></div>`;

function bars(items, valueFn, labelFn, valueLabelFn, color) {
  if (!items.length) return '<p class="sub">—</p>';
  const max = Math.max(...items.map(valueFn), 1);
  return items
    .map(
      (it) => `<div class="bar-row">
      <div class="bar-name">${esc(labelFn(it))}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(
        4,
        (valueFn(it) / max) * 100
      )}%;background:${color}"></div></div>
      <div class="bar-val">${esc(valueLabelFn(it))}</div>
    </div>`
    )
    .join("");
}

const dateShort = (d) => d.toLocaleDateString("es-AR", { day: "2-digit", month: "short" });

function buildSalesHtml(cmp) {
  const t = cmp.total;
  const showTrend = cmp.periods.length >= 2 && !cmp.availabilityOnly;
  const isTN = cmp.platform === "tiendanube" || cmp.platform == null;
  const showUnits = !cmp.availabilityOnly;

  const trendRows = cmp.periods
    .map(
      (p) =>
        `<tr><td>${dateShort(p.fromAt)} → ${dateShort(p.toAt)}</td><td class="c">${p.days}</td>
         <td class="c">${p.sold} u.</td><td class="r">${fmtPrice(p.revenueList)}</td>
         <td class="c">${p.perDay.toFixed(1)}</td></tr>`
    )
    .join("");

  const tableRows = t.topSold
    .slice(0, 14)
    .map(
      (s) =>
        `<tr><td>${esc(s.name)}</td><td class="c">${s.vendidas}</td><td class="r">${fmtPrice(
          s.revenue
        )}</td><td class="c muted">${s.fromStock ?? "s/d"} → ${s.toStock ?? "s/d"}</td></tr>`
    )
    .join("");

  const reposRows = t.reposiciones.length
    ? t.reposiciones
        .map((x) => `<li><b>+${x.restock} u.</b> ${esc(x.name)}</li>`)
        .join("")
    : "<li>(ninguna detectada)</li>";

  const reactRows = t.nuevos.length
    ? t.nuevos
        .map(
          (n) =>
            `<li><b>${n.soldQty ?? "?"} u.</b> histórico · ${esc(n.name)} <span class="muted">(hoy: ${
              n.stock === 0 ? "agotado" : n.stock + " u."
            })</span></li>`
        )
        .join("")
    : "<li>(ninguno)</li>";

  const histRows = cmp.histTop
    .map((n) => `<tr><td>${esc(n.name)}</td><td class="r">${n.soldQty} u.</td></tr>`)
    .join("");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; }
  body { font-family: Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 0; font-size: 12px; line-height: 1.45; }
  h2 { font-size: 21px; margin: 26px 0 4px; }
  h2 .hint { font-size: 12px; color: #888; font-weight: 400; }
  .sub { color: #777; margin: 0 0 14px; }
  .wrap { padding: 30px 46px; }
  .cover { background: #111; color: #fff; padding: 56px 46px 40px; }
  .cover .kicker { color: #c8202b; font-weight: 700; letter-spacing: 2px; font-size: 12px; text-transform: uppercase; }
  .cover h1 { font-size: 42px; margin: 8px 0 10px; letter-spacing: -1px; }
  .cover .c1 { color: #cfcfcf; font-size: 15px; }
  .cover .head { margin-top: 22px; display: flex; gap: 34px; }
  .cover .head .h-big { font-size: 30px; font-weight: 800; }
  .cover .head .h-lbl { color: #9a9a9a; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
  .cover .head .red { color: #ff5666; }
  .callout { border-left: 4px solid #d9a400; background: #fff8e6; padding: 11px 14px; font-size: 11.5px; color: #6b5400; margin: 18px 0 6px; }
  .callout b { color: #4a3a00; }
  .metrics { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; margin: 10px 0 6px; }
  .metric { border: 1px solid #ececec; border-top: 3px solid #111; padding: 12px 14px; }
  .m-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: .5px; color: #888; }
  .m-big { font-size: 26px; font-weight: 800; margin: 4px 0 2px; }
  .m-sub { font-size: 11px; color: #777; }
  .bars { margin: 8px 0 4px; }
  .bar-row { display: flex; align-items: center; gap: 10px; margin: 5px 0; }
  .bar-name { width: 200px; font-size: 11.5px; flex: none; }
  .bar-track { flex: 1; background: #f1f1f2; height: 16px; border-radius: 3px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 3px; }
  .bar-val { width: 95px; text-align: right; font-size: 11.5px; font-weight: 700; flex: none; }
  table.data { border-collapse: collapse; width: 100%; margin-top: 6px; }
  table.data th { background: #111; color: #fff; font-size: 11px; text-align: left; padding: 7px 10px; }
  table.data th.c, table.data td.c { text-align: center; }
  table.data th.r, table.data td.r { text-align: right; }
  table.data td { border-bottom: 1px solid #eee; padding: 6px 10px; font-size: 11.5px; }
  .muted { color: #999; }
  .twocol { display: grid; grid-template-columns: 1fr 1fr; gap: 26px; }
  .box { border: 1px solid #ececec; padding: 12px 16px; }
  .box h3 { margin: 0 0 6px; font-size: 13px; }
  .box ul { margin: 0; padding-left: 18px; }
  .box li { font-size: 11.5px; margin: 3px 0; }
  .note { font-size: 11px; color: #555; line-height: 1.6; }
  .note b { color: #1a1a1a; }
  .section-break { break-before: page; }
  .avoid { break-inside: avoid; }
</style></head><body>
  <div class="cover">
    <div class="kicker">Reporte de ventas · estimación</div>
    <h1>${esc(cmp.brand)} — Ventas del período</h1>
    <div class="c1">${dateShort(cmp.firstAt)} → ${dateShort(cmp.lastAt)} · ${cmp.totalDays} días · ${
    cmp.nScraps
  } scraps comparados</div>
    <div class="head">
      ${
        showUnits
          ? `<div><div class="h-big">${t.sold} u.</div><div class="h-lbl">Unidades vendidas</div></div>
      <div><div class="h-big red">${fmtMoney(t.revenueList)}</div><div class="h-lbl">Facturación (lista)</div></div>
      <div><div class="h-big">${fmtPrice(t.ticket)}</div><div class="h-lbl">Ticket promedio</div></div>`
          : `<div><div class="h-big red">${cmp.agotados.length}</div><div class="h-lbl">Productos agotados</div></div>
      <div><div class="h-big">${cmp.reaparecidos.length}</div><div class="h-lbl">Volvieron a stock</div></div>
      <div><div class="h-big">${cmp.productsActivos}</div><div class="h-lbl">Productos activos</div></div>`
      }
    </div>
  </div>

  <div class="wrap">
    ${
      showUnits
        ? `<div class="callout">⚠ <b>Estimación sobre datos públicos de la tienda</b>, no es la caja real de la marca.
    ${
      cmp.usedSoldQty
        ? "Combina el contador público de unidades vendidas (<code>sold_qty</code>) con la caída de stock entre scraps: se usa la mejor señal por producto."
        : "Se mide la caída de stock de cada producto entre cada par de scraps: lo que bajó, se vendió."
    }
    Es un <b>piso</b> — las ventas reales pueden ser mayores (no capta reposiciones no observadas ni productos reactivados).</div>`
        : `<div class="callout">⚠ <b>Esta plataforma no publica stock numérico</b> (solo disponibilidad por producto).
    El reporte detecta <b>qué se agotó y qué volvió a stock</b> entre scraps, pero no puede contar unidades vendidas.
    Para unidades y facturación estimadas se necesita una tienda que exponga stock (ej. Tienda Nube).</div>`
    }

    <h2>Resumen ejecutivo</h2>
    <div class="metrics">
      ${
        showUnits
          ? card("Unidades vendidas", t.sold + " u.", `${t.perDay.toFixed(1)} u/día`) +
            card("Facturación — precio lista", fmtPrice(t.revenueList), `${fmtPrice(t.perDayRevenue)} /día`, RED) +
            (isTN
              ? card("Facturación — transferencia", fmtPrice(t.revenueTransfer), "−10% pago efectivo/transf.", RED)
              : card("Proyección mensual", "~" + fmtMoney(t.monthly), "extrapolado del ritmo")) +
            card("Ticket promedio", fmtPrice(t.ticket), "por unidad") +
            (isTN ? card("Proyección mensual", "~" + fmtMoney(t.monthly), "extrapolado del ritmo") : "") +
            card("Productos activos", String(cmp.productsActivos), `${cmp.productsBaja} dados de baja`)
          : card("Se agotaron en el período", String(cmp.agotados.length), "disponible → agotado", RED) +
            card("Volvieron a stock", String(cmp.reaparecidos.length), "agotado → disponible") +
            card("Productos activos", String(cmp.productsActivos), `${cmp.productsBaja} dados de baja`)
      }
    </div>

    ${
      showTrend
        ? `<h2>Evolución período a período <span class="hint">— seguimiento entre scraps</span></h2>
    <table class="data avoid">
      <thead><tr><th>Período</th><th class="c">Días</th><th class="c">Unidades</th><th class="r">Facturación (lista)</th><th class="c">u/día</th></tr></thead>
      <tbody>${trendRows}</tbody>
    </table>
    <div class="bars" style="margin-top:10px">${bars(
      cmp.periods,
      (p) => p.sold,
      (p) => `${dateShort(p.fromAt)} → ${dateShort(p.toAt)}`,
      (p) => `${p.sold} u.`,
      GREEN
    )}</div>`
        : ""
    }

    ${
      showUnits
        ? `<h2>Más vendidos del período <span class="hint">— por unidades</span></h2>
    <div class="bars">${bars(
      t.topSold.slice(0, 10),
      (x) => x.vendidas,
      (x) => x.name,
      (x) => x.vendidas + " u.",
      GREEN
    )}</div>

    <h2>Lo que más facturó <span class="hint">— unidades × precio de lista</span></h2>
    <div class="bars">${bars(
      t.topRevenue.slice(0, 8),
      (x) => x.revenue,
      (x) => x.name,
      (x) => fmtPrice(x.revenue),
      RED
    )}</div>

    <div class="section-break"></div>
    <h2>Detalle de ventas del período</h2>
    <p class="sub">Productos con ventas detectadas entre el primer y el último scrap.</p>
    <table class="data">
      <thead><tr><th>Producto</th><th class="c">Vendidas</th><th class="r">Facturación (lista)</th><th class="c">Stock inicio → fin</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>

    <h2 class="avoid">Por qué el número real es mayor</h2>
    <div class="twocol avoid">
      <div class="box">
        <h3>Reposiciones detectadas</h3>
        <p class="note" style="margin:0 0 6px">Entró stock nuevo → vendieron <i>y</i> repusieron:</p>
        <ul>${reposRows}</ul>
      </div>
      <div class="box">
        <h3>Productos reactivados</h3>
        <p class="note" style="margin:0 0 6px">Aparecieron después del primer scrap (su histórico no es del período):</p>
        <ul>${reactRows}</ul>
      </div>
    </div>`
        : ""
    }

    ${
      cmp.agotados.length || cmp.reaparecidos.length
        ? `<h2 class="avoid">Rotación de disponibilidad <span class="hint">— entre el primer y el último scrap</span></h2>
    <div class="twocol avoid">
      <div class="box">
        <h3>Se agotaron (${cmp.agotados.length})</h3>
        <ul>${cmp.agotados.map((x) => `<li>${esc(x.name)}</li>`).join("") || "<li>(ninguno)</li>"}</ul>
      </div>
      <div class="box">
        <h3>Volvieron a stock (${cmp.reaparecidos.length})</h3>
        <ul>${cmp.reaparecidos.map((x) => `<li>${esc(x.name)}</li>`).join("") || "<li>(ninguno)</li>"}</ul>
      </div>
    </div>`
        : ""
    }

    ${
      cmp.histU > 0
        ? `<h2 class="avoid">Tamaño de la marca <span class="hint">— histórico acumulado, no del período</span></h2>
    <div class="twocol avoid">
      <div>
        <div class="metric" style="border-top-color:#0e7c66">
          <div class="m-label">Unidades vendidas en toda la vida de la tienda</div>
          <div class="m-big" style="color:#0e7c66">${cmp.histU.toLocaleString("es-AR")} u.</div>
          <div class="m-sub">acumulado de los productos vivos (contador <code>sold_qty</code> público de Tienda Nube)</div>
        </div>
      </div>
      <table class="data">
        <thead><tr><th>Best-sellers históricos</th><th class="r">Vendidas (total)</th></tr></thead>
        <tbody>${histRows}</tbody>
      </table>
    </div>`
        : ""
    }

    <h2 class="avoid">Método y límites</h2>
    <p class="note avoid">
      <b>Cómo se calcula:</b> se cruzan los scraps por ID de producto y se ordenan por su fecha/hora de
      generación. ${
        showUnits
          ? cmp.usedSoldQty
            ? "Por producto se usa la mejor señal pública disponible: el delta del contador de unidades vendidas (<code>sold_qty</code>, exacto y capta reposiciones) o la caída de stock entre fechas (piso)."
            : "La caída de stock entre dos fechas se cuenta como ventas."
          : "Sin stock numérico público, se registran las transiciones de disponibilidad (disponible → agotado y viceversa)."
      } <b>No es la caja real</b>: es inferencia sobre los datos públicos que expone la tienda.<br>
      ${
        showUnits
          ? `<b>Por qué es un piso:</b> asume que no hubo reposición salvo las detectadas. Si la marca repuso stock
      de otros productos, las ventas reales son mayores.<br>
      <b>Valorización:</b> a precio de lista al inicio de cada período${
        isTN
          ? `; con pago por transferencia/efectivo (−10%) la facturación baja a ${fmtPrice(t.revenueTransfer)}`
          : ""
      }.<br>`
          : ""
      }
      <b>Precisión:</b> cuantos más scraps y más seguidos, menos chance de reposiciones ocultas → estimación
      más exacta. Este reporte usa ${cmp.nScraps} scraps.<br>
      <b>Generado:</b> ${fmtDateTime(cmp.generatedAt)}.
    </p>
  </div>
</body></html>`;
}

module.exports = { buildSalesHtml };
