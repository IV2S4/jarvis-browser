'use strict';
// 🛡 Detector de estafas y 💰 comparador de precios [09-nov]
// Al abrir una tienda: mira la edad del dominio (registro público RDAP), si imita a una marca conocida, la terminación
// del dominio, si tiene forma de contacto… Si suma riesgo, la IA lo confirma y el navegador te avisa.
// En una página de producto, busca el mismo producto en otras tiendas y te avisa si está más barato.

// lo que se le pregunta a la página: ¿es una tienda? ¿es un producto? (sin tocar formularios ni contraseñas)
const JS_TIENDA = `(() => {
  const txt = (document.body ? document.body.innerText : '').replace(/\\s+/g, ' ');
  const bajo = txt.toLowerCase();
  const precios = (txt.match(/(?:US\\$|\\$|€|£|USD|MXN)\\s?\\d{1,3}(?:[.,]\\d{3})*(?:[.,]\\d{2})?/g) || []).length;
  const carrito = /(add to cart|añadir al carrito|agregar al carrito|comprar ahora|buy now|checkout|pagar ahora|añadir a la cesta|add to bag)/i.test(txt);
  let producto = null;
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const j = JSON.parse(s.textContent); const lista = [].concat(j['@graph'] || j);
      for (const x of lista) {
        const tipo = [].concat(x['@type'] || []).join(',');
        if (/Product/.test(tipo)) {
          const of = [].concat(x.offers || [])[0] || {};
          const oferta = of.offers ? [].concat(of.offers)[0] : of;
          const precio = Number(oferta.price || oferta.lowPrice || of.lowPrice || 0);
          producto = { nombre: x.name, marca: (x.brand && (x.brand.name || x.brand)) || '', modelo: x.gtin13 || x.gtin12 || x.gtin || x.mpn || x.sku || x.model || '', precio, moneda: oferta.priceCurrency || of.priceCurrency || '' };
          break;
        }
      }
    } catch (e) { }
    if (producto) break;
  }
  if (!producto) {   // Amazon y tiendas sin datos estándar: título y precio visibles
    const q = (s) => { const e = document.querySelector(s); return e ? (e.content || e.textContent || '').trim() : ''; };
    const num = (t) => { const x = String(t || '').replace(/[^0-9.,]/g, ''); if (!x) return 0; const n = Number(/,\\d{2}$/.test(x) ? x.replace(/\\./g, '').replace(',', '.') : x.replace(/,/g, '')); return n > 0 && n < 1e6 ? n : 0; };
    const nombre = q('#productTitle') || q('[itemprop="name"]') || q('h1[data-testid*="title" i]') || q('h1');
    let precio = 0; let precioTxt = '';
    for (const e of document.querySelectorAll('#corePrice_feature_div .a-offscreen, #corePriceDisplay_desktop_feature_div .a-offscreen, #apex_desktop .a-offscreen, #price_inside_buybox, #usedBuySection .a-color-price, #buybox .a-offscreen, .a-price .a-offscreen, [itemprop="price"], [data-testid*="price" i]')) {
      precioTxt = (e.content || e.textContent || '').trim(); precio = num(precioTxt); if (precio) break;
    }
    if (!precio) { const w = q('.a-price-whole'); const f = q('.a-price-fraction'); precio = num(w + (f ? '.' + f : '')); }
    if (nombre && precio > 0 && (document.querySelector('#add-to-cart-button, #buy-now-button, [name="submit.add-to-cart"], [data-testid*="add-to-cart" i]') || /amazon\./.test(location.hostname))) {
      producto = { nombre: nombre.slice(0, 200), marca: q('#bylineInfo').replace(/^(Visit the|Brand:|Visita la tienda de|Marca:)\\s*/i, '').replace(/\\s*Store$/i, ''), modelo: '', precio, moneda: q('[itemprop="priceCurrency"]') || (/€/.test(precioTxt) ? 'EUR' : /£/.test(precioTxt) ? 'GBP' : 'USD'),
        foto: (document.querySelector('#landingImage, #imgTagWrapperId img') || {}).src || '',
        estado: /used|usado|renewed|reacondicionado/i.test(q('#usedBuySection') + q('#buybox')) ? 'used' : 'new' };
    }
  }
  if (!producto) {
    const m = (p) => { const e = document.querySelector('meta[property="' + p + '"], meta[name="' + p + '"]'); return e ? e.content : ''; };
    const precio = Number(m('product:price:amount') || m('og:price:amount') || 0);
    if (precio && (m('og:type') || '').includes('product')) producto = { nombre: m('og:title') || document.title, marca: m('product:brand'), modelo: '', precio, moneda: m('product:price:currency') || m('og:price:currency') };
  }
  if (producto && !producto.foto) { const og = document.querySelector('meta[property="og:image"]'); producto.foto = og ? og.content : ''; }
  return {
    url: location.href, titulo: document.title, precios, carrito, producto,
    contacto: /(contact us|contáctanos|contacto|customer service|servicio al cliente|atención al cliente)/i.test(txt),
    devoluciones: /(return policy|refund|política de devoluci|devoluciones|reembolso)/i.test(txt),
    descuentos: (bajo.match(/-\\s?(7\\d|8\\d|9\\d)\\s?%|(7\\d|8\\d|9\\d)\\s?% off/g) || []).length,
    soloTransferencia: /(zelle|western union|bank transfer only|solo transferencia|crypto only|bitcoin only|gift card)/i.test(txt),
    texto: txt.slice(0, 6000),
  };
})()`;

