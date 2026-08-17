// Adapter Shopify. Casi toda tienda Shopify expone el catálogo público en
// /products.json (paginado, hasta 250 por página) sin auth: título, vendor,
// variantes con precio / compare-at / disponibilidad, imágenes y opciones.
//
// Limitación honesta: Shopify NO publica stock numérico ahí — solo `available`
// por variante. Por eso stockTotal = null y la comparación de ventas usa la
// señal de agotamiento (disponible → agotado) en vez de caída de stock.
//
// Señal de detección: Shopify.shop / cdn.shopify.com / /cdn/shop/ en el HTML,
// o /products.json respondiendo JSON con "products".

const { fetchJson } = require("../net");
const { stripTags, parsePrice, fmtPriceShort } = require("../normalize");

const PAGE_SIZE = 250;
const MAX_PAGES = 40; // tope de cordura: 10.000 productos

function sniff(html) {
  return /Shopify\.shop|cdn\.shopify\.com|\/cdn\/shop\/|shopify-features|myshopify\.com/.test(
    html || ""
  );
}

// Moneda activa de la tienda, desde el HTML de la home.
function currencyFromHtml(html) {
  const m =
    (html || "").match(/Shopify\.currency\s*=\s*{\s*"active"\s*:\s*"([A-Z]{3})"/) ||
    (html || "").match(/"currency"\s*:\s*"([A-Z]{3})"/);
  return m ? m[1] : null;
}

function normalizeProduct(p, base) {
  const sizeOptionName = (p.options && p.options[0] && p.options[0].name) || "Variante";
  const vlist = (p.variants || []).map((v) => {
    const price = parsePrice(v.price);
    const compare = parsePrice(v.compare_at_price);
    // compare_at > price significa que el precio actual es promocional
    const onSale = compare != null && price != null && compare > price;
    return {
      size: [v.option1, v.option2, v.option3].filter((x) => x != null && x !== "Default Title").join(" / ") || "—",
      sku: v.sku || "",
      stock: null, // Shopify no expone stock numérico públicamente
      available: !!v.available,
      priceNumber: price,
      priceShort: fmtPriceShort(onSale ? compare : price),
      promoShort: onSale ? fmtPriceShort(price) : null,
      compareShort: onSale ? fmtPriceShort(compare) : null,
      payDiscountShort: null,
      image: (v.featured_image && v.featured_image.src) || null,
    };
  });

  const priceNums = vlist.map((v) => v.priceNumber).filter((n) => typeof n === "number");
  const minPrice = priceNums.length ? Math.min(...priceNums) : null;
  const maxPrice = priceNums.length ? Math.max(...priceNums) : null;
  const available = vlist.some((v) => v.available);
  const mainImage =
    (p.images && p.images[0] && p.images[0].src) || (vlist.find((v) => v.image) || {}).image || null;

  const description = stripTags(p.body_html || "");

  return {
    id: String(p.id),
    name: p.title || "",
    brand: p.vendor || "",
    url: base + "/products/" + p.handle,
    crumbs: p.product_type ? [p.product_type] : [],
    seoTitle: p.title || "",
    metaDescription: description.slice(0, 300),
    description,
    mainImage,
    priceShort: (vlist.find((v) => v.priceShort) || {}).priceShort || fmtPriceShort(minPrice) || "—",
    price: minPrice,
    minPrice,
    maxPrice,
    compareShort: (vlist.find((v) => v.compareShort) || {}).compareShort || null,
    promoShort: (vlist.find((v) => v.promoShort) || {}).promoShort || null,
    payDiscount: null,
    stockTotal: null,
    soldQty: null,
    available,
    sizeOptionName,
    variants: vlist.map(({ priceNumber, ...keep }) => keep),
  };
}

async function getCatalog(base, ctx) {
  const products = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const key = `__products_p${page}.json`;
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
      const url = `${base}/products.json?limit=${PAGE_SIZE}&page=${page}`;
      try {
        data = (await fetchJson(url)).data;
      } catch (e) {
        if (page === 1) {
          throw new Error(
            `No pude leer ${url} (${e.message}). La tienda puede tener el catálogo público deshabilitado.`
          );
        }
        break; // páginas siguientes: cortamos con lo que hay
      }
      ctx.cache.put(key, JSON.stringify(data));
    }
    const batch = (data && data.products) || [];
    if (!batch.length) break;
    for (const p of batch) products.push(normalizeProduct(p, base));
    ctx.progress(`página ${page} · ${products.length} productos`);
    if (products.length >= ctx.limit) break;
    if (batch.length < PAGE_SIZE) break;
  }

  if (!products.length) throw new Error("El /products.json de esta tienda no devolvió productos.");
  const sliced = ctx.limit !== Infinity ? products.slice(0, ctx.limit) : products;
  return { products: sliced, currency: currencyFromHtml(ctx.homeHtml) };
}

module.exports = {
  id: "shopify",
  label: "Shopify",
  hasNumericStock: false,
  sniff,
  getCatalog,
  normalizeProduct,
  currencyFromHtml,
};
