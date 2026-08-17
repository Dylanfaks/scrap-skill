// Adapter Tienda Nube (Nuvemshop). La plataforma embebe el catálogo completo en
// el HTML de cada ficha (objeto de producto + LS.variants), sin necesidad de auth:
// precios, stock por variante y hasta unidades vendidas (sold_qty).
//
// Señal de detección: LS.product / LS.variants / CDN mitiendanube.

const { fetchText, mapLimit } = require("../net");
const {
  decodeEntities,
  extractBalanced,
  stripTags,
  resolveImg,
} = require("../normalize");

// Prefijos de país que cuelgan de una tienda TN; solo queremos el catálogo local.
const COUNTRY_SEG = /\/(ad|bo|br|ca|cl|co|cr|de|ec|es|fr|gb|gt|hk|it|jp|mx|nl|nz|pe|pr|pt|py|us|uy|au)\//;

function sniff(html) {
  return /LS\.product\s*=|LS\.variants\s*=|mitiendanube\.com|cdn\.tiendanube|window\.LS\b/.test(
    html || ""
  );
}

// Lista de URLs de productos del catálogo local (sin prefijo de país).
async function getProductUrls(base) {
  const sm = await fetchText(base + "/sitemap.xml");
  // Tienda Nube redirige todo a /password/ cuando la tienda está cerrada (pre-drop / mantenimiento).
  if (/\/password/.test(sm.finalUrl || "") || !sm.text.includes("<loc")) {
    const e = new Error(
      "La tienda está cerrada temporalmente (página de contraseña de Tienda Nube). Probá de nuevo cuando reabra."
    );
    e.code = "STORE_CLOSED";
    throw e;
  }
  const text = sm.text;
  const locs = [...text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  // ¿Es un índice de sitemaps? Entonces bajamos cada sub-sitemap.
  let allLocs = locs;
  if (/<sitemapindex/i.test(text)) {
    allLocs = [];
    const childMaps = locs.filter((l) => /\.xml($|\?)/.test(l)).slice(0, 50);
    for (const child of childMaps) {
      try {
        const r = await fetchText(child);
        allLocs.push(...[...r.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
      } catch {}
    }
  }

  const prefix = base + "/productos/";
  const urls = allLocs.filter(
    (u) => u.startsWith(prefix) && u.length > prefix.length && !COUNTRY_SEG.test(u.slice(base.length))
  );
  return [...new Set(urls)].sort();
}

const fmtPriceLocal = (n) =>
  n == null ? "—" : "$" + Math.round(Number(n)).toLocaleString("es-AR");
const cleanShort = (s) => (s ? s.replace(/,00$/, "") : s || null);

// Extrae y normaliza un producto desde el HTML de su ficha.
function parseProduct(html, url, base) {
  const lsIdx = html.indexOf("LS.product =");
  let productId = null;
  if (lsIdx >= 0) {
    const obj = extractBalanced(html, html.indexOf("{", lsIdx));
    const m = obj && obj.match(/id\s*:\s*(\d+)/);
    if (m) productId = m[1];
  }
  if (!productId) {
    const m = html.match(/{"id":(\d+),"name":/);
    if (m) productId = m[1];
  }
  if (!productId) throw new Error("no encontré product id");

  const pStart = html.indexOf(`{"id":${productId},"name":`);
  if (pStart < 0) throw new Error("no encontré objeto de producto");
  const product = JSON.parse(extractBalanced(html, pStart));

  const vIdx = html.indexOf("LS.variants = [");
  const variantsRaw = vIdx >= 0 ? extractBalanced(html, html.indexOf("[", vIdx)) : "[]";
  const variants = JSON.parse(variantsRaw);

  const md = html.match(/<meta name="description" content="([^"]*)"/);
  const metaDescription = md ? decodeEntities(md[1]).trim() : "";

  // descripción completa (supera a la meta en productos con guía de talles, etc.)
  let description = metaDescription;
  const descOpen = html.search(/<div[^>]*product-description[^>]*>/i);
  if (descOpen >= 0) {
    const tagEnd = html.indexOf(">", descOpen);
    let depth = 1;
    const re = /<\/?div\b[^>]*>/gi;
    re.lastIndex = tagEnd + 1;
    let mm;
    while ((mm = re.exec(html))) {
      depth += mm[0][1] === "/" ? -1 : 1;
      if (depth === 0) {
        const body = stripTags(html.slice(tagEnd + 1, mm.index));
        if (body.length > description.length) description = body;
        break;
      }
    }
  }

  // breadcrumb / categoría desde el JSON-LD BreadcrumbList (descartando el producto)
  let crumbs = [];
  const ldIdx = html.indexOf("BreadcrumbList");
  if (ldIdx >= 0) {
    const seg = html.slice(ldIdx, ldIdx + 900);
    const names = [...seg.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map((m) =>
      decodeEntities(m[1].trim())
    );
    if (names.length > 1) crumbs = names.slice(0, -1);
  }

  const sizeOptionName =
    (product.default_options && product.default_options[0] && product.default_options[0].name) ||
    "Talle";

  const vlist = variants.map((v) => ({
    size: v.option0 != null ? String(v.option0) : "—",
    sku: v.sku || "",
    stock: typeof v.stock === "number" ? v.stock : v.stock == null ? null : Number(v.stock),
    available: !!v.available,
    priceNumber: typeof v.price_number === "number" ? v.price_number : null,
    priceShort: cleanShort(v.price_short),
    promoShort:
      v.has_promotional_price && v.promotional_price_short
        ? cleanShort(v.promotional_price_short)
        : null,
    compareShort: v.compare_at_price_short ? cleanShort(v.compare_at_price_short) : null,
    payDiscountShort: v.price_with_payment_discount_short || null,
    image: resolveImg(v.image_url),
  }));

  const stockTotal =
    typeof product.stock === "number"
      ? product.stock
      : vlist.reduce((a, v) => a + (v.stock || 0), 0);

  const priceNums = vlist.map((v) => v.priceNumber).filter((n) => typeof n === "number");
  // OJO histórico: price/min_price del objeto producto vienen en CENTAVOS (×100);
  // los *_number de las variantes ya están en pesos reales.
  const minPrice = priceNums.length ? Math.min(...priceNums) : (product.price || 0) / 100;
  const maxPrice = priceNums.length ? Math.max(...priceNums) : (product.price || 0) / 100;

  const mainImage = (vlist.find((v) => v.image) || {}).image || resolveImg(product.featured_image);
  const payDiscount = (vlist.find((v) => v.payDiscountShort) || {}).payDiscountShort || null;

  return {
    id: productId,
    name: decodeEntities(product.name || ""),
    brand: product.brand || "",
    url: product.canonical_url ? base + product.canonical_url.replace(base, "") : url,
    crumbs,
    seoTitle: decodeEntities(product.seo_title || ""),
    metaDescription,
    description,
    mainImage,
    priceShort: (vlist.find((v) => v.priceShort) || {}).priceShort || fmtPriceLocal(minPrice),
    price: minPrice,
    minPrice,
    maxPrice,
    compareShort: (vlist.find((v) => v.compareShort) || {}).compareShort || null,
    promoShort: (vlist.find((v) => v.promoShort) || {}).promoShort || null,
    payDiscount,
    stockTotal,
    soldQty: product.sold_qty ?? null,
    available: stockTotal > 0,
    sizeOptionName,
    variants: vlist.map(({ priceNumber, ...keep }) => keep), // priceNumber era interno
  };
}

// Moneda del catálogo, desde el JSON-LD de una ficha ("priceCurrency":"ARS").
function currencyFromHtml(html) {
  const m = html.match(/"priceCurrency"\s*:\s*"([A-Z]{3})"/);
  return m ? m[1] : null;
}

// Baja el catálogo completo. ctx: { limit, fresh, concurrency, cache, log }.
// cache = { get(key), put(key, text), keys() } manejado por scrape.js.
async function getCatalog(base, ctx) {
  let urls = [];
  let storeClosed = false;
  try {
    urls = await getProductUrls(base);
  } catch (e) {
    if (e.code === "STORE_CLOSED") storeClosed = true;
    else throw e;
  }

  // Si la tienda está cerrada pero tenemos fichas en cache, regeneramos desde ahí.
  const cachedKeys = ctx.cache.keys().filter((k) => k.endsWith(".html"));
  if (!urls.length && !ctx.fresh && cachedKeys.length) {
    urls = cachedKeys.map((f) => base + "/productos/" + f.replace(/\.html$/, "") + "/");
    ctx.log(
      `⚠ ${storeClosed ? "Tienda cerrada" : "Sitemap vacío"}: regenerando desde ${urls.length} fichas en cache.`
    );
  }
  if (!urls.length) {
    throw new Error(
      storeClosed
        ? "La tienda está cerrada temporalmente (Tienda Nube /password) y no hay cache previo. Probá cuando reabra."
        : "No encontré productos en el sitemap de esta tienda."
    );
  }
  if (ctx.limit !== Infinity) urls = urls.slice(0, ctx.limit);
  ctx.log(`· ${urls.length} productos a scrapear (concurrencia ${ctx.concurrency})`);

  let done = 0;
  let currency = null;
  const products = (
    await mapLimit(urls, ctx.concurrency, async (url) => {
      try {
        const key = url.replace(/.*\/productos\//, "").replace(/[^a-z0-9]+/gi, "_") + ".html";
        let html = !ctx.fresh ? ctx.cache.get(key) : null;
        let fromCache = html != null;
        if (html == null) {
          html = (await fetchText(url)).text;
          ctx.cache.put(key, html);
        }
        let p;
        try {
          p = parseProduct(html, url, base);
        } catch (err) {
          if (!fromCache) throw err;
          // cache corrupto/viejo: re-bajamos la ficha una vez
          html = (await fetchText(url)).text;
          ctx.cache.put(key, html);
          p = parseProduct(html, url, base);
        }
        if (!currency) currency = currencyFromHtml(html);
        ctx.progress(`${++done}/${urls.length}  ${p.name.slice(0, 38)}`);
        return p;
      } catch (err) {
        ctx.log(`  ! ${url.split("/productos/")[1] || url}: ${err.message}`);
        return null;
      }
    })
  ).filter(Boolean);

  return { products, currency };
}

module.exports = {
  id: "tiendanube",
  label: "Tienda Nube",
  hasNumericStock: true,
  sniff,
  getCatalog,
  // internos exportados para tests / reuso
  getProductUrls,
  parseProduct,
  COUNTRY_SEG,
};
