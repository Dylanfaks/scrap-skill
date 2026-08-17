// Helpers de parseo/normalización compartidos por los adapters de plataforma.
// El objetivo de todos los adapters es producir el MISMO shape de producto:
//
// { id, name, brand, url, crumbs[], seoTitle, metaDescription, description,
//   mainImage, priceShort, price, minPrice, maxPrice, compareShort, promoShort,
//   payDiscount, stockTotal (número o null si la plataforma no lo expone),
//   soldQty (número o null), available (bool), sizeOptionName,
//   variants: [{ size, sku, stock, available, priceShort, promoShort,
//                compareShort, payDiscountShort, image }] }

function decodeEntities(s) {
  if (!s) return s;
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#8217;/g, "'")
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

// Extrae un bloque {…} o […] balanceado desde openIdx (consciente de strings).
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

function resolveImg(u, base) {
  if (!u) return null;
  if (typeof u === "object") u = u.src || u.url || null;
  if (!u || typeof u !== "string") return null;
  if (u.startsWith("//")) return "https:" + u;
  if (u.startsWith("/")) return base ? base + u : null;
  if (/^https?:/.test(u)) return u;
  return null;
}

// Parsea un precio que puede venir localizado: "78.600", "78.600,50", "91.00",
// "1,299.00". Devuelve número o null. Regla: el ÚLTIMO separador con 1-2 dígitos
// detrás es el decimal; el resto son miles.
function parsePrice(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  let s = String(v).replace(/[^\d.,-]/g, "");
  if (!s) return null;
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  const sepIdx = Math.max(lastDot, lastComma);
  if (sepIdx >= 0) {
    const decimals = s.length - sepIdx - 1;
    if (decimals >= 1 && decimals <= 2) {
      // separador decimal: normalizamos a "."
      s = s.slice(0, sepIdx).replace(/[.,]/g, "") + "." + s.slice(sepIdx + 1);
    } else {
      // separador de miles (ej. "78.600")
      s = s.replace(/[.,]/g, "");
    }
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

// Todos los bloques JSON-LD de un HTML, parseados (los que parseen bien).
function jsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim());
      if (Array.isArray(data)) out.push(...data);
      else if (data["@graph"] && Array.isArray(data["@graph"])) out.push(...data["@graph"]);
      else out.push(data);
    } catch {}
  }
  return out;
}

const isType = (node, type) => {
  const t = node && node["@type"];
  return t === type || (Array.isArray(t) && t.includes(type));
};

// Contenido de una meta tag (por name= o property=).
function metaContent(html, key) {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${key.replace(/[:/]/g, "\\$&")}["'][^>]+content=["']([^"']*)["']|` +
      `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${key.replace(/[:/]/g, "\\$&")}["']`,
    "i"
  );
  const m = html.match(re);
  return m ? decodeEntities(m[1] ?? m[2]).trim() : null;
}

const fmtPriceShort = (n) =>
  n == null ? null : "$" + Math.round(Number(n)).toLocaleString("es-AR");

module.exports = {
  decodeEntities,
  extractBalanced,
  stripTags,
  resolveImg,
  parsePrice,
  jsonLdBlocks,
  isType,
  metaContent,
  fmtPriceShort,
};
