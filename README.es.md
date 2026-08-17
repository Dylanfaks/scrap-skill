# scrap — scraper de catálogos y estimador de ventas (skill de Claude Code)

[![tests](https://github.com/Dylanfaks/scrap-skill/actions/workflows/test.yml/badge.svg)](https://github.com/Dylanfaks/scrap-skill/actions/workflows/test.yml)
[![licencia: MIT](https://img.shields.io/badge/licencia-MIT-green.svg)](LICENSE)

**[Read this in English → README.md](README.md)**

`/scrap` es una skill de [Claude Code](https://claude.com/claude-code) que scrapea el
**catálogo público de cualquier tienda online** a un reporte **PDF + HTML** prolijo, y
compara scraps de distintas fechas para **estimar ventas, facturación y tendencia** de la
tienda — todo a partir de datos que la propia tienda hace públicos. Sin API keys, sin
login, sin credenciales.

Funciona con **Tienda Nube / Nuvemshop**, **Shopify**, **WooCommerce** y, como fallback,
**cualquier tienda con datos estructurados estándar** (JSON-LD / Open Graph — Magento,
PrestaShop, VTEX, BigCommerce, desarrollos a medida…). La plataforma se **detecta sola**
a partir de la URL: nunca hace falta aclarar cuál es.

## Qué obtenés

- **Reporte de catálogo** (`/scrap <url>`): todos los productos con precios, promos,
  variantes, stock (donde es público), imágenes, categorías y metadata SEO — como PDF
  listo para imprimir y HTML liviano con el dataset completo embebido (legible por máquina).
- **Estimación de ventas** (`/scrap compare`): le das 2+ reportes de la misma tienda de
  fechas distintas y estima **unidades vendidas, facturación, ticket promedio,
  reposiciones, más vendidos y evolución por período** — con la metodología explicada
  honestamente en el propio reporte.

## Arranque rápido

1. Cloná o descargá este repo.
2. Copialo a tu directorio de skills de Claude Code:
   ```bash
   cp -r scrap ~/.claude/skills/scrap
   ```
3. Instalá las dependencias (una vez):
   ```bash
   npm install --prefix ~/.claude/skills/scrap
   ```
4. En Claude Code:
   ```
   /scrap https://algunatienda.com
   ```
   …y unos días después, adjuntá dos reportes y corré `/scrap compare`.

**Requisitos:** Node.js ≥ 18 y Google Chrome o Chromium (solo para el PDF; el HTML sale
igual sin Chrome). Se detecta solo en macOS, Windows y Linux — se puede forzar con la
variable de entorno `CHROME_PATH`.

También podés usar los scripts sueltos, sin Claude Code:

```bash
node scripts/scrape.js https://algunatienda.com          # catálogo completo
node scripts/scrape.js algunatienda.com --limit 20       # prueba rápida
node scripts/compare.js output/.compare/*.json           # estimación de ventas
```

## ¿Cómo detecta la plataforma?

`scripts/lib/detect.js` baja la URL (siguiendo redirects, e incluso encontrando la tienda
real cuando le pasás la web institucional de la marca) y busca señales de plataforma en el
HTML; si no encuentra ninguna, prueba activamente los endpoints públicos:

| Plataforma | Señal de detección | Fuente del catálogo | Granularidad de stock |
|---|---|---|---|
| **Tienda Nube / Nuvemshop** | `LS.product`, CDN `mitiendanube.com` | sitemap → cada ficha (JSON de producto + variantes embebido) | **stock numérico por variante + unidades vendidas históricas (`sold_qty`)** |
| **Shopify** | `cdn.shopify.com`, `Shopify.shop` | `/products.json` público (paginado) | solo disponibilidad (hay / no hay) |
| **WooCommerce** | `wp-content/plugins/woocommerce` | Store API pública `/wp-json/wc/store/v1/products` | solo disponibilidad |
| **Genérica (fallback)** | siempre matchea | sitemap → páginas con JSON-LD `Product` / Open Graph | solo disponibilidad |

## ¿Cómo se calcula la estimación de ventas?

Los reportes se cruzan **por ID de producto** y se ordenan por fecha de scrap. Para cada
par de scraps consecutivos, el motor usa la **mejor señal pública disponible por producto**:

1. **Delta de `sold_qty`** (Tienda Nube): la plataforma publica un contador histórico de
   unidades vendidas — su delta entre scraps es exacto y capta incluso ventas con reposición.
2. **Caída de stock**: lo que bajó, se vendió. Es un **piso** — las reposiciones entre
   scraps esconden ventas.
3. **Transiciones de disponibilidad** (Shopify / WooCommerce / genérica): sin stock
   numérico, el reporte marca qué productos **se agotaron** o **volvieron a stock**.
   No se inventan unidades.

La facturación se valoriza a precio de lista del inicio de cada período. Cada reporte
incluye una sección de **método y límites** que dice exactamente qué señal se usó — la
meta es una estimación honesta, no un número impresionante.

> **Cuantos más scraps, mejor.** Scrapear cada pocos días achica la ventana ciega entre
> fotos, capta reposiciones y convierte la estimación en una curva de tendencia real.

## Preguntas frecuentes

### ¿Es legal / ético?

La skill lee solo lo que la tienda **publica a cualquier visitante**: sus fichas públicas,
su sitemap, sus endpoints JSON públicos. Usa User-Agent normal de navegador, corre con
**concurrencia baja (3)** y **respeta el rate limiting** (HTTP 429 + `Retry-After`). Nunca
se loguea, nunca saltea protecciones, nunca toca datos privados. Aun así, sos responsable
de usarla conforme a los términos de servicio de cada sitio y a la ley de tu país. Está
pensada para **análisis competitivo e investigación de mercado** sobre datos que cualquiera ve.

### ¿Por qué el stock solo aparece en Tienda Nube?

Porque las otras plataformas no lo hacen público. El `/products.json` de Shopify y la
Store API de Woo exponen disponibilidad (hay / no hay) pero no cantidades. Los reportes lo
dicen explícitamente en vez de adivinar.

### ¿Entonces puede estimar ventas de una tienda Shopify?

Parcialmente: reporta qué productos **se agotaron** y cuáles **volvieron** entre scraps —
una señal real de demanda — pero no inventa unidades que no puede observar.

### ¿Y si la tienda está cerrada (página de contraseña)?

Las tiendas Tienda Nube muestran una página de contraseña pre-drop. Si ya scrapeaste
antes, la skill regenera el reporte desde su cache local y te avisa.

### ¿Funciona fuera de Argentina?

Sí. Los subcatálogos por país de Tienda Nube se filtran al local; las tiendas
Shopify/Woo/genéricas funcionan en cualquier país. La moneda se detecta y se muestra
(los textos del reporte están en español por ahora — se aceptan PRs).

## Estructura del proyecto

```
scrap/
├── SKILL.md                    # instrucciones que sigue Claude Code
├── README.md / README.es.md
├── package.json                # dependencia: puppeteer-core (solo PDF)
├── scripts/
│   ├── scrape.js               # /scrap <url> — orquestador
│   ├── compare.js              # /scrap compare — motor de ventas
│   └── lib/
│       ├── detect.js           # auto-detección de plataforma
│       ├── platforms/          # tiendanube.js · shopify.js · woocommerce.js · generic.js
│       ├── templates-*.js      # HTML de reportes (catálogo y ventas)
│       ├── render.js           # HTML → PDF con el Chrome del sistema (imágenes livianas)
│       ├── net.js / normalize.js / format.js / chrome.js
└── test/                       # node --test; fixtures con datos reales de tiendas
```

## Tests

```bash
npm test
```

42 tests, sin red: parseo anclado a **fixtures reales** capturadas de tiendas vivas de
cada plataforma (ver `test/fixtures/README.md`), matemática del motor de ventas,
renderizado de templates y comportamiento del CLI (input inválido, datasets corruptos).

## Contribuir

Issues y PRs bienvenidos — sobre todo adapters de plataformas nuevas (un adapter es un
archivo en `scripts/lib/platforms/` que exporta `sniff()` + `getCatalog()` con el shape
compartido de producto) e i18n de los reportes.

## Licencia

[MIT](LICENSE).
