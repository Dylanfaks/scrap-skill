// Renderiza un HTML a PDF usando el Chrome del sistema vía puppeteer-core.
// El footer (con fecha de generación + numeración) es igual en el catálogo y en
// el reporte de ventas, para mantener un formato consistente.

const { requireChrome } = require("./chrome");

async function renderPdf(html, outPath, { footerLeft = "" } = {}) {
  const puppeteer = require("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath: requireChrome(),
    headless: "new",
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 120000 });
    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
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

module.exports = { renderPdf };
