// Textos fijos de la interfaz de los reportes (labels, encabezados, notas al
// pie). NO traduce el contenido scrapeado: nombres de producto, marca,
// descripciones y categorías quedan tal cual los expone la tienda — traducirlos
// automáticamente daría resultados poco confiables para un reporte de datos.
//
// Uso: const t = require("./i18n")(lang);  t.summary  // -> "Resumen" | "Summary"

const LOCALE = { es: "es-AR", en: "en-US" };

const DICT = {
  es: {
    htmlLang: "es",
    locale: LOCALE.es,
    unit: "u.",

    // --- catálogo: portada ---
    catalogTitle: (brand) => `Scrap ${brand}`,
    scrapedFrom: (host, platform) => `Catálogo scrapeado desde ${host} · ${platform}`,
    productsCount: (n) => `${n} productos`,
    stockTotalInline: (n) => `stock total ${n} u.`,
    priceRangeInline: (min, max) => `rango ${min}–${max}`,

    // --- catálogo: resumen ---
    summary: "Resumen",
    scrapedProducts: "Productos scrapeados",
    stockTotalUnits: "Stock total (unidades)",
    numericStock: "Stock numérico",
    numericStockNotPublic: "no público en esta plataforma (solo disponibilidad)",
    availableProducts: "Productos disponibles",
    outOfStockProducts: "Productos agotados",
    priceRange: "Rango de precios",
    source: "Fuente",
    scrapedAt: "Fecha y hora del scrap",
    fieldsExtracted: "Campos extraídos por producto",
    fieldsExtractedBody:
      "(según lo que la plataforma hace público): ID, nombre, marca, URL, breadcrumb " +
      "(categoría), título SEO, meta description, descripción, imagen principal, precio " +
      "(mínimo y máximo), precio promocional, compare-at price, descuento por pago, " +
      "unidades vendidas, disponibilidad, y por cada variante: talle/opciones, SKU, stock e imagen.",

    // --- catálogo: grilla y detalle ---
    productGrid: "Grilla de productos",
    productGridSub: "Vista resumida de todos los productos. Detalle ampliado en la sección siguiente.",
    productDetail: "Detalle por producto",
    productDetailSub: "Ficha completa con tabla de variantes, stock por talle, precios y SEO.",
    stockLabel: "Stock",
    outOfStock: "SIN STOCK",
    soldOut: "AGOTADO",
    available: "Disponible",
    stockUnits: (n) => `Stock: ${n} u.`,
    brandField: "Marca",
    categoryField: "Categoría",
    idField: "ID",
    productId: "ID producto",
    urlField: "URL",
    variantsField: "Variantes",
    stockTotalParen: (n) => ` (stock total: ${n} u.)`,
    sold: "Vendidas",
    seoTitle: "SEO title",
    metaDescription: "Meta description",
    description: "Descripción",
    variantsAndStock: "Variantes y stock",
    sku: "SKU",
    availabilityShort: "Disp.",
    price: "Precio",
    promo: "Promo",
    compareAt: "Compare-at",
    payDiscountNote: (v) => `<b>Precio con descuento por pago:</b> ${v} (transferencia / efectivo)`,

    // --- ventas: portada ---
    salesKicker: "Reporte de ventas · estimación",
    salesTitle: (brand) => `${brand} — Ventas del período`,
    salesSubtitle: (from, to, days, n) => `${from} → ${to} · ${days} días · ${n} scraps comparados`,
    unitsSold: "Unidades vendidas",
    revenueList: "Facturación (lista)",
    avgTicket: "Ticket promedio",
    outOfStockProductsShort: "Productos agotados",
    backInStock: "Volvieron a stock",
    activeProducts: "Productos activos",

    // --- ventas: callouts ---
    calloutUnitsTitle: "Estimación sobre datos públicos de la tienda",
    calloutUnitsIntro: ", no es la caja real de la marca.",
    calloutUnitsSoldQty:
      "Combina el contador público de unidades vendidas (<code>sold_qty</code>) con la caída " +
      "de stock entre scraps: se usa la mejor señal por producto.",
    calloutUnitsStockOnly: "Se mide la caída de stock de cada producto entre cada par de scraps: lo que bajó, se vendió.",
    calloutUnitsFloor:
      "Es un <b>piso</b> — las ventas reales pueden ser mayores (no capta reposiciones no " +
      "observadas ni productos reactivados).",
    calloutNoStockTitle: "Esta plataforma no publica stock numérico",
    calloutNoStockBody:
      " (solo disponibilidad por producto). El reporte detecta <b>qué se agotó y qué volvió " +
      "a stock</b> entre scraps, pero no puede contar unidades vendidas. Para unidades y " +
      "facturación estimadas se necesita una tienda que exponga stock (ej. Tienda Nube).",

    // --- ventas: métricas ---
    execSummary: "Resumen ejecutivo",
    perDay: (v) => `${v} u/día`,
    perDayRevenue: "/día",
    revenueTransfer: "Facturación — transferencia",
    revenueTransferSub: "−10% pago efectivo/transf.",
    monthlyProjection: "Proyección mensual",
    monthlyProjectionSub: "extrapolado del ritmo",
    perUnit: "por unidad",
    dischargedProducts: (n) => `${n} dados de baja`,
    soldOutInPeriod: "Se agotaron en el período",
    soldOutInPeriodSub: "disponible → agotado",
    backInStockSub: "agotado → disponible",

    // --- ventas: evolución / tablas ---
    periodEvolution: "Evolución período a período",
    periodEvolutionHint: "— seguimiento entre scraps",
    thPeriod: "Período",
    thDays: "Días",
    thUnits: "Unidades",
    thRevenueList: "Facturación (lista)",
    thUnitsPerDay: "u/día",
    topSold: "Más vendidos del período",
    topSoldHint: "— por unidades",
    topRevenue: "Lo que más facturó",
    topRevenueHint: "— unidades × precio de lista",
    periodDetail: "Detalle de ventas del período",
    periodDetailSub: "Productos con ventas detectadas entre el primer y el último scrap.",
    thProduct: "Producto",
    thSold: "Vendidas",
    thStockRange: "Stock inicio → fin",

    // --- ventas: por qué el número real es mayor ---
    whyHigher: "Por qué el número real es mayor",
    restocksDetected: "Reposiciones detectadas",
    restocksIntro: "Entró stock nuevo → vendieron <i>y</i> repusieron:",
    restocksNone: "(ninguna detectada)",
    reactivated: "Productos reactivados",
    reactivatedIntro: "Aparecieron después del primer scrap (su histórico no es del período):",
    reactivatedNone: "(ninguno)",
    historicalUnits: "u. histórico",
    today: "hoy",
    soldOutWord: "agotado",

    // --- ventas: rotación de disponibilidad ---
    availabilityTurnover: "Rotación de disponibilidad",
    availabilityTurnoverHint: "— entre el primer y el último scrap",
    wentOutOfStock: (n) => `Se agotaron (${n})`,
    cameBackInStock: (n) => `Volvieron a stock (${n})`,
    none: "(ninguno)",

    // --- ventas: tamaño de la marca ---
    brandSize: "Tamaño de la marca",
    brandSizeHint: "— histórico acumulado, no del período",
    lifetimeUnits: "Unidades vendidas en toda la vida de la tienda",
    lifetimeUnitsSub: "acumulado de los productos vivos (contador <code>sold_qty</code> público de Tienda Nube)",
    historicalBestsellers: "Best-sellers históricos",
    thSoldTotal: "Vendidas (total)",

    // --- ventas: método y límites ---
    methodAndLimits: "Método y límites",
    methodHow: "<b>Cómo se calcula:</b> se cruzan los scraps por ID de producto y se ordenan por su fecha/hora de generación.",
    methodSoldQty:
      "Por producto se usa la mejor señal pública disponible: el delta del contador de " +
      "unidades vendidas (<code>sold_qty</code>, exacto y capta reposiciones) o la caída de " +
      "stock entre fechas (piso).",
    methodStockOnly: "La caída de stock entre dos fechas se cuenta como ventas.",
    methodAvailabilityOnly: "Sin stock numérico público, se registran las transiciones de disponibilidad (disponible → agotado y viceversa).",
    methodNotRealBooks: "<b>No es la caja real</b>: es inferencia sobre los datos públicos que expone la tienda.",
    methodWhyFloor:
      "<b>Por qué es un piso:</b> asume que no hubo reposición salvo las detectadas. Si la " +
      "marca repuso stock de otros productos, las ventas reales son mayores.",
    methodValuation: (isTN, transferAmount) =>
      `<b>Valorización:</b> a precio de lista al inicio de cada período${
        isTN ? `; con pago por transferencia/efectivo (−10%) la facturación baja a ${transferAmount}` : ""
      }.`,
    methodAccuracy: (n) =>
      `<b>Precisión:</b> cuantos más scraps y más seguidos, menos chance de reposiciones ocultas → estimación más exacta. Este reporte usa ${n} scraps.`,
    generatedAt: (d) => `<b>Generado:</b> ${d}.`,
  },

  en: {
    htmlLang: "en",
    locale: LOCALE.en,
    unit: "u.",

    // --- catalog: cover ---
    catalogTitle: (brand) => `Scrap ${brand}`,
    scrapedFrom: (host, platform) => `Catalog scraped from ${host} · ${platform}`,
    productsCount: (n) => `${n} products`,
    stockTotalInline: (n) => `total stock ${n} u.`,
    priceRangeInline: (min, max) => `range ${min}–${max}`,

    // --- catalog: summary ---
    summary: "Summary",
    scrapedProducts: "Scraped products",
    stockTotalUnits: "Total stock (units)",
    numericStock: "Numeric stock",
    numericStockNotPublic: "not public on this platform (availability only)",
    availableProducts: "Available products",
    outOfStockProducts: "Out-of-stock products",
    priceRange: "Price range",
    source: "Source",
    scrapedAt: "Scraped at",
    fieldsExtracted: "Fields extracted per product",
    fieldsExtractedBody:
      "(as made public by the platform): ID, name, brand, URL, breadcrumb (category), SEO " +
      "title, meta description, description, main image, price (min and max), promotional " +
      "price, compare-at price, payment discount, units sold, availability, and per variant: " +
      "size/option, SKU, stock and image.",

    // --- catalog: grid and detail ---
    productGrid: "Product grid",
    productGridSub: "Summary view of all products. Expanded detail in the next section.",
    productDetail: "Product detail",
    productDetailSub: "Full record with variant table, stock per size, prices and SEO.",
    stockLabel: "Stock",
    outOfStock: "OUT OF STOCK",
    soldOut: "SOLD OUT",
    available: "Available",
    stockUnits: (n) => `Stock: ${n} u.`,
    brandField: "Brand",
    categoryField: "Category",
    idField: "ID",
    productId: "Product ID",
    urlField: "URL",
    variantsField: "Variants",
    stockTotalParen: (n) => ` (total stock: ${n} u.)`,
    sold: "Sold",
    seoTitle: "SEO title",
    metaDescription: "Meta description",
    description: "Description",
    variantsAndStock: "Variants and stock",
    sku: "SKU",
    availabilityShort: "Avail.",
    price: "Price",
    promo: "Promo",
    compareAt: "Compare-at",
    payDiscountNote: (v) => `<b>Payment discount price:</b> ${v} (bank transfer / cash)`,

    // --- sales: cover ---
    salesKicker: "Sales report · estimate",
    salesTitle: (brand) => `${brand} — Sales over the period`,
    salesSubtitle: (from, to, days, n) => `${from} → ${to} · ${days} days · ${n} scraps compared`,
    unitsSold: "Units sold",
    revenueList: "Revenue (list price)",
    avgTicket: "Average ticket",
    outOfStockProductsShort: "Out-of-stock products",
    backInStock: "Back in stock",
    activeProducts: "Active products",

    // --- sales: callouts ---
    calloutUnitsTitle: "Estimate based on the store's public data",
    calloutUnitsIntro: ", not the brand's real books.",
    calloutUnitsSoldQty:
      "Combines the public units-sold counter (<code>sold_qty</code>) with the stock drop " +
      "between scraps: the best signal per product is used.",
    calloutUnitsStockOnly: "The stock drop of each product between each pair of scraps is measured: what went down, sold.",
    calloutUnitsFloor:
      "This is a <b>floor</b> — real sales may be higher (it doesn't capture unobserved " +
      "restocks or reactivated products).",
    calloutNoStockTitle: "This platform doesn't publish numeric stock",
    calloutNoStockBody:
      " (availability per product only). The report detects <b>what sold out and what came " +
      "back in stock</b> between scraps, but can't count units sold. Estimated units and " +
      "revenue need a store that exposes stock (e.g. Tienda Nube).",

    // --- sales: metrics ---
    execSummary: "Executive summary",
    perDay: (v) => `${v} u/day`,
    perDayRevenue: "/day",
    revenueTransfer: "Revenue — bank transfer",
    revenueTransferSub: "−10% cash/transfer payment",
    monthlyProjection: "Monthly projection",
    monthlyProjectionSub: "extrapolated from the current pace",
    perUnit: "per unit",
    dischargedProducts: (n) => `${n} discontinued`,
    soldOutInPeriod: "Sold out in the period",
    soldOutInPeriodSub: "available → sold out",
    backInStockSub: "sold out → available",

    // --- sales: trend / tables ---
    periodEvolution: "Period-over-period evolution",
    periodEvolutionHint: "— tracking between scraps",
    thPeriod: "Period",
    thDays: "Days",
    thUnits: "Units",
    thRevenueList: "Revenue (list price)",
    thUnitsPerDay: "u/day",
    topSold: "Best sellers of the period",
    topSoldHint: "— by units",
    topRevenue: "Top revenue",
    topRevenueHint: "— units × list price",
    periodDetail: "Sales detail for the period",
    periodDetailSub: "Products with sales detected between the first and last scrap.",
    thProduct: "Product",
    thSold: "Sold",
    thStockRange: "Stock start → end",

    // --- sales: why the real number is higher ---
    whyHigher: "Why the real number is higher",
    restocksDetected: "Restocks detected",
    restocksIntro: "New stock came in → they sold <i>and</i> restocked:",
    restocksNone: "(none detected)",
    reactivated: "Reactivated products",
    reactivatedIntro: "Appeared after the first scrap (their historical total isn't from this period):",
    reactivatedNone: "(none)",
    historicalUnits: "u. historical",
    today: "today",
    soldOutWord: "sold out",

    // --- sales: availability turnover ---
    availabilityTurnover: "Availability turnover",
    availabilityTurnoverHint: "— between the first and last scrap",
    wentOutOfStock: (n) => `Sold out (${n})`,
    cameBackInStock: (n) => `Back in stock (${n})`,
    none: "(none)",

    // --- sales: brand size ---
    brandSize: "Brand size",
    brandSizeHint: "— lifetime total, not from this period",
    lifetimeUnits: "Units sold in the store's lifetime",
    lifetimeUnitsSub: "cumulative across live products (Tienda Nube's public <code>sold_qty</code> counter)",
    historicalBestsellers: "Historical best sellers",
    thSoldTotal: "Sold (total)",

    // --- sales: method and limits ---
    methodAndLimits: "Method and limits",
    methodHow: "<b>How it's calculated:</b> scraps are matched by product ID and sorted by their generation date/time.",
    methodSoldQty:
      "For each product, the best public signal available is used: the delta of the units-" +
      "sold counter (<code>sold_qty</code>, exact and captures restocks) or the stock drop " +
      "between dates (floor).",
    methodStockOnly: "The stock drop between two dates is counted as sales.",
    methodAvailabilityOnly: "Without public numeric stock, availability transitions are recorded (available → sold out and back).",
    methodNotRealBooks: "<b>Not the real books</b>: it's inference over the public data the store exposes.",
    methodWhyFloor:
      "<b>Why it's a floor:</b> it assumes there was no restock other than the ones detected. " +
      "If the brand restocked other products, real sales are higher.",
    methodValuation: (isTN, transferAmount) =>
      `<b>Valuation:</b> at list price at the start of each period${
        isTN ? `; with bank transfer/cash payment (−10%) revenue drops to ${transferAmount}` : ""
      }.`,
    methodAccuracy: (n) =>
      `<b>Accuracy:</b> more scraps, closer together, means less chance of hidden restocks → a more accurate estimate. This report uses ${n} scraps.`,
    generatedAt: (d) => `<b>Generated:</b> ${d}.`,
  },
};

const SUPPORTED = Object.keys(DICT);

function t(lang) {
  return DICT[lang] || DICT.es;
}

module.exports = { t, SUPPORTED };
