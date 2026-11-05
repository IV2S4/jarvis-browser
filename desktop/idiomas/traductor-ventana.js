
// ── Idioma de la ventana (JARVIS OS) ──────────────────────────────────────
// build.sh pega este bloque al final de cada preload: traduce lo que se ve en la ventana
// al idioma elegido en Ajustes. Los textos originales están en español. [2026-10-28]
(() => {
  let datos = null;
  try { datos = require('electron').ipcRenderer.sendSync('idioma:diccionario'); } catch { return; }
  if (!datos || !datos.lang || datos.lang === 'es') return;
  const exactas = new Map(Object.entries(datos.exactas || {}));
  const esc = (p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patrones = (datos.patrones || []).map(([es, tr]) => {
    try {
      return [new RegExp('^' + es.split(/(\{\w+\})/).map((p) => (/^\{\w+\}$/.test(p) ? '(.+?)' : esc(p))).join('') + '$', 's'), tr, es.match(/\{\w+\}/g) || []];
    } catch { return null; }
  }).filter(Boolean);
  const traducir = (s) => {
    const limpio = (s || '').trim();
    if (!limpio || !/[A-Za-zÁÉÍÓÚáéíóúñÑ]/.test(limpio)) return null;
    const e = exactas.get(limpio.toLowerCase());
    if (e) return s.replace(limpio, e);
    for (const [rx, tr, nombres] of patrones) {
      const m = limpio.match(rx);
      if (m) { let o = tr; nombres.forEach((n, i) => { o = o.split(n).join(m[i + 1]); }); return s.replace(limpio, o); }
    }
    // «· tareas difíciles», «(opcional)», «— nota:»: se traduce lo de dentro y se dejan los adornos
    const ini = limpio.match(/^([\s·•—–\-:|›»]+)(.+)$/s);          // «· charla rápida (respaldo)»
    if (ini) { const d = exactas.get(ini[2].toLowerCase()); if (d) return s.replace(limpio, ini[1] + d); }
    const a = limpio.match(/^([\s·•—–\-(\[:|›»«]+)?(.*?)([\s·•—–\-)\]:|.…!?]+)?$/s);
    if (a && (a[1] || a[3]) && a[2] && a[2] !== limpio) {
      const dentro = exactas.get(a[2].toLowerCase());
      if (dentro) return s.replace(limpio, (a[1] || '') + dentro + (a[3] || ''));
    }
    return null;
  };
  const ATRIBUTOS = ['placeholder', 'title', 'aria-label', 'alt'];
  const NO = /^(SCRIPT|STYLE|TITLE|TEXTAREA|CODE|PRE)$/;
  const visto = new WeakMap();
  const pasar = (n) => {
    if (n.nodeType === 3) {
      const p = n.parentNode;
      if (!p || NO.test(p.nodeName) || p.isContentEditable || visto.get(n) === n.nodeValue || (p.closest && p.closest('[translate="no"]'))) return;
      const r = traducir(n.nodeValue);
      if (r != null && r !== n.nodeValue) n.nodeValue = r;
      visto.set(n, n.nodeValue);
    } else if (n.nodeType === 1 && /^(TEXTAREA|INPUT)$/.test(n.nodeName)) {   // cajas de texto: solo su texto de ayuda [28-oct]
      for (const a of ATRIBUTOS) {
        const v = n.getAttribute && n.getAttribute(a);
        if (v) { const r = traducir(v); if (r != null && r !== v) n.setAttribute(a, r); }
      }
      if (n.nodeName === 'INPUT' && /^(button|submit)$/i.test(n.type) && n.value) { const r = traducir(n.value); if (r) n.value = r; }
    } else if (n.nodeType === 1 && !NO.test(n.nodeName) && !n.isContentEditable && n.getAttribute('translate') !== 'no') {
      for (const a of ATRIBUTOS) {
        const v = n.getAttribute && n.getAttribute(a);
        if (v) { const r = traducir(v); if (r != null && r !== v) n.setAttribute(a, r); }
      }
      if (n.nodeName === 'INPUT' && /^(button|submit)$/i.test(n.type) && n.value) { const r = traducir(n.value); if (r) n.value = r; }
      n.childNodes.forEach(pasar);
    }
  };
  const empezar = () => {
    document.documentElement.lang = datos.lang;
    if (/^(ar|he|fa|ur)$/.test(datos.lang)) document.documentElement.dir = 'rtl';
    pasar(document.body);
    new MutationObserver((cambios) => {
      for (const c of cambios) {
        if (c.type === 'childList') c.addedNodes.forEach(pasar);
        else if (c.type === 'characterData') pasar(c.target);
        else if (c.type === 'attributes') {
          const v = c.target.getAttribute(c.attributeName);
          const r = v && traducir(v);
          if (r && r !== v) c.target.setAttribute(c.attributeName, r);
        }
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
  };
  if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', empezar); else empezar();
})();
