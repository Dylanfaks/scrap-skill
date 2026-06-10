---
name: scrap
description: Use when the user runs /scrap with a clothing brand's online store URL to scrape its catalog into a report, or /scrap compare to estimate sales from two or more previously generated scrap reports of the same brand. Works on Tienda Nube stores.
---

# scrap

Scrapea el catálogo público de una marca de ropa (Tienda Nube) a un reporte **PDF + HTML**, y compara scraps de distintas fechas para estimar **ventas, facturación y tendencia**.

`{SKILL_DIR}` = el directorio de esta skill (te lo pasan al invocarla, ej. `~/.claude/skills/scrap`).
Corré los comandos **desde el directorio actual del usuario** (no desde el de la skill) para que la salida caiga en `./output` cerca suyo.

## Setup (una sola vez)

Si no existe `{SKILL_DIR}/node_modules/puppeteer-core`, instalá las dependencias:
```bash
npm install --prefix "{SKILL_DIR}" --no-audit --no-fund
```
Requiere Node y Google Chrome/Chromium instalados (el script detecta el navegador solo en Mac/Windows/Linux; se puede forzar con `CHROME_PATH`).

## Elegir el modo

El primer argumento decide:
- empieza con `http`/un dominio → **Modo catálogo** (scrapea esa tienda).
- es `compare` → **Modo comparación** (usa los PDFs/HTML adjuntos).

## Modo catálogo — `/scrap <url>`

```bash
node "{SKILL_DIR}/scripts/scrape.js" "<url>"
```
Genera `./output/Scrap_<Marca>_<fecha_hora>.pdf` y `.html`. Pasá la salida real (rutas de los dos archivos + resumen de productos/stock) al usuario. Si el script avisa que la web no es Tienda Nube, decíselo (esta skill soporta Tienda Nube).

## Modo comparación — `/scrap compare`

El usuario adjunta **2 o más** PDFs (o HTML) generados antes con `/scrap`, de **la misma marca**. Necesitás convertir cada uno en un dataset JSON y pasárselos a `compare.js`.

**1. Por cada archivo adjunto, armá su dataset** `{ "brand", "scrapedAt", "products":[...] }`:
- **Si es un HTML de esta skill:** tiene `<script type="application/json" id="scrap-data">…</script>`. Ese JSON **es** el dataset — copialo tal cual.
- **Si es un PDF de esta skill:** leé la portada (campo *"Fecha y hora del scrap"* → `scrapedAt`) y la sección *"Detalle por producto"*. Por cada producto armá `{ "id", "name", "price" (número, sin $ ni puntos), "stock" (total), "soldQty" (fila "Vendidas" si está) }`.
- **Si es un PDF externo/viejo sin fecha:** preguntale al usuario la fecha (y hora si la sabe) de ese scrap.

Guardá cada dataset en `./output/.compare/<n>.json` (numerados por orden de adjunto; el script igual los reordena por fecha).

**2. Corré la comparación** con todos los datasets:
```bash
node "{SKILL_DIR}/scripts/compare.js" ./output/.compare/*.json
```
Genera `./output/Reporte_Ventas_<Marca>_<fecha_hora>.pdf` y `.html`. Pasale al usuario las rutas + el titular (unidades y facturación estimadas del período).

## Reglas

- **Siempre entregá PDF y HTML**, y reportá las rutas absolutas.
- La comparación es una **estimación por caída de stock** (no la caja real): es un piso. Aclarálo al entregar, como hace el propio reporte.
- Más scraps y más seguidos = estimación más exacta. Sugerí scrapear cada pocos días para mejor seguimiento.
- No inventes datos: si un PDF no tiene fecha, pedila; si no es Tienda Nube, avisá.

## Detalle técnico

- Scraper y parser: `scripts/lib/tiendanube.js`. Cálculo de ventas: `scripts/compare.js`.
- Cache local de fichas en `./output/.cache/` para regenerar sin re-scrapear (`--fresh` para forzar).
- `scrape.js` acepta `--limit N` (prueba), `--out DIR`, `--fresh`.
