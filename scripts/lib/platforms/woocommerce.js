// Adapter WooCommerce (WordPress). La Store API pública (/wp-json/wc/store/v1/
// products) expone el catálogo sin auth: nombre, precios con moneda, sale price,
// categorías, atributos, imágenes y disponibilidad (is_in_stock).
//
// Limitación honesta: la Store API no publica stock numérico salvo
// low_stock_remaining (solo cuando queda poco). stockTotal = null casi siempre;
// la comparación usa la señal de agotamiento, como en Shopify.
//
// Señal de detección: wp-content/plugins/woocommerce, clases woocommerce-*.

const { fetchJson } = require("../net");
const { stripTags, fmtPriceShort } = require("../normalize");

const PAGE_SIZE = 100;
const MAX_PAGES = 100;

function sniff(html) {
  return /wp-content\/plugins\/woocommerce|class="[^"]*woocommerce|woocommerce_params|wc_add_to_cart_params/.test(
    html || ""
  );
}

// La Store API da precios en unidades menores (centavos): "195" + minor_unit 2 = 1.95
function minor(priceStr, prices) {
  if (priceStr == null || priceStr === "") return null;
  const n = Number(priceStr);
  if (!Number.isFinite(n)) return null;
  const unit = prices && Number.isFinite(prices.currency_minor_unit) ? prices.currency_minor_unit : 2;
  return n / Math.pow(10, unit);
}

function normalizeProduct(p, base) {
  const prices = p.prices || {};
  const price = minor(prices.price, prices);
  const regular = minor(prices.regular_price, prices);
  const sale = minor(prices.sale_price, prices);
  const onSale = !!p.on_sale && regular != null && sale != null && sale < regular;

  const range = prices.price_range
    ? {
        min: minor(prices.price_range.min_amount, prices),
        max: minor(prices.price_range.max_amount, prices),
      }
    : null;

  const stock = Number.isFinite(p.low_stock_remaining) ? p.low_stock_remaining : null;
  const description = stripTags(p.short_description || p.description || "");
  const sizeOptionName = (p.attributes && p.attributes[0] && p.attributes[0].name) || "Variante";

  return {
    id: String(p.id),
    name: stripTags(p.name || ""),
    brand: (p.brands && p.brands[0] && p.brands[0].name) || "",
    url: p.permalink || base,
    crumbs: (p.categories || []).map((c) => c.name),
    seoTitle: stripTags(p.name || ""),
    metaDescription: description.slice(0, 300),
    description,
    mainImage: (p.images && p.images[0] && p.images[0].src) || null,
    priceShort: fmtPriceShort(onSale ? regular : range ? range.min : price) || "—",
    price: range ? range.min : price,
    minPrice: range ? range.min : price,
    maxPrice: range ? range.max : price,
    compareShort: onSale ? fmtPriceShort(regular) : null,
    promoShort: onSale ? fmtPriceShort(sale) : null,
    payDiscount: null,
    stockTotal: stock,
    soldQty: null,
    available: !!p.is_in_stock,
    sizeOptionName,
    // La Store API lista variaciones como IDs; no las bajamos una a una para no
    // multiplicar requests. Los atributos quedan en sizeOptionName/crumbs.
    variants: [],
  };
}

async function getCatalog(base, ctx) {
  const products = [];
  let currency = null;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const key = `__wc_p${page}.json`;
    let raw = !ctx.fresh ? ctx.cache.get(key) : null;
    let data;
    if (raw != null) {
      try {
        data = JSON.parse(raw);
      } catch {
        raw = null; // cache corrupto: lo tratamos como miss
      }
    }
    if (raw == null) {
      const url = `${base}/wp-json/wc/store/v1/products?per_page=${PAGE_SIZE}&page=${page}`;
      try {
        data = (await fetchJson(url)).data;
      } catch (e) {
        if (page === 1) {
          const err = new Error(
            `La Store API de WooCommerce no respondió (${e.message}). Pruebo el flujo genérico.`
          );
          err.code = "WC_STORE_API_UNAVAILABLE";
          throw err;
        }
        break;
      }
      ctx.cache.put(key, JSON.stringify(data));
    }
    if (!Array.isArray(data) || !data.length) break;
    for (const p of data) {
      if (!currency && p.prices && p.prices.currency_code) currency = p.prices.currency_code;
      products.push(normalizeProduct(p, base));
    }
    ctx.progress(`página ${page} · ${products.length} productos`);
    if (products.length >= ctx.limit) break;
    if (data.length < PAGE_SIZE) break;
  }

  if (!products.length) throw new Error("La Store API de WooCommerce no devolvió productos.");
  const sliced = ctx.limit !== Infinity ? products.slice(0, ctx.limit) : products;
  return { products: sliced, currency };
}

module.exports = {
  id: "woocommerce",
  label: "WooCommerce",
  hasNumericStock: false,
  sniff,
  getCatalog,
  normalizeProduct,
};
