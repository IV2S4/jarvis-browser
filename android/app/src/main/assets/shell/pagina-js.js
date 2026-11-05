'use strict';
// Código que JARVIS mete en las páginas (copiado tal cual del navegador de PC, main.js) [04-nov]
const JS_VER = `(() => {
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < innerHeight && s.visibility !== 'hidden' && s.display !== 'none'; };
  const sel = 'a[href],button,input:not([type=hidden]),textarea,select,[role=button],[role=link],[role=tab],[role=menuitem],[role=checkbox],[contenteditable=true],summary';
  const out = []; let n = 1;
  document.querySelectorAll('[data-jarvis-id]').forEach((e) => e.removeAttribute('data-jarvis-id'));
  for (const el of document.querySelectorAll(sel)) {
    if (!vis(el) || out.length >= 160) continue;
    el.setAttribute('data-jarvis-id', String(n));
    const t = (el.getAttribute('aria-label') || el.innerText || el.value || el.placeholder || el.title || el.alt || '').replace(/\\s+/g, ' ').trim().slice(0, 80);
    out.push({ id: n++, tipo: el.tagName.toLowerCase() + (el.type ? ':' + el.type : ''), texto: t });
  }
  return out;
})()`;
const JS_DESTELLO = `(el) => { const r = el.getBoundingClientRect(); const d = document.createElement('div');
  d.style.cssText = 'position:fixed;z-index:2147483647;pointer-events:none;left:' + (r.left - 6) + 'px;top:' + (r.top - 6) + 'px;width:' + (r.width + 12) + 'px;height:' + (r.height + 12) + 'px;border:2px solid #38d6ff;border-radius:8px;box-shadow:0 0 18px #38d6ff,inset 0 0 12px rgba(56,214,255,.35);transition:all .6s ease;opacity:1';
  document.documentElement.appendChild(d); setTimeout(() => { d.style.opacity = '0'; d.style.transform = 'scale(1.15)'; }, 350); setTimeout(() => d.remove(), 1000); }`;
function buscarElemento(id, texto) {
  // por número (de "ver") o por el texto visible más parecido
  return `(() => { const destello = ${JS_DESTELLO};
    const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/\\s+/g, ' ').trim();
    let el = ${id ? `document.querySelector('[data-jarvis-id="${Number(id)}"]')` : 'null'};
    const q = norm(${JSON.stringify(texto || '')});
    if (!el && q) {
      const palabras = q.split(' ').filter((w) => w.length > 1);
      let mejor = null, pm = 1e9;
      for (const e of document.querySelectorAll('a,button,input,textarea,select,[role=button],[role=link],[role=tab],[role=menuitem],summary,label')) {
        const r = e.getBoundingClientRect(); if (r.width < 2 || r.height < 2) continue;
        const t = norm(e.getAttribute('aria-label') || e.innerText || e.value || e.placeholder || e.title);
        if (!t) continue;
        const p = t === q ? 0 : t.startsWith(q) ? 1 : t.includes(q) ? 2 + t.length / 200 : palabras.every((w) => t.includes(w)) ? 3 + t.length / 200 : 1e9;
        if (p < pm) { pm = p; mejor = e; }
      }
      el = mejor;
    }
    if (!el) return null;
    el.scrollIntoView({ block: 'center', behavior: 'instant' });
    destello(el);
    return el;
  })()`;
}
const JS_RAIZ = `(document.querySelector('#mw-content-text, main, article, [role=main], #content, .content') || document.body)`;
const JS_NORM = `const norm = (x) => String(x || '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/\\s+/g, ' ').trim();`;
const JS_DESCRIBIR = `(() => { ${JS_NORM} const raiz = ${JS_RAIZ};
  const titulos = [...document.querySelectorAll('h1, h2, h3')].map((h) => h.innerText.replace(/\\[editar\\]|\\s+/g, ' ').trim()).filter(Boolean).slice(0, 30);
  const imgs = [...raiz.querySelectorAll('img')].filter((i) => { const r = i.getBoundingClientRect(); return r.width >= 80 && r.height >= 80; }).slice(0, 15)
    .map((i, n) => { const fig = i.closest('figure, .thumb, .infobox, td, div'); const cap = (i.closest('figure') && i.closest('figure').querySelector('figcaption')) ? i.closest('figure').querySelector('figcaption').innerText : '';
      const r = i.getBoundingClientRect();
      return { n: n + 1, alt: (i.alt || i.title || '').slice(0, 120), leyenda: cap.slice(0, 160), ancho: Math.round(r.width), alto: Math.round(r.height), en_pantalla: r.top < innerHeight && r.bottom > 0 }; });
  return { titulo: document.title, url: location.href, titulos, imagenes: imgs, texto: raiz.innerText.replace(/\\n{3,}/g, '\\n\\n').slice(0, 14000) };
})()`;
const JS_SUBTITULOS = `(async () => { try {
  const pr = window.ytInitialPlayerResponse; const vid = new URLSearchParams(location.search).get('v');
  if (!pr || (pr.videoDetails && pr.videoDetails.videoId !== vid)) return '';
  const pistas = pr.captions && pr.captions.playerCaptionsTracklistRenderer && pr.captions.playerCaptionsTracklistRenderer.captionTracks;
  if (!pistas || !pistas.length) return '';
  const p = pistas.find((x) => !x.kind) || pistas[0];
  const j = await (await fetch(p.baseUrl + '&fmt=json3')).json();
  return (j.events || []).map((e) => (e.segs || []).map((s) => s.utf8).join('')).join(' ').replace(/\\s+/g, ' ').slice(0, 40000);
} catch (e) { return ''; } })()`;
const JS_TEXTOS = `(() => {
  const NO = /^(SCRIPT|STYLE|NOSCRIPT|CODE|PRE|TEXTAREA|SVG|MATH|KBD|SAMP)$/;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => {
    const p = n.parentElement; if (!p || NO.test(p.tagName) || p.isContentEditable || p.closest('[translate="no"],.notranslate')) return 2;
    const t = n.nodeValue.trim(); return (t.length < 2 || !/\\p{L}{2}/u.test(t)) ? 2 : 1; } });
  window.__jarvisTxt = []; const out = []; let n;
  while ((n = w.nextNode()) && out.length < 900) { window.__jarvisTxt.push(n); out.push(n.nodeValue.trim().slice(0, 600)); }
  return out; })()`;
