# /scrap — skill de scraping de marcas de ropa

Skill para [Claude Code](https://claude.com/claude-code) que scrapea el catálogo público de
una marca de ropa (tiendas **Tienda Nube**) y genera un reporte **PDF + HTML**, y que compara
scraps de distintas fechas para **estimar ventas, facturación y tendencia** de la marca.

Todo a partir de datos públicos que la tienda expone (stock, precios, variantes, unidades vendidas).

## Comandos

| Comando | Qué hace |
|---|---|
| `/scrap <url>` | Scrapea esa tienda y genera `Scrap_<Marca>_<fecha_hora>.pdf` + `.html` |
| `/scrap compare` | Adjuntás 2+ reportes de la misma marca → estima ventas entre fechas y genera `Reporte_Ventas_<Marca>_<fecha_hora>.pdf` + `.html` |

Ejemplo:
```
/scrap https://www.twohip.store
```
```
/scrap compare        (y adjuntás 2 o más PDFs generados antes)
```

Cada reporte lleva **fecha y hora** de generación, así la comparación los ordena cronológicamente.
Cuantos más scraps acumules de una marca (y más seguidos), más exacta es la estimación de ventas.

## Instalación

1. Cloná o descargá este repo.
2. Copiá la carpeta a tu directorio de skills de Claude Code:
   ```bash
   cp -r scrap ~/.claude/skills/scrap
   ```
3. Instalá las dependencias (una vez):
   ```bash
   npm install --prefix ~/.claude/skills/scrap
   ```
4. Listo: en Claude Code ya podés usar `/scrap`.

**Requisitos:** Node.js y Google Chrome (o Chromium). El skill detecta el navegador solo en
macOS, Windows y Linux; si está en una ruta rara, seteá `CHROME_PATH`.

## Cómo funciona

- **Catálogo:** lee el `sitemap.xml` de la tienda, baja cada ficha y extrae el objeto de producto
  y las variantes que Tienda Nube embebe en el HTML (precios, stock por talle, `sold_qty`, SEO).
- **Comparación:** cruza los scraps por ID de producto, los ordena por fecha/hora y mide la caída
  de stock entre fechas (lo que bajó, se vendió). Con 3+ scraps muestra la evolución período a período.
- **Datos embebidos:** cada HTML lleva un `<script id="scrap-data">` con el dataset, para que la
  comparación sea exacta. El PDF muestra los mismos datos en la sección de detalle.

> La comparación es una **estimación por stock público**, no la caja real de la marca: es un piso
> (no cuenta reposiciones ni productos reactivados). El propio reporte lo aclara.

## Alcance

Soporta **Tienda Nube** (la plataforma de la mayoría de las marcas indie argentinas). Si la URL no
es una tienda Tienda Nube, el skill lo avisa en vez de entregar un reporte vacío.

## Estructura

```
scrap/
├── SKILL.md              # instrucciones para Claude Code
├── README.md
├── LICENSE
├── package.json          # dependencia: puppeteer-core
└── scripts/
    ├── scrape.js         # /scrap <url>
    ├── compare.js        # /scrap compare
    └── lib/              # parser TN, render PDF, templates, detección de Chrome
```

## Licencia

MIT.
