// Template HTML del reporte de ventas (comparación de 2+ scraps de la misma marca).
// Mismo lenguaje visual que el catálogo: portada negra, acento rojo/verde, tarjetas,
// barras sin librerías. Recibe el objeto `cmp` que arma compare.js.
// Soporta reportes en español o inglés vía cmp.lang ("es" default | "en") — solo
// traduce los labels de la interfaz, nunca el contenido scrapeado (nombres de producto).

const { fmtPrice, fmtMoney, fmtInt, esc, fmtDateTime, dateShort } = require("./format");
const { t } = require("./i18n");

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

function buildSalesHtml(cmp) {
  const lang = cmp.lang === "en" ? "en" : "es";
  const tr = t(lang);
  const ds = (d) => dateShort(d, lang);
  const t2 = cmp.total;
  const showTrend = cmp.periods.length >= 2 && !cmp.availabilityOnly;
  const isTN = cmp.platform === "tiendanube" || cmp.platform == null;
  const showUnits = !cmp.availabilityOnly;

  const trendRows = cmp.periods
    .map(
      (p) =>
        `<tr><td>${ds(p.fromAt)} → ${ds(p.toAt)}</td><td class="c">${p.days}</td>
         <td class="c">${p.sold} u.</td><td class="r">${fmtPrice(p.revenueList, lang)}</td>
         <td class="c">${p.perDay.toFixed(1)}</td></tr>`
    )
    .join("");

  const tableRows = t2.topSold
    .slice(0, 14)
    .map(
      (s) =>
        `<tr><td>${esc(s.name)}</td><td class="c">${s.vendidas}</td><td class="r">${fmtPrice(
          s.revenue,
          lang
        )}</td><td class="c muted">${s.fromStock ?? "s/d"} → ${s.toStock ?? "s/d"}</td></tr>`
    )
    .join("");

  const reposRows = t2.reposiciones.length
    ? t2.reposiciones.map((x) => `<li><b>+${x.restock} u.</b> ${esc(x.name)}</li>`).join("")
    : `<li>${tr.restocksNone}</li>`;

  const reactRows = t2.nuevos.length
    ? t2.nuevos
        .map(
          (n) =>
            `<li><b>${n.soldQty ?? "?"} ${tr.historicalUnits}</b> · ${esc(n.name)} <span class="muted">(${
              tr.today
            }: ${n.stock === 0 ? tr.soldOutWord : n.stock + " u."})</span></li>`
        )
        .join("")
    : `<li>${tr.reactivatedNone}</li>`;

  const histRows = cmp.histTop
    .map((n) => `<tr><td>${esc(n.name)}</td><td class="r">${n.soldQty} u.</td></tr>`)
    .join("");

  return `<!doctype html><html lang="${tr.htmlLang}"><head><meta charset="utf-8"><style>
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
    <div class="kicker">${tr.salesKicker}</div>
    <h1>${esc(tr.salesTitle(cmp.brand))}</h1>
    <div class="c1">${esc(tr.salesSubtitle(ds(cmp.firstAt), ds(cmp.lastAt), cmp.totalDays, cmp.nScraps))}</div>
    <div class="head">
      ${
        showUnits
          ? `<div><div class="h-big">${t2.sold} u.</div><div class="h-lbl">${tr.unitsSold}</div></div>
      <div><div class="h-big red">${fmtMoney(t2.revenueList, lang)}</div><div class="h-lbl">${tr.revenueList}</div></div>
      <div><div class="h-big">${fmtPrice(t2.ticket, lang)}</div><div class="h-lbl">${tr.avgTicket}</div></div>`
          : `<div><div class="h-big red">${cmp.agotados.length}</div><div class="h-lbl">${tr.outOfStockProductsShort}</div></div>
      <div><div class="h-big">${cmp.reaparecidos.length}</div><div class="h-lbl">${tr.backInStock}</div></div>
      <div><div class="h-big">${cmp.productsActivos}</div><div class="h-lbl">${tr.activeProducts}</div></div>`
      }
    </div>
  </div>

  <div class="wrap">
    ${
      showUnits
        ? `<div class="callout">⚠ <b>${tr.calloutUnitsTitle}</b>${tr.calloutUnitsIntro}
    ${cmp.usedSoldQty ? tr.calloutUnitsSoldQty : tr.calloutUnitsStockOnly}
    ${tr.calloutUnitsFloor}</div>`
        : `<div class="callout">⚠ <b>${tr.calloutNoStockTitle}</b>${tr.calloutNoStockBody}</div>`
    }

    <h2>${tr.execSummary}</h2>
    <div class="metrics">
      ${
        showUnits
          ? card(tr.unitsSold, t2.sold + " u.", tr.perDay(t2.perDay.toFixed(1))) +
            card(tr.revenueList, fmtPrice(t2.revenueList, lang), `${fmtPrice(t2.perDayRevenue, lang)} ${tr.perDayRevenue}`, RED) +
            (isTN
              ? card(tr.revenueTransfer, fmtPrice(t2.revenueTransfer, lang), tr.revenueTransferSub, RED)
              : card(tr.monthlyProjection, "~" + fmtMoney(t2.monthly, lang), tr.monthlyProjectionSub)) +
            card(tr.avgTicket, fmtPrice(t2.ticket, lang), tr.perUnit) +
            (isTN ? card(tr.monthlyProjection, "~" + fmtMoney(t2.monthly, lang), tr.monthlyProjectionSub) : "") +
            card(tr.activeProducts, String(cmp.productsActivos), tr.dischargedProducts(cmp.productsBaja))
          : card(tr.soldOutInPeriod, String(cmp.agotados.length), tr.soldOutInPeriodSub, RED) +
            card(tr.backInStock, String(cmp.reaparecidos.length), tr.backInStockSub) +
            card(tr.activeProducts, String(cmp.productsActivos), tr.dischargedProducts(cmp.productsBaja))
      }
    </div>

    ${
      showTrend
        ? `<h2>${tr.periodEvolution} <span class="hint">${tr.periodEvolutionHint}</span></h2>
    <table class="data avoid">
      <thead><tr><th>${tr.thPeriod}</th><th class="c">${tr.thDays}</th><th class="c">${tr.thUnits}</th><th class="r">${
            tr.thRevenueList
          }</th><th class="c">${tr.thUnitsPerDay}</th></tr></thead>
      <tbody>${trendRows}</tbody>
    </table>
    <div class="bars" style="margin-top:10px">${bars(
      cmp.periods,
      (p) => p.sold,
      (p) => `${ds(p.fromAt)} → ${ds(p.toAt)}`,
      (p) => `${p.sold} u.`,
      GREEN
    )}</div>`
        : ""
    }

    ${
      showUnits
        ? `<h2>${tr.topSold} <span class="hint">${tr.topSoldHint}</span></h2>
    <div class="bars">${bars(
      t2.topSold.slice(0, 10),
      (x) => x.vendidas,
      (x) => x.name,
      (x) => x.vendidas + " u.",
      GREEN
    )}</div>

    <h2>${tr.topRevenue} <span class="hint">${tr.topRevenueHint}</span></h2>
    <div class="bars">${bars(
      t2.topRevenue.slice(0, 8),
      (x) => x.revenue,
      (x) => x.name,
      (x) => fmtPrice(x.revenue, lang),
      RED
    )}</div>

    <div class="section-break"></div>
    <h2>${tr.periodDetail}</h2>
    <p class="sub">${tr.periodDetailSub}</p>
    <table class="data">
      <thead><tr><th>${tr.thProduct}</th><th class="c">${tr.thSold}</th><th class="r">${
            tr.thRevenueList
          }</th><th class="c">${tr.thStockRange}</th></tr></thead>
      <tbody>${tableRows}</tbody>
    </table>

    <h2 class="avoid">${tr.whyHigher}</h2>
    <div class="twocol avoid">
      <div class="box">
        <h3>${tr.restocksDetected}</h3>
        <p class="note" style="margin:0 0 6px">${tr.restocksIntro}</p>
        <ul>${reposRows}</ul>
      </div>
      <div class="box">
        <h3>${tr.reactivated}</h3>
        <p class="note" style="margin:0 0 6px">${tr.reactivatedIntro}</p>
        <ul>${reactRows}</ul>
      </div>
    </div>`
        : ""
    }

    ${
      cmp.agotados.length || cmp.reaparecidos.length
        ? `<h2 class="avoid">${tr.availabilityTurnover} <span class="hint">${tr.availabilityTurnoverHint}</span></h2>
    <div class="twocol avoid">
      <div class="box">
        <h3>${tr.wentOutOfStock(cmp.agotados.length)}</h3>
        <ul>${cmp.agotados.map((x) => `<li>${esc(x.name)}</li>`).join("") || `<li>${tr.none}</li>`}</ul>
      </div>
      <div class="box">
        <h3>${tr.cameBackInStock(cmp.reaparecidos.length)}</h3>
        <ul>${cmp.reaparecidos.map((x) => `<li>${esc(x.name)}</li>`).join("") || `<li>${tr.none}</li>`}</ul>
      </div>
    </div>`
        : ""
    }

    ${
      cmp.histU > 0
        ? `<h2 class="avoid">${tr.brandSize} <span class="hint">${tr.brandSizeHint}</span></h2>
    <div class="twocol avoid">
      <div>
        <div class="metric" style="border-top-color:#0e7c66">
          <div class="m-label">${tr.lifetimeUnits}</div>
          <div class="m-big" style="color:#0e7c66">${fmtInt(cmp.histU, lang)} u.</div>
          <div class="m-sub">${tr.lifetimeUnitsSub}</div>
        </div>
      </div>
      <table class="data">
        <thead><tr><th>${tr.historicalBestsellers}</th><th class="r">${tr.thSoldTotal}</th></tr></thead>
        <tbody>${histRows}</tbody>
      </table>
    </div>`
        : ""
    }

    <h2 class="avoid">${tr.methodAndLimits}</h2>
    <p class="note avoid">
      ${tr.methodHow} ${showUnits ? (cmp.usedSoldQty ? tr.methodSoldQty : tr.methodStockOnly) : tr.methodAvailabilityOnly}
      ${tr.methodNotRealBooks}<br>
      ${showUnits ? `${tr.methodWhyFloor}<br>${tr.methodValuation(isTN, fmtPrice(t2.revenueTransfer, lang))}<br>` : ""}
      ${tr.methodAccuracy(cmp.nScraps)}<br>
      ${tr.generatedAt(fmtDateTime(cmp.generatedAt, lang))}
    </p>
  </div>
</body></html>`;
}

module.exports = { buildSalesHtml };