const JS_PRECIO = `(() => {
  const num = (s) => { if (s == null) return null; s = String(s).replace(/\\s/g, ''); const m = s.match(/(\\d{1,3}(?:[.,]\\d{3})+(?:[.,]\\d{1,2})?|\\d+(?:[.,]\\d{1,2})?)/); if (!m) return null;
    let x = m[1]; if (/,\\d{1,2}$/.test(x) && !/\\.\\d{1,2}$/.test(x)) x = x.replace(/\\./g, '').replace(',', '.'); else x = x.replace(/,/g, ''); const n = parseFloat(x); return isFinite(n) && n > 0 && n < 1e7 ? n : null; };
  let precio = null, fuente = '';
  const probar = (v, f) => { if (precio == null) { const n = num(v); if (n) { precio = n; fuente = f; } } };
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) { try { const d = JSON.parse(s.textContent);
    for (const it of [].concat(d['@graph'] || d)) { const o = it && (it.offers || (it['@type'] === 'Offer' ? it : null)); for (const of of [].concat(o || [])) probar(of && (of.price ?? of.lowPrice), 'ld'); } } catch (e) {} }
  for (const sel of ['meta[itemprop=price]', 'meta[property="product:price:amount"]', 'meta[property="og:price:amount"]']) { const m = document.querySelector(sel); if (m) probar(m.content, 'meta'); }
  for (const sel of ['#corePrice_feature_div .a-offscreen', '#corePriceDisplay_desktop_feature_div .a-offscreen', '#priceblock_ourprice', '#priceblock_dealprice', '#apex_desktop .a-offscreen',
    '[data-testid="customer-price"] span', '.priceView-customer-price span', '.price-current', '[itemprop=price]', '[data-test="product-price"]', '[data-testid="price-wrap"] [itemprop=price]', '.x-price-primary', '.product-price', '.price'])
  { const e = document.querySelector(sel); if (e) probar(e.getAttribute('content') || e.textContent, sel); }
  if (precio == null) { let mejor = null, tam = 0;
    for (const e of document.querySelectorAll('span,div,p,strong,b,ins')) { if (e.children.length > 3) continue; const t = (e.textContent || '').trim();
      if (t.length > 24 || !/[$€£]\\s?\\d/.test(t)) continue; const r = e.getBoundingClientRect(); if (!r.width || r.top > 1800) continue;
      const f = parseFloat(getComputedStyle(e).fontSize); if (f > tam) { tam = f; mejor = t; } }
    probar(mejor, 'grande'); }
  const raiz = document.querySelector('main, article, [role=main], #content, #contents') || document.body;
  const txt = (raiz.innerText || '').replace(/\\s+/g, ' ').trim();
  const mon = (txt.match(/[$€£]|US\\$|R\\$/) || ['$'])[0];
  return { titulo: document.title, url: location.href, precio, fuente, moneda: mon, texto: txt.slice(0, 6000) };
})()`;
const NOMBRE_NATIVO = { es: 'Español', en: 'English', pt: 'Português', fr: 'Français', de: 'Deutsch', it: 'Italiano' };
function jsSubtitulos(lang, on, soloSiOtro) {
  const L = NOMBRE_NATIVO[lang] ? lang : 'es';
  return `(async () => {
    const p = document.getElementById('movie_player');
    if (!p || typeof p.getOption !== 'function') return 'sin-reproductor';
    if (!${Boolean(on)}) { try { p.setOption('captions', 'track', {}); p.unloadModule('captions'); } catch (e) {} return 'apagado'; }
    try { p.loadModule('captions'); } catch (e) {}
    let lista = [];
    for (let i = 0; i < 10 && !lista.length; i++) { try { lista = p.getOption('captions', 'tracklist') || []; } catch (e) {} if (!lista.length) await new Promise((r) => setTimeout(r, 500)); }
    if (!lista.length) return 'sin-subtitulos';
    const L = '${L}'; const de = (t) => String(t.languageCode || '').toLowerCase();
    const base = lista.find((t) => t.kind !== 'asr') || lista[0];
    if (${Boolean(soloSiOtro)} && de(base).startsWith(L)) { try { p.unloadModule('captions'); } catch (e) {} return 'mismo-idioma'; }
    const propia = lista.find((t) => de(t).startsWith(L) && t.kind !== 'asr') || lista.find((t) => de(t).startsWith(L));
    if (propia) { p.setOption('captions', 'track', propia); return 'original'; }
    p.setOption('captions', 'track', Object.assign({}, base, { translationLanguage: { languageCode: L, languageName: '${NOMBRE_NATIVO[L]}' } }));
    return 'traducido:' + de(base);
  })()`;
}
