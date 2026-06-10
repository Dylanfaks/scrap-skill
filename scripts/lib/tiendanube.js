// Scraper de tiendas Tienda Nube. Tienda Nube embebe el catálogo completo en el
// HTML de cada ficha (objeto de producto + LS.variants), sin necesidad de auth.
//
// Exporta: detectStore (resuelve la tienda y la marca), getProductUrls (sitemap),
// parseProduct (normaliza una ficha) y fetchText (con manejo de rate limit / 404).

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Prefijos de país que cuelgan de una tienda TN; solo queremos el catálogo local.
const COUNTRY_SEG = /\/(ad|bo|br|ca|cl|co|cr|de|ec|es|fr|gb|gt|hk|it|jp|mx|nl|nz|pe|pr|pt|py|us|uy|au)\//;

async function fetchText(url, tries = 6) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9" },
        redirect: "follow",
      });
      if (res.status === 429) {
        if (attempt === tries) throw new Error("HTTP 429 (rate limit)");
        const ra = parseInt(res.headers.get("retry-after") || "", 10);
        await sleep(Number.isFinite(ra) ? ra * 1000 : 1500 * attempt);
        continue;
      }
      if (res.status === 404) throw new Error("HTTP 404");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { text: await res.text(), finalUrl: res.url };
    } catch (err) {
      if (attempt === tries || /HTTP 404/.test(err.message)) throw err;
      await sleep(800 * attempt);
    }
  }
}

// ¿El HTML es de una tienda Tienda Nube?
function isTiendaNube(html) {
  return /LS\.product\s*=|LS\.variants\s*=|mitiendanube\.com|cdn\.tiendanube|window\.LS\b/.test(html);
}

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&aacute;/g, "á")
    .replace(/&eacute;/g, "é")
    .replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó")
    .replace(/&uacute;/g, "ú")
    .replace(/&ntilde;/g, "ñ");
}

function brandFromHtml(html, base) {
  const og = html.match(/<meta property="og:site_name" content="([^"]+)"/);
  if (og) return decodeEntities(og[1].trim());
  const title = html.match(/<title>([^<]+)<\/title>/);
  if (title) {
    // "... - Comprar en TwoHip" / "TwoHip" / "Inicio - TwoHip"
    const t = decodeEntities(title[1]);
    const m = t.match(/(?:Comprar en|[-–|])\s*([^-–|]+)\s*$/);
    if (m && m[1].trim().length > 1) return m[1].trim();
    return t.split(/[-–|]/).pop().trim() || t.trim();
  }
  return new URL(base).hostname.replace(/^www\./, "").split(".")[0];
}

// Normaliza la URL de entrada y resuelve a una tienda Tienda Nube real.
// Devuelve { base, brand }. Tira un error claro si no es Tienda Nube.
async function detectStore(input) {
  let url = String(input).trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  url = url.replace(/\/+$/, "");

  const candidates = [url];
  // heurística: marca.com suele tener su tienda en marca.store
  try {
    const u = new URL(url);
    if (/\.com$/.test(u.hostname)) {
      candidates.push(u.origin.replace(/\.com$/, ".store"));
      candidates.push(u.origin.replace(/\.com$/, ".com.ar"));
    }
  } catch {}

  let homepageHtml = null;
  for (const cand of candidates) {
    let r;
    try {
      r = await fetchText(cand);
    } catch {
      continue;
    }
    if (isTiendaNube(r.text)) {
      const base = new URL(r.finalUrl || cand).origin;
      return { base, brand: brandFromHtml(r.text, base) };
    }
    if (!homepageHtml) homepageHtml = r.text;
  }

  // último intento: buscar en la home un link a una tienda .store / mitiendanube
  if (homepageHtml) {
    const link = homepageHtml.match(/https?:\/\/[a-z0-9.-]+\.(?:store|com\.ar|mitiendanube\.com)[^"'\s)]*/i);
    if (link) {
      try {
        const r = await fetchText(new URL(link[0]).origin);
        if (isTiendaNube(r.text)) {
          const base = new URL(r.finalUrl).origin;
          return { base, brand: brandFromHtml(r.text, base) };
        }
      } catch {}
    }
  }

  throw new Error(
    `"${input}" no parece una tienda Tienda Nube (esta skill soporta Tienda Nube).\n` +
      "Probá con la URL de la tienda en sí (suele terminar en .store o .com.ar)."
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
    (u) => u.startsWith(prefix) && !COUNTRY_SEG.test(u.slice(base.length))
  );
  return [...new Set(urls)].sort();
}

// --- parseo de una ficha ---

function extractBalanced(src, openIdx) {
  let depth = 0, inStr = false, esc = false, quote = "";
  for (let j = openIdx; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === quote) inStr = false;
    } else if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
    } else if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) return src.slice(openIdx, j + 1);
    }
  }
  return null;
}

function stripTags(htmlFrag) {
  return decodeEntities(
    htmlFrag.replace(/<\s*br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")
  ).trim();
}

function resolveImg(u) {
  if (!u) return null;
  if (typeof u === "object") u = u.src || u.url || null;
  if (!u || typeof u !== "string") return null;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("/")) return null; // ruta relativa sin host: no sirve sola
  if (/^https?:/.test(u)) return u;
  return null;
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
    const names = [...seg.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map((m) => decodeEntities(m[1].trim()));
    if (names.length > 1) crumbs = names.slice(0, -1);
  }

  const sizeOptionName =
    (product.default_options && product.default_options[0] && product.default_options[0].name) || "Talle";

  const vlist = variants.map((v) => ({
    size: v.option0 != null ? String(v.option0) : "—",
    sku: v.sku || "",
    stock: typeof v.stock === "number" ? v.stock : v.stock == null ? null : Number(v.stock),
    available: !!v.available,
    priceNumber: typeof v.price_number === "number" ? v.price_number : null,
    priceShort: cleanShort(v.price_short),
    promoShort:
      v.has_promotional_price && v.promotional_price_short ? cleanShort(v.promotional_price_short) : null,
    compareShort: v.compare_at_price_short ? cleanShort(v.compare_at_price_short) : null,
    payDiscountShort: v.price_with_payment_discount_short || null,
    image: resolveImg(v.image_url),
  }));

  const stockTotal =
    typeof product.stock === "number"
      ? product.stock
      : vlist.reduce((a, v) => a + (v.stock || 0), 0);

  const priceNums = vlist.map((v) => v.priceNumber).filter((n) => typeof n === "number");
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

module.exports = { fetchText, detectStore, getProductUrls, parseProduct, COUNTRY_SEG };
