# Fixtures

Datos **reales** capturados de tiendas públicas en producción (ago 2026), usados para
anclar los tests: si el parseo cambia, los tests lo detectan contra datos verdaderos.

| Archivo | Fuente | Qué es |
|---|---|---|
| `tiendanube-product.html` | twohip.store | Ficha de producto Tienda Nube, recortada a los bloques que parsea el adapter (`LS.product`, objeto de producto, `LS.variants`, metas, descripción, JSON-LD). Verificada: parsea idéntico a la página completa. |
| `shopify-products.json` | allbirds.com | Respuesta real de `/products.json?limit=2`. |
| `woocommerce-products.json` | barefootbuttons.com | Respuesta real de `/wp-json/wc/store/v1/products?per_page=2`. |
| `generic-product.html` | fravega.com (VTEX) | `<head>` recortado de una página de producto: título, metas Open Graph y JSON-LD. Verificada: parsea idéntico a la página completa. |

Todo es información pública que las propias tiendas exponen a cualquier visitante.
Para regenerarlas: scrapear de nuevo con `--limit 2` y recortar con el mismo criterio.
