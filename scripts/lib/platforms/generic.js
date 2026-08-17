// Adapter genérico (fallback universal): cualquier tienda con sitemap + datos
// estructurados estándar (JSON-LD schema.org/Product, Open Graph, microdata de
// precio). Cubre Magento, PrestaShop, VTEX, Wix, BigCommerce, tiendas a medida…
//
// Estrategia: descubrir URLs de producto vía sitemap (o robots.txt → Sitemap:),
// filtrar por patrones típicos de URL de producto, y si no hay patrón, muestrear
// páginas y quedarse con las que tengan JSON-LD Product.
//
// Limitación honesta: casi ninguna plataforma expone stock numérico en JSON-LD
// (stockTotal = null); la disponibilidad sale de offers.availability.

const { fetchText, mapLimit } = require("../net");
const {
  jsonLdBlocks,
  isType,
  metaContent,
  parsePrice,
  fmtPriceShort,
  stripTags,
} = require("../normalize");

// Rutas típicas de producto: /product/x, /productos/x, /p/x, /item/x…
// más el estilo VTEX (…/slug/p) y Falabella (…-p-12345).
const PRODUCT_PATH = /\/(producto?s?|product|prod|item|itm|p)\/[^/]+|\/p(\/?$|\.html)|-p-\d+/i;
const SAMPLE_MAX = 300; // tope de páginas a muestrear si el sitemap no distingue productos

function sniff() {
  return true; // siempre matchea: es el fallback
}

