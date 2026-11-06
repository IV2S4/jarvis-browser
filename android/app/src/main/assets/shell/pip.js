// JARVIS Browser — Video flotante (PiP). Se inyecta en la página activa.
// Mantiene el video sonando dentro de la ventanita, lo agranda para que llene la ventana
// y da play/pausa/adelantar a los botones de la ventana flotante.
(() => {
  if (window.__jarvisPip) return;
  const videos = () => {
    const l = [...document.querySelectorAll('video')];
    for (const f of document.querySelectorAll('iframe')) { try { l.push(...f.contentDocument.querySelectorAll('video')); } catch (e) { } }
    return l;
  };
  const area = (e) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
  const elegir = () => {
    const l = videos();
    return l.find((v) => !v.paused && !v.ended) || l.filter((v) => v.readyState > 0).sort((a, b) => area(b) - area(a))[0] || l[0] || null;
  };
  let activo = false, vid = null, quiere = false, estilo = null, tocados = [], marco = null;

  // Mientras está flotando, la página cree que sigue a la vista (YouTube y otros pausan si no).
  const bloquear = (e) => { if (activo && (e.target === window || e.target === document)) e.stopImmediatePropagation(); };
  for (const ev of ['visibilitychange', 'webkitvisibilitychange', 'pagehide', 'freeze', 'blur']) {
    window.addEventListener(ev, bloquear, true); document.addEventListener(ev, bloquear, true);
  }
  const fingir = () => {
    const d = (k, v) => { try { Object.defineProperty(document, k, { configurable: true, get: () => v }); } catch (e) { } };
    d('hidden', false); d('webkitHidden', false); d('visibilityState', 'visible'); d('webkitVisibilityState', 'visible');
    try { document.hasFocus = () => true; } catch (e) { }
  };
  const desfingir = () => { for (const k of ['hidden', 'webkitHidden', 'visibilityState', 'webkitVisibilityState', 'hasFocus']) { try { delete document[k]; } catch (e) { } } };

  // Que el video llene toda la ventanita.
  const ampliar = (el) => {
    estilo = document.createElement('style');
    estilo.textContent = 'html,body{overflow:hidden!important;background:#000!important}' +
      '.__jpv{position:fixed!important;left:0!important;top:0!important;right:auto!important;bottom:auto!important;width:100vw!important;height:100vh!important;' +
      'max-width:none!important;max-height:none!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;' +
      'object-fit:contain!important;z-index:2147483647!important;background:#000!important;transform:none!important;visibility:visible!important;opacity:1!important}';
    document.documentElement.appendChild(estilo);
    el.classList.add('__jpv'); marco = el;
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      tocados.push([a, a.getAttribute('style')]);
      for (const [k, v] of [['transform', 'none'], ['filter', 'none'], ['contain', 'none'], ['will-change', 'auto'], ['z-index', '2147483647'], ['overflow', 'visible'], ['visibility', 'visible'], ['opacity', '1']]) a.style.setProperty(k, v, 'important');
    }
  };
  const restaurar = () => {
    if (estilo) estilo.remove(); estilo = null;
    if (marco) marco.classList.remove('__jpv'); marco = null;
    for (const [a, s] of tocados) { if (s === null) a.removeAttribute('style'); else a.setAttribute('style', s); }
    tocados = [];
  };
  // Mientras flota, la página no puede pausar el video por su cuenta (YouTube lo pausaba y lo
  // reanudábamos sin parar: eso era el sonido «trabado»). Solo pausan los botones de la ventanita.
  const pausaReal = HTMLMediaElement.prototype.pause;
  const blindar = (v) => { try { Object.defineProperty(v, 'pause', { configurable: true, writable: true, value: function () { if (activo && quiere) return; return pausaReal.call(this); } }); } catch (e) { } };
  const desblindar = (v) => { try { delete v.pause; } catch (e) { } };
  const reanudar = () => { if (activo && quiere && vid && vid.paused && !vid.ended) { const p = vid.play(); if (p && p.catch) p.catch(() => { }); } };
  let pausas = [];
  const alPausar = () => {   // pausa que no vino de JS (el propio navegador): reanudar, pero sin pelear en bucle
    if (!activo || !quiere) return;
    const t = Date.now(); pausas = pausas.filter((x) => t - x < 10000); pausas.push(t);
    setTimeout(reanudar, pausas.length > 4 ? 2500 : 300);
  };
  const estado = () => {
    const v = vid || elegir();
    return { hay: !!v, sonando: !!v && !v.paused && !v.ended, w: v ? v.videoWidth : 0, h: v ? v.videoHeight : 0 };
  };

  window.__jarvisPip = {
    on() {
      if (activo) return estado();
      activo = true; fingir();
      vid = elegir();
      if (!vid) {   // video dentro de un iframe de otro sitio: al menos que el iframe llene la ventana
        const f = [...document.querySelectorAll('iframe')].sort((a, b) => area(b) - area(a))[0];
        if (f && area(f) > 0) ampliar(f);
        return estado();
      }
      quiere = !vid.paused && !vid.ended;
      ampliar(vid);
      blindar(vid); vid.addEventListener('pause', alPausar);
      for (const ms of [200, 700, 1500, 3000]) setTimeout(reanudar, ms);
      return estado();
    },
    off() {
      if (!activo) return estado();
      activo = false; desfingir(); restaurar();
      if (vid) { vid.removeEventListener('pause', alPausar); desblindar(vid); }
      const e = estado(); vid = null; return e;
    },
    alternar() {
      if (!vid) vid = elegir();
      if (!vid) return estado();
      if (vid.paused || vid.ended) { quiere = true; const p = vid.play(); if (p && p.catch) p.catch(() => { }); } else { quiere = false; pausaReal.call(vid); }
      return { hay: true, sonando: quiere, w: vid.videoWidth, h: vid.videoHeight };
    },
    mover(s) {
      const v = vid || elegir(); if (!v) return estado();
      const fin = isFinite(v.duration) ? v.duration : Infinity;
      v.currentTime = Math.max(0, Math.min(fin, v.currentTime + s));
      return estado();
    },
    pausar() { quiere = false; const v = vid || elegir(); if (v && !v.paused) pausaReal.call(v); return estado(); },
    estado,
  };
})();