const MARCAS = ['amazon', 'walmart', 'bestbuy', 'target', 'ebay', 'apple', 'nike', 'adidas', 'paypal', 'samsung', 'microsoft', 'netflix', 'costco', 'shein', 'temu', 'aliexpress', 'mercadolibre', 'playstation', 'xbox', 'steam'];
const TLD_RIESGO = /\.(shop|top|xyz|store|online|site|buzz|click|icu|cfd|sbs|cyou|live|vip|fun|rest|bond|lol|today|monster)$/i;
const raiz = (host) => host.replace(/^www\./, '').split('.').slice(-2).join('.');
const sinNumeros = (s) => s.replace(/0/g, 'o').replace(/1/g, 'l').replace(/3/g, 'e').replace(/5/g, 's').replace(/@/g, 'a');

// edad del dominio en días (registro público RDAP); null si no se sabe
const edades = new Map();
async function edadDominio(host) {
  const d = raiz(host);
  if (edades.has(d)) return edades.get(d);
  let dias = null;
  try {
    const r = await fetch(`https://rdap.org/domain/${encodeURIComponent(d)}`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/rdap+json' } });
    if (r.ok) {
      const j = await r.json();
      const ev = (j.events || []).find((e) => e.eventAction === 'registration');
      if (ev && ev.eventDate) dias = Math.floor((Date.now() - Date.parse(ev.eventDate)) / 864e5);
    }
  } catch { /* sin internet o el registro no responde */ }
  edades.set(d, dias);
  return dias;
}

// suma señales; devuelve { puntos, senales, motivos }
async function revisar(host, d) {
  const senales = {}; const motivos = []; let puntos = 0;
  const dominio = raiz(host); const nombre = dominio.split('.')[0];
  const dias = await edadDominio(host); senales.edadDias = dias;
  if (dias != null && dias < 90) { puntos += 3; motivos.push({ es: `El dominio se creó hace solo ${dias} días`, en: `The domain was created only ${dias} days ago` }); }
  else if (dias != null && dias < 365) { puntos += 1; motivos.push({ es: 'El dominio tiene menos de un año', en: 'The domain is less than a year old' }); }
  const marca = MARCAS.find((m) => sinNumeros(nombre).includes(m) && nombre !== m);
  if (marca) { puntos += 3; senales.imitaMarca = marca; motivos.push({ es: `El nombre imita a «${marca}» pero no es su web oficial`, en: `The name imitates "${marca}" but it is not its official site` }); }
  if (TLD_RIESGO.test(dominio)) { puntos += 1; senales.terminacion = dominio.split('.').pop(); motivos.push({ es: `Terminación de dominio muy usada en estafas (.${senales.terminacion})`, en: `Domain ending often used by scams (.${senales.terminacion})` }); }
  if (!d.contacto) { puntos += 1; motivos.push({ es: 'No se ve forma de contacto ni servicio al cliente', en: 'No contact or customer service info visible' }); }
  if (!d.devoluciones) { puntos += 0.5; }
  if (d.descuentos >= 3) { puntos += 1; motivos.push({ es: 'Descuentos exagerados (70–90 %) por todas partes', en: 'Huge discounts (70–90%) everywhere' }); }
  if (d.soloTransferencia) { puntos += 2; motivos.push({ es: 'Pide pagos difíciles de reclamar (transferencia, Zelle, cripto o tarjetas regalo)', en: 'Asks for hard-to-dispute payments (wire, Zelle, crypto or gift cards)' }); }
  Object.assign(senales, { contacto: d.contacto, devoluciones: d.devoluciones, descuentosExagerados: d.descuentos, pagosRaros: d.soloTransferencia });
  return { puntos, senales, motivos, dias };
}

const esTienda = (d) => d && (d.carrito || d.producto || d.precios >= 4);
module.exports = { JS_TIENDA, revisar, edadDominio, esTienda, raiz };
