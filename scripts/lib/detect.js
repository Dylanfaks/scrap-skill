// Detección automática de plataforma. El usuario pasa cualquier URL (incluso la
// web institucional de la marca) y acá se resuelve: qué dominio es la tienda real
// y con qué plataforma está hecha, sin que el usuario tenga que saberlo.
//
// Orden: señales en el HTML de la home (Tienda Nube → Shopify → WooCommerce),
// después probes activos (/products.json, Store API) y, si nada matchea, el
// flujo genérico por datos estructurados.

const { fetchText, fetchJson } = require("./net");
const { decodeEntities } = require("./normalize");

const tiendanube = require("./platforms/tiendanube");
const shopify = require("./platforms/shopify");
const woocommerce = require("./platforms/woocommerce");
const generic = require("./platforms/generic");

const PLATFORMS = [tiendanube, shopify, woocommerce, generic];

function brandFromHtml(html, base) {
  const og = html.match(/<meta property="og:site_name" content="([^"]+)"/);
  if (og) return decodeEntities(og[1].trim());
  const title = html.match(/<title>([^<]+)<\/title>/);
  if (title) {
    // "... - Comprar en TwoHip" / "TwoHip" / "Inicio - TwoHip" / "Marca: tagline largo"
    const t = decodeEntities(title[1]);
    const colon = t.match(/^([^:|–-]{2,25}):\s/);
    if (colon) return colon[1].trim();
    // "Comprar en <Marca>" va primero: el separador solo agarraría "Comprar en Marca" entero
    const ce = t.match(/Comprar en\s+([^-–|]+)\s*$/);
    if (ce && ce[1].trim().length > 1) return ce[1].trim();
    const m = t.match(/[-–|]\s*([^-–|]+)\s*$/);
    if (m && m[1].trim().length > 1) return m[1].trim();
    return t.split(/[-–|]/).pop().trim() || t.trim();
  }
  return new URL(base).hostname.replace(/^www\./, "").split(".")[0];
}

// ¿Qué plataforma delata este HTML? (sin contar el fallback genérico)
function sniffPlatform(html) {
  for (const p of PLATFORMS) {
    if (p.id !== "generic" && p.sniff(html)) return p;
  }
  return null;
}

// Probes activos para tiendas cuyo HTML no delata la plataforma (headless, etc.).
async function probePlatform(base) {
  try {
    const { data } = await fetchJson(`${base}/products.json?limit=1`, 2);
    if (data && Array.isArray(data.products)) return shopify;
  } catch {}
  try {
    const { data } = await fetchJson(`${base}/wp-json/wc/store/v1/products?per_page=1`, 2);
    if (Array.isArray(data)) return woocommerce;
  } catch {}
  return null;
}

// Normaliza la URL de entrada y resuelve tienda + marca + plataforma.
// Devuelve { base, brand, platform, homeHtml }.
async function detectStore(input) {
  let url = String(input).trim();
  if (!/^https?:\/\//i.test(url)) url = "https://" + url;
  url = url.replace(/\/+$/, "");

  const candidates = [url];
  // heurística: marca.com suele tener su tienda en marca.store / marca.com.ar
  try {
    const u = new URL(url);
    if (/\.com$/.test(u.hostname)) {
      candidates.push(u.origin.replace(/\.com$/, ".store"));
      candidates.push(u.origin.replace(/\.com$/, ".com.ar"));
    }
  } catch {}

  let firstHome = null; // primera home que respondió, para el fallback
  for (const cand of candidates) {
    let r;
    try {
      r = await fetchText(cand);
    } catch {
      continue;
    }
    const base = new URL(r.finalUrl || cand).origin;
    const platform = sniffPlatform(r.text);
    if (platform) {
      return { base, brand: brandFromHtml(r.text, base), platform, homeHtml: r.text };
    }
    if (!firstHome) firstHome = { base, html: r.text };
  }

  if (!firstHome) {
    throw new Error(`No pude cargar "${input}". ¿La URL está bien escrita y la tienda en línea?`);
  }

  // la home puede linkear a la tienda real (marca.store / mitiendanube / myshopify)
  const link = firstHome.html.match(
    /https?:\/\/[a-z0-9.-]+\.(?:store|com\.ar|mitiendanube\.com|myshopify\.com)[^"'\s)]*/i
  );
  if (link) {
    try {
      const r = await fetchText(new URL(link[0]).origin);
      const base = new URL(r.finalUrl).origin;
      const platform = sniffPlatform(r.text);
      if (platform) {
        return { base, brand: brandFromHtml(r.text, base), platform, homeHtml: r.text };
      }
    } catch {}
  }

  // probes activos sobre la home que sí respondió
  const probed = await probePlatform(firstHome.base);
  const platform = probed || generic;
  return {
    base: firstHome.base,
    brand: brandFromHtml(firstHome.html, firstHome.base),
    platform,
    homeHtml: firstHome.html,
  };
}

module.exports = { detectStore, sniffPlatform, probePlatform, brandFromHtml, PLATFORMS };
