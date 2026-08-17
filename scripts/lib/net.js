// Capa de red compartida por todos los adapters de plataforma.
// fetchText/fetchJson con User-Agent de navegador, reintentos con backoff y
// manejo de rate limit (HTTP 429 respetando Retry-After). El scraping es
// respetuoso por diseño: concurrencia baja y backoff siempre.

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0 Safari/537.36";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, tries = 6) {
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": UA, "Accept-Language": "es-AR,es;q=0.9,en;q=0.8" },
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
      return { text: await res.text(), finalUrl: res.url, status: res.status };
    } catch (err) {
      if (attempt === tries || /HTTP 404/.test(err.message)) throw err;
      await sleep(800 * attempt);
    }
  }
}

// GET que devuelve JSON parseado (o tira si no es JSON / no responde).
async function fetchJson(url, tries = 6) {
  const r = await fetchText(url, tries);
  try {
    return { data: JSON.parse(r.text), finalUrl: r.finalUrl };
  } catch {
    throw new Error(`la respuesta de ${url} no es JSON válido`);
  }
}

// Ejecuta worker(item) sobre items con concurrencia acotada, preservando orden.
async function mapLimit(items, limit, worker) {
  const results = new Array(items.length);
  let i = 0;
  async function run() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await worker(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

module.exports = { UA, sleep, fetchText, fetchJson, mapLimit };