async function collectSitemapUrls(base, log) {
  const seeds = [];
  // robots.txt puede declarar el/los sitemaps reales
  try {
    const robots = await fetchText(base + "/robots.txt");
    for (const m of robots.text.matchAll(/^\s*sitemap:\s*(\S+)/gim)) seeds.push(m[1]);
  } catch {}
  for (const p of ["/sitemap.xml", "/sitemap_index.xml", "/wp-sitemap.xml"]) {
    seeds.push(base + p);
  }

  const seen = new Set();
  const urls = new Set();
  const queue = [...new Set(seeds)];
  let fetched = 0;
  while (queue.length && fetched < 60) {
    const sm = queue.shift();
    if (seen.has(sm)) continue;
    seen.add(sm);
    let r;
    try {
      r = await fetchText(sm);
    } catch {
      continue;
    }
    fetched++;
    if (!r.text.includes("<loc")) continue;
    const locs = [...r.text.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    if (/<sitemapindex/i.test(r.text)) {
      for (const l of locs) if (/\.xml($|\?)/.test(l)) queue.push(l);
    } else {
      for (const l of locs) urls.add(l);
    }
  }
  log(`· sitemap: ${urls.size} URLs descubiertas`);
  return [...urls];
}

// Normaliza un nodo Offer / AggregateOffer / array de offers.
function readOffers(offers) {
  const out = { min: null, max: null, currency: null, available: null };
  const list = Array.isArray(offers) ? offers : offers ? [offers] : [];
  for (const o of list) {
    if (!o || typeof o !== "object") continue;
    const cands = [o.price, o.lowPrice, o.highPrice].map(parsePrice).filter((n) => n != null);
    for (const n of cands) {
      out.min = out.min == null ? n : Math.min(out.min, n);
      out.max = out.max == null ? n : Math.max(out.max, n);
    }
    if (!out.currency && typeof o.priceCurrency === "string") out.currency = o.priceCurrency;
    const av = String(o.availability || "");
    if (av) {
      const inStock = /InStock|LimitedAvailability|OnlineOnly|PreOrder/i.test(av);
      out.available = out.available || inStock;
    }
  }
  return out;
}

// Parsea una página de producto genérica. Devuelve null si no hay señal de producto.
function parseProduct(html, url) {
  const blocks = jsonLdBlocks(html);
  const ogTitle = metaContent(html, "og:title");
  // Anti falso-positivo: los carruseles de "relacionados" también embeben JSON-LD
  // Product; nos quedamos con el que matchea el og:title, o el primero si no hay og.
  const productNodes = blocks.filter((b) => isType(b, "Product"));
  let node =
    productNodes.find(
      (p) => ogTitle && p.name && ogTitle.toLowerCase().startsWith(String(p.name).toLowerCase().slice(0, 20))
    ) || productNodes[0];

  const ogType = metaContent(html, "og:type");
  const ogPrice = parsePrice(
    metaContent(html, "product:price:amount") || metaContent(html, "og:price:amount")
  );
  const ogCurrency =
    metaContent(html, "product:price:currency") || metaContent(html, "og:price:currency");

  if (!node && !(ogType && /product/i.test(ogType)) && ogPrice == null) return null;
  node = node || {};

  const offers = readOffers(node.offers);
  const min = offers.min ?? ogPrice;
  const max = offers.max ?? ogPrice;
  if (min == null && max == null) return null; // sin precio no hay producto útil

  const name =
    (node.name && stripTags(String(node.name))) || ogTitle || metaContent(html, "og:site_name") || url;
  const image = Array.isArray(node.image) ? node.image[0] : node.image;
  const brand =
    (node.brand && (typeof node.brand === "string" ? node.brand : node.brand.name)) || "";
  const description = stripTags(
    String(node.description || metaContent(html, "og:description") || "")
  );

  let crumbs = [];
  const bc = blocks.find((b) => isType(b, "BreadcrumbList"));
  if (bc && Array.isArray(bc.itemListElement)) {
    crumbs = bc.itemListElement
      .map((it) => (it && (it.name || (it.item && it.item.name))) || null)
      .filter(Boolean)
      .slice(0, -1);
  }

  const idSource = node.productID || node.sku || (node.offers && node.offers.sku);
  const available =
    offers.available != null ? offers.available : !/agotado|sold\s*out|out of stock/i.test(html);

  return {
    id: String(idSource || url.replace(/\/+$/, "").split("/").pop()),
    name,
    brand: typeof brand === "string" ? brand : "",
    url,
    crumbs,
    seoTitle: (html.match(/<title>([^<]*)<\/title>/i) || [])[1] || name,
    metaDescription: (metaContent(html, "description") || "").slice(0, 300),
    description,
    mainImage: typeof image === "string" ? image : (image && image.url) || null,
    priceShort: fmtPriceShort(min) || "—",
    price: min,
    minPrice: min,
    maxPrice: max,
    compareShort: null,
    promoShort: null,
    payDiscount: null,
    stockTotal: null,
    soldQty: null,
    available,
    sizeOptionName: "Variante",
    variants: [],
    currency: offers.currency || ogCurrency || null,
  };
}

async function getCatalog(base, ctx) {
  const all = await collectSitemapUrls(base, ctx.log);
  if (!all.length) {
    throw new Error(
      "No encontré sitemap en esta tienda (ni en robots.txt). Sin sitemap no puedo descubrir el catálogo genérico."
    );
  }

  let candidates = all.filter((u) => PRODUCT_PATH.test(u.replace(base, "")));
  let sampled = false;
  if (!candidates.length) {
    sampled = true;
    candidates = all.filter((u) => u.startsWith(base)).slice(0, SAMPLE_MAX);
    ctx.log(
      `⚠ El sitemap no tiene rutas típicas de producto; muestreo ${candidates.length} páginas buscando JSON-LD Product.`
    );
  }
  candidates = [...new Set(candidates)].sort();
  if (ctx.limit !== Infinity) candidates = candidates.slice(0, sampled ? SAMPLE_MAX : ctx.limit);
  ctx.log(`· ${candidates.length} URLs candidatas (concurrencia ${ctx.concurrency})`);

  let done = 0;
  let currency = null;
  const products = [];
  await mapLimit(candidates, ctx.concurrency, async (url) => {
    if (products.length >= ctx.limit) return;
    try {
      const key = url.replace(base, "").replace(/[^a-z0-9]+/gi, "_").slice(0, 120) + ".html";
      let html = !ctx.fresh ? ctx.cache.get(key) : null;
      const fromCache = html != null;
      if (html == null) {
        html = (await fetchText(url)).text;
        ctx.cache.put(key, html);
      }
      let p = parseProduct(html, url);
      if (!p && fromCache) {
        // cache corrupto/viejo: re-bajamos la página una vez
        html = (await fetchText(url)).text;
        ctx.cache.put(key, html);
        p = parseProduct(html, url);
      }
      if (p) {
        if (!currency && p.currency) currency = p.currency;
        delete p.currency;
        products.push(p);
        ctx.progress(`${++done} productos  ${p.name.slice(0, 38)}`);
      }
    } catch (err) {
      if (!/HTTP 404/.test(err.message)) ctx.log(`  ! ${url}: ${err.message}`);
    }
  });

  if (!products.length) {
    throw new Error(
      "No encontré productos con datos estructurados (JSON-LD/Open Graph) en esta tienda. " +
        "Puede que la tienda cargue el catálogo por JavaScript sin datos estructurados."
    );
  }
  const sliced = ctx.limit !== Infinity ? products.slice(0, ctx.limit) : products;
  return { products: sliced, currency };
}

module.exports = {
  id: "generic",
  label: "Genérica (datos estructurados)",
  hasNumericStock: false,
  sniff,
  getCatalog,
  parseProduct,
  collectSitemapUrls,
  PRODUCT_PATH,
};
