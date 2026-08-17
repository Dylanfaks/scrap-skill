// Renderiza un HTML a PDF usando el Chrome del sistema vía puppeteer-core.
// El footer (con fecha de generación + numeración) es igual en el catálogo y en
// el reporte de ventas, para mantener un formato consistente.

const { requireChrome } = require("./chrome");

// El PDF se queda con imágenes livianas para no pesar de más (un catálogo grande
// con fotos en alta daba PDFs de 100+ MB que tardan en abrir). Bajamos las URLs
// de los CDNs conocidos a un tamaño chico; el HTML conserva la alta calidad.
//  - Tienda Nube: sufijo -WxH del archivo (el CDN sirve la reducida on-demand).
//  - Shopify: parámetro ?width= del CDN de imágenes.
const PDF_IMG_SIZE = 320;
function lightenImagesForPdf(html) {
  return html
    .replace(
      /(mitiendanube\.com\/[^"'\s)]*?)-\d{2,4}-\d{2,4}(\.(?:webp|jpe?g|png))/gi,
      (_m, head, ext) => `${head}-${PDF_IMG_SIZE}-${PDF_IMG_SIZE}${ext}`
    )
    .replace(
      /(cdn\.shopify\.com\/[^"'\s)]*?\.(?:webp|jpe?g|png))(\?[^"'\s)]*)?/gi,
      (_m, file, qs) => {
        const params = new URLSearchParams((qs || "?").slice(1));
        params.set("width", String(PDF_IMG_SIZE));
        return `${file}?${params.toString()}`;
      }
    );
}

async function renderPdf(html, outPath, { footerLeft = "" } = {}) {
  const puppeteer = require("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath: requireChrome(),
    headless: "new",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    // domcontentloaded + asentamiento fijo: con imágenes chicas carga rápido y no
    // se cuelga esperando "networkidle0" en catálogos con cientos de fotos.
    await page.setContent(lightenImagesForPdf(html), { waitUntil: "domcontentloaded", timeout: 0 });
    await new Promise((r) => setTimeout(r, 8000));
    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      timeout: 0,
      margin: { top: "0", bottom: "62px", left: "0", right: "0" },
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate:
        '<div style="width:100%;font-size:8px;color:#999;padding:6px 36px 0;border-top:1px solid #eee;display:flex;justify-content:space-between;font-family:Helvetica,Arial">' +
        `<span>${escapeHtml(footerLeft)}</span>` +
        '<span>Página <span class="pageNumber"></span></span></div>',
    });
  } finally {
    await browser.close();
  }
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

module.exports = { renderPdf, lightenImagesForPdf };
