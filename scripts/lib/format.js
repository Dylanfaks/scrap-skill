// Helpers de formato compartidos por el catálogo y el reporte de ventas.
// Todas las funciones sensibles al idioma reciben `lang` ("es" | "en") como
// último argumento opcional, con "es" de default (comportamiento previo intacto).

const { t } = require("./i18n");

const fmtInt = (n, lang) => Number(n || 0).toLocaleString(t(lang).locale);

// Monto en pesos, sin decimales: 118500 -> "$118.500" (es) / "$118,500" (en)
const fmtPrice = (n, lang) =>
  n == null ? "—" : "$" + Math.round(Number(n)).toLocaleString(t(lang).locale);

// Monto compacto en millones: 7647000 -> "$7,65 M" (es) / "$7.65 M" (en)
const fmtMoney = (n, lang) =>
  "$" + (Number(n) / 1_000_000).toLocaleString(t(lang).locale, { maximumFractionDigits: 2 }) + " M";

// Limpia el ",00" de los montos enteros que formatea Tienda Nube, pero conserva
// los decimales reales ("$94.000,00" -> "$94.000"; "$125.004,36" se mantiene).
const cleanShort = (s) => (s ? s.replace(/,00$/, "") : s || null);

// Escapa para HTML.
const esc = (s) =>
  String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const truncate = (s, n) => (s && s.length > n ? s.slice(0, n).trimEnd() + "…" : s || "");

// Fecha+hora legible para portadas. Recibe un Date.
const fmtDateTime = (d, lang) => {
  const locale = t(lang).locale;
  const date = d.toLocaleDateString(locale, { day: "2-digit", month: "long", year: "numeric" });
  const time = d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  return lang === "en" ? `${date} · ${time}` : `${date} · ${time} hs`;
};

// Fecha corta para tablas/gráficos de tendencia: "10 jun" (es) / "Jun 10" (en).
const dateShort = (d, lang) => d.toLocaleDateString(t(lang).locale, { day: "2-digit", month: "short" });

// Slug para nombres de archivo: "Two Hip" -> "Two_Hip"
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const slug = (s) =>
  String(s || "marca")
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "") || "marca";

// Sello para nombres de archivo a partir de un Date: 2026-06-10_1234
const stamp = (d) => {
  const p = (n) => String(n).padStart(2, "0");
  return (
    d.getFullYear() +
    "-" +
    p(d.getMonth() + 1) +
    "-" +
    p(d.getDate()) +
    "_" +
    p(d.getHours()) +
    p(d.getMinutes())
  );
};

module.exports = { fmtInt, fmtPrice, fmtMoney, cleanShort, esc, truncate, fmtDateTime, dateShort, slug, stamp };
