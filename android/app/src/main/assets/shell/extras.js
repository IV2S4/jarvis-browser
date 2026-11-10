'use strict';
// Escáner + mapa, terminal, monitor del teléfono y Ajustes [04-nov]

// ════════ 🛡 Escáner de amenazas ════════
const MARCAS = ['paypal', 'apple', 'icloud', 'microsoft', 'outlook', 'office365', 'google', 'gmail', 'amazon', 'netflix', 'facebook', 'instagram', 'whatsapp', 'bankofamerica', 'chase', 'wellsfargo', 'banco', 'popular', 'evertec', 'steam', 'epicgames', 'roblox', 'binance', 'coinbase', 'metamask', 'ebay', 'usps', 'fedex', 'dhl', 'irs'];
const TLD_RAROS = /\.(zip|mov|xyz|top|tk|ml|ga|cf|gq|click|country|kim|work|rest|fit|buzz|cyou|icu|sbs|cfd|monster|lol|quest)$/i;
const dominioBase = (h) => h.split('.').slice(-2).join('.');
function riesgo(url, d) {   // las mismas pistas que en la PC (lib/escaner.js)
  const pistas = []; let puntos = 0; let u; try { u = new URL(url); } catch { return { nivel: 'bajo', pistas }; }
  const h = u.hostname.toLowerCase();
  if (u.protocol === 'http:') { puntos += 2; pistas.push('sin-https'); }
  if (d && d.certError) { puntos += 4; pistas.push('certificado'); }
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) { puntos += 3; pistas.push('ip'); }
  if (h.includes('xn--')) { puntos += 3; pistas.push('letras-disfrazadas'); }
  if (TLD_RAROS.test(h)) { puntos += 2; pistas.push('dominio-raro'); }
  if (h.split('.').length > 4) { puntos += 1; pistas.push('muchos-subdominios'); }
  if ((h.match(/-/g) || []).length >= 3) { puntos += 1; pistas.push('muchos-guiones'); }
  const base = dominioBase(h); const marca = MARCAS.find((m) => h.includes(m) && !base.includes(m));
  if (marca) { puntos += 3; pistas.push('marca:' + marca); }
  if (/^(localhost|127\.|10\.|192\.168\.)/.test(h)) { puntos = 0; pistas.length = 0; }
  return { nivel: puntos >= 5 ? 'alto' : puntos >= 2 ? 'medio' : 'bajo', puntos, pistas };
}
const PISTAS = { 'sin-https': ['La conexión no está cifrada (HTTP).', 'The connection is not encrypted (HTTP).'], certificado: ['El certificado de seguridad no es válido.', 'The security certificate is not valid.'],
  ip: ['La dirección es un número (IP), no un nombre.', 'The address is a raw IP number.'], 'letras-disfrazadas': ['Usa letras disfrazadas (xn--) para parecerse a otra web.', 'It uses disguised letters (xn--) to look like another site.'],
  'dominio-raro': ['Usa un dominio poco común, frecuente en estafas.', 'It uses an unusual domain, common in scams.'], 'muchos-subdominios': ['Tiene demasiados subdominios.', 'It has too many subdomains.'], 'muchos-guiones': ['Tiene muchos guiones en el nombre.', 'It has many hyphens in the name.'] };
const pista = (p) => (p.startsWith('marca:') ? T(`Usa el nombre «${p.slice(6)}» en un dominio que no es suyo.`, `It uses the name “${p.slice(6)}” on a domain that isn't theirs.`) : (PISTAS[p] ? T(...PISTAS[p]) : p));
let escaneo = null; let avisadoAlto = '';
function pintarEscudo() {
  const r = escaneo; const ch = $('escudo');
  if (!r || esInicio(r.url) || cfg.escaner === false) { ch.className = 'chip-escudo'; $('escudo-n').textContent = '0'; return; }
  const k = riesgo(r.url, r); r.nivel = k.nivel; r.pistas = k.pistas;
  ch.className = 'chip-escudo ' + k.nivel; $('escudo-n').textContent = String((r.rastreadores || 0) + (r.anuncios || 0));
  if (k.nivel === 'alto' && avisadoAlto !== r.url) {   // parece una estafa: aviso rojo arriba
    avisadoAlto = r.url; $('aviso-txt').textContent = `⚠ ${hostDe(r.url)} ${T('parece peligrosa', 'looks dangerous')}: ${k.pistas.map(pista).join(' ').slice(0, 160)}`;
    $('aviso-barra').hidden = false; H('vibrar', { ms: 60 }); hablar(T('Cuidado, señor: esta página parece peligrosa.', 'Careful, sir: this page looks dangerous.'));
  }
}
$('aviso-x').addEventListener('click', () => { $('aviso-barra').hidden = true; });
$('aviso-salir').addEventListener('click', () => { $('aviso-barra').hidden = true; H('atras'); });
nav.en('escaner', (r) => { escaneo = r; if (!r || r.url !== avisadoAlto) $('aviso-barra').hidden = true; pintarEscudo(); if (!$('p-escaner').hidden) pintarEscaner(false); });
$('escudo').addEventListener('click', () => abrirPanel('escaner'));
let mapaDatos = null; let mapaAnim = 0; let bitsMapa = null;
async function pintarEscaner(conMapa) {
  const r = (await H('escaneo')) || escaneo; if (!r) return; escaneo = r; pintarEscudo();
  const host = hostDe(r.url); const propio = dominioBase(host || 'x');
  const hosts = (r.hosts || []).map((x) => ({ ...x, propio: dominioBase(x.host) === propio })).sort((a, b) => Number(b.propio) - Number(a.propio) || b.n - a.n);
  const k = riesgo(r.url, r);
  $('esc-tarjeta').className = 'esc-tarjeta ' + k.nivel;
  $('esc-nivel').textContent = esInicio(r.url) ? 'JARVIS' : `${T('RIESGO', 'RISK')} ${{ bajo: T('BAJO', 'LOW'), medio: T('MEDIO', 'MEDIUM'), alto: T('ALTO', 'HIGH') }[k.nivel]}`;
  $('esc-host').textContent = esInicio(r.url) ? T('Página de inicio', 'Start page') : host;
  $('esc-r').textContent = r.rastreadores || 0; $('esc-a').textContent = r.anuncios || 0; $('esc-t').textContent = hosts.filter((x) => !x.propio).length;
  $('esc-h').textContent = /^https:/.test(r.url) ? 'HTTPS' : esInicio(r.url) ? '—' : 'HTTP';
  $('esc-pistas').innerHTML = k.pistas.map((p) => `<div>⚠ ${esc(pista(p))}</div>`).join('');
  $('esc-hosts').innerHTML = hosts.slice(0, 40).map((x) => `<div class="${x.bloqueado ? 'bloq' : x.propio ? 'prop' : ''}">${x.bloqueado ? '✕' : x.propio ? '●' : '○'} ${esc(x.host)} <span class="tenue">×${x.n}</span></div>`).join('');
  if (conMapa && !esInicio(r.url)) cargarMapa(hosts);
  dibujarMapa();
}
let yo = null; const geo = new Map();
async function cargarMapa(hosts) {
  $('mapa-txt').textContent = T('Buscando dónde están los servidores…', 'Locating servers…');
  const lista = hosts.slice(0, 30).map((h) => h.host);
  const ips = (await H('dns', { hosts: lista })) || {};
  const faltan = [...new Set(Object.values(ips))].filter((ip) => !geo.has(ip) && !/^(10\.|127\.|192\.168\.)/.test(ip));
  try {
    if (faltan.length) { const r = await Nativo.fetch('http://ip-api.com/batch?fields=status,query,country,countryCode,city,lat,lon', { method: 'POST', body: JSON.stringify(faltan.slice(0, 100)) }); for (const x of await r.json()) if (x.status === 'success') geo.set(x.query, x); }
    if (!yo) { const r = await Nativo.fetch('http://ip-api.com/json/?fields=status,country,countryCode,city,lat,lon'); const x = await r.json(); if (x.status === 'success') yo = x; }
  } catch { /* sin mapa esta vez */ }
  const info = new Map(hosts.map((h) => [h.host, h]));
  mapaDatos = { yo, servidores: lista.map((h) => { const g = geo.get(ips[h]); return g ? { host: h, ...g, bloqueado: (info.get(h) || {}).bloqueado, propio: (info.get(h) || {}).propio } : null; }).filter(Boolean) };
  const paises = new Set(mapaDatos.servidores.map((s) => s.countryCode)).size;
  $('mapa-txt').textContent = `${mapaDatos.servidores.length} ${T('servidores', 'servers')} · ${paises} ${T('países', 'countries')}${yo ? ` · ${T('tú', 'you')}: ${yo.city || yo.country}` : ''}`;
  dibujarMapa();
}
function dibujarMapa() {
  const cv = $('mapa'); const M = window.MAPA_MUNDO; if (!M || $('p-escaner').hidden) return;
  const dpr = Math.min(3, devicePixelRatio || 1); const W = cv.clientWidth || 360; const H2 = Math.round(W * 0.5);
  if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = H2 * dpr; cv.style.height = H2 + 'px'; }
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!bitsMapa) bitsMapa = Uint8Array.from(atob(M.b64), (ch) => ch.charCodeAt(0));
  const xy = (lat, lon) => [((lon + 180) / 360) * W, ((M.latMax - lat) / (2 * M.latMax)) * H2]; const t0 = performance.now();
  const cuadro = (ahora) => {
    c.clearRect(0, 0, W, H2); c.fillStyle = `rgba(${TEMA.c1},.28)`; const cw = W / M.W; const ch = H2 / M.H;
    for (let r = 0; r < M.H; r++) for (let k = 0; k < M.W; k++) { const i = r * M.W + k; if (bitsMapa[i >> 3] & (1 << (7 - (i & 7)))) c.fillRect(k * cw + cw * 0.25, r * ch + ch * 0.25, Math.max(1, cw * 0.5), Math.max(1, ch * 0.5)); }
    if (mapaDatos && mapaDatos.yo) {
      const [x0, y0] = xy(mapaDatos.yo.lat, mapaDatos.yo.lon); const t = (ahora - t0) / 1000;
      mapaDatos.servidores.forEach((s, n) => {
        const [x1, y1] = xy(s.lat, s.lon); const col = s.bloqueado ? '255,92,122' : s.propio ? '61,255,181' : TEMA.c1;
        const cx = (x0 + x1) / 2; const cy = Math.min(y0, y1) - Math.max(10, Math.hypot(x1 - x0, y1 - y0) * 0.3);
        c.strokeStyle = `rgba(${col},.35)`; c.lineWidth = 1; c.beginPath(); c.moveTo(x0, y0); c.quadraticCurveTo(cx, cy, x1, y1); c.stroke();
        const k = (t * 0.5 + n * 0.17) % 1; c.fillStyle = `rgba(${col},.95)`; c.beginPath(); c.arc((1 - k) ** 2 * x0 + 2 * (1 - k) * k * cx + k * k * x1, (1 - k) ** 2 * y0 + 2 * (1 - k) * k * cy + k * k * y1, 1.6, 0, 7); c.fill();
        c.beginPath(); c.arc(x1, y1, 2.2 + Math.sin(t * 3 + n), 0, 7); c.fill();
      });
      const pul = 3 + Math.sin(t * 4); c.fillStyle = '#fff'; c.beginPath(); c.arc(x0, y0, pul, 0, 7); c.fill();
    }
    if (!$('p-escaner').hidden && !$('panel').hidden) mapaAnim = requestAnimationFrame(cuadro);
  };
  cancelAnimationFrame(mapaAnim); mapaAnim = requestAnimationFrame(cuadro);
}

// ════════ 📟 Monitor del teléfono (barra de abajo) ════════
const tasa = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)}M` : b >= 1024 ? `${Math.round(b / 1024)}K` : `${Math.round(b || 0)}B`);
let ultMon = null;
async function monitor() {
  if (cfg.monitor === false || document.hidden) { $('h-mon').textContent = ''; return; }
  const m = await H('monitor'); if (!m) return; ultMon = m;
  const term = ['', '', '🌡', '🌡', '🔥', '🔥', '🔥'][m.termico || 0] || '';
  $('h-mon').innerHTML = `🔋${m.bateria}%${m.cargando ? '⚡' : ''} · RAM ${m.ram}% · ↓${tasa(m.bajada)} ${term}`;
}
setInterval(monitor, 3000);

// ════════ ⌨ Terminal ════════
const TERM_CMDS = ['help', 'open', 'go', 'search', 'tabs', 'tab', 'close', 'reopen', 'new', 'private', 'back', 'forward', 'reload', 'scan', 'map', 'trace', 'sys', 'theme', 'pip', 'translate', 'summarize', 'phone', 'history', 'bookmarks', 'remember', 'memory', 'settings', 'ask', 'clear', 'exit'];
const term = { hist: [], pos: -1, arrancada: false };
function tl(t, c = '') { const d = document.createElement('div'); d.className = c; d.textContent = t; $('term-salida').appendChild(d); $('term-salida').scrollTop = $('term-salida').scrollHeight; }
function abrirTerminal() {
  abrirCapa('terminal', false);
  if (!term.arrancada) {
    term.arrancada = true;
    [['J.A.R.V.I.S  ANDROID TERMINAL  v1.0', 'titulo'], [`${new Date().toLocaleString()} · ${E.pestanas.length} tabs · session secure`, 'tenue'], [T('Escribe «help». Lo que no sea un comando se lo pregunto a JARVIS.', 'Type “help”. Anything else goes to JARVIS.'), 'tenue']].forEach(([t, c], i) => setTimeout(() => tl(t, c), i * 90));
    $('term-atajos').innerHTML = ['help', 'tabs', 'scan', 'sys', 'trace ', 'open ', 'reopen', 'clear'].map((c) => `<button data-c="${c}">${c.trim()}</button>`).join('');
  }
  setTimeout(() => $('term-in').focus(), 80);
}
$('term-x').addEventListener('click', () => cerrarCapa('terminal'));
$('term-atajos').addEventListener('click', (ev) => { const b = ev.target.closest('[data-c]'); if (!b) return; if (b.dataset.c.endsWith(' ')) { $('term-in').value = b.dataset.c; $('term-in').focus(); } else ejecutar(b.dataset.c); });
$('term-in').addEventListener('keydown', (ev) => {
  if (ev.key === 'ArrowUp' && term.hist.length) { term.pos = Math.min(term.hist.length - 1, term.pos + 1); $('term-in').value = term.hist[term.pos]; ev.preventDefault(); }
  if (ev.key === 'Enter') { ev.preventDefault(); const q = $('term-in').value; $('term-in').value = ''; ejecutar(q); }
});
async function ejecutar(linea) {
  const q = String(linea || '').trim(); if (!q) return;
  term.hist.unshift(q); term.pos = -1; tl(`jarvis:~$ ${q}`, 'eco');
  const [c0, ...resto] = q.split(/\s+/); const arg = resto.join(' '); const cmd = c0.toLowerCase();
  const ok = (t) => tl(t, 'ok'); const mal = (t) => tl(t, 'mal');
  switch (cmd) {
    case 'help': case 'ayuda':
      tl(T('COMANDOS', 'COMMANDS'), 'titulo');
      [['open <site>', T('abre en pestaña nueva', 'opens in a new tab')], ['go <site>', T('abre aquí', 'opens here')], ['search <text>', T('busca', 'searches the web')], ['tabs · tab <n>', T('pestañas', 'tabs')], ['close [n] · reopen', T('cerrar / reabrir', 'close / reopen')],
        ['new · private', T('pestaña nueva / privada', 'new / private tab')], ['back · forward · reload', T('navegar', 'navigate')], ['scan · map', T('escáner y mapa', 'scanner and map')], ['trace <site>', T('IP, país y ping', 'IP, country and ping')],
        ['sys', T('batería, RAM, red', 'battery, RAM, network')], ['theme <cyan|red|matrix|purple|gold>', T('cambia el color', 'changes the color')], ['pip', T('video flotante', 'floating video')], ['translate · summarize', T('la página', 'the page')],
        ['phone', T('manda la página por Telegram', 'sends the page via Telegram')], ['history <text> · bookmarks', T('buscar', 'search')], ['remember <fact> · memory', T('memoria de JARVIS', 'JARVIS memory')], ['settings', T('ajustes', 'settings')], ['ask <question>', T('pregúntale a JARVIS', 'ask JARVIS')], ['clear · exit', '']]
        .forEach(([a, b]) => tl(`  ${a.padEnd(24)} ${b}`)); return;
    case 'open': if (!arg) return mal('Usage: open <site>'); H('nueva', { url: aUrl(/^[\w-]+$/.test(arg) ? arg + '.com' : arg) }); ok('→ ' + arg); return setTimeout(() => cerrarCapa('terminal'), 500);
    case 'go': if (!arg) return mal('Usage: go <site>'); ir(aUrl(arg)); ok('→ ' + arg); return setTimeout(() => cerrarCapa('terminal'), 500);
    case 'search': if (!arg) return mal('Usage: search <text>'); H('nueva', { url: (BUSCADORES[cfg.buscador] || BUSCADORES.google)[1] + encodeURIComponent(arg) }); ok('🔎 ' + arg); return setTimeout(() => cerrarCapa('terminal'), 500);
    case 'tabs': tl(`${E.pestanas.length} ${T('PESTAÑAS', 'TABS')}`, 'titulo'); E.pestanas.forEach((p, i) => tl(`  ${String(i + 1).padStart(2)} ${p.id === E.activa ? '▶' : ' '} ${(p.inicio ? 'New tab' : p.titulo || p.url).slice(0, 60)}`, p.id === E.activa ? 'ok' : '')); return;
    case 'tab': { const p = E.pestanas[Number(arg) - 1]; if (!p) return mal(T('No existe esa pestaña.', 'No such tab.')); H('activar', { id: p.id }); return ok('→ #' + arg); }
    case 'close': { const p = arg ? E.pestanas[Number(arg) - 1] : null; H('cerrar', p ? { id: p.id } : {}); return ok(T('✕ cerrada', '✕ closed')); }
    case 'reopen': { const u = await H('reabrir'); return u ? ok('↺ ' + u) : tl(T('No hay pestañas cerradas.', 'No closed tabs.'), 'aviso'); }
    case 'new': H('nueva', { url: INICIO }); return ok('+');
    case 'private': H('nueva', { url: INICIO, privada: true }); return ok('🕶');
    case 'back': H('atras'); return ok('←'); case 'forward': H('adelante'); return ok('→'); case 'reload': H('recargar'); return ok('⟳');
    case 'scan': { const r = (await H('escaneo')) || {}; const k = riesgo(r.url || '', r); tl(`SCAN ${hostDe(r.url || '')}`, 'titulo');
      tl(`  ${T('RIESGO', 'RISK')} ........ ${k.nivel.toUpperCase()}`, k.nivel === 'bajo' ? 'ok' : k.nivel === 'medio' ? 'aviso' : 'mal'); tl(`  HTTPS ......... ${/^https:/.test(r.url || '') ? 'YES' : 'NO'}`);
      tl(`  ${T('RASTREADORES', 'TRACKERS')} .. ${r.rastreadores || 0}`); tl(`  ${T('ANUNCIOS', 'ADS')} ....... ${r.anuncios || 0}`); (r.hosts || []).slice(0, 8).forEach((h) => tl(`    ${h.bloqueado ? '✕' : '○'} ${h.host}`, h.bloqueado ? 'mal' : 'tenue')); return; }
    case 'map': cerrarCapa('terminal'); return abrirPanel('escaner');
    case 'trace': {
      let h = arg || hostDe(E.url); try { h = new URL(/^\w+:\/\//.test(h) ? h : 'https://' + h).hostname; } catch { /* */ }
      if (!h) return mal('Usage: trace <site>'); tl(`TRACE ${h}`, 'titulo');
      const ips = await H('dns', { hosts: [h] }); const ip = ips && ips[h]; if (!ip) return mal(T('  No resuelve.', '  Does not resolve.'));
      tl(`  IP ........ ${ip}`); const t0 = performance.now(); const r = await Nativo.fetch('https://' + h + '/', { method: 'HEAD', timeout: 6000 }); const ms = Math.round(performance.now() - t0);
      tl(`  PING ...... ${r.status ? ms + ' ms' : '—'}`, ms < 200 ? 'ok' : 'aviso');
      try { const g = await (await Nativo.fetch(`http://ip-api.com/json/${ip}?fields=status,country,countryCode,city,org`)).json(); if (g.status === 'success') { tl(`  LOCATION .. [${g.countryCode}] ${g.city || ''}, ${g.country}`); tl(`  NETWORK ... ${g.org}`); } } catch { /* */ }
      const k = riesgo('https://' + h, null); return tl(`  RISK ...... ${k.nivel.toUpperCase()}`, k.nivel === 'bajo' ? 'ok' : 'aviso');
    }
    case 'sys': { const m = (await H('monitor')) || {}; tl(T('TELÉFONO', 'PHONE'), 'titulo'); const barra = (v) => '█'.repeat(Math.round(v / 10)) + '░'.repeat(10 - Math.round(v / 10));
      tl(`  BAT  ${barra(m.bateria || 0)} ${m.bateria}% ${m.cargando ? '⚡' : ''} · ${m.temp}°C`); tl(`  RAM  ${barra(m.ram || 0)} ${m.ram}%`); tl(`  NET  ↓ ${tasa(m.bajada)}/s  ↑ ${tasa(m.subida)}/s`); return; }
    case 'theme': { const m = { cyan: 'cian', red: 'rojo', matrix: 'verde', green: 'verde', purple: 'morado', gold: 'dorado', cian: 'cian', rojo: 'rojo', morado: 'morado', dorado: 'dorado' }[arg.toLowerCase()]; if (!m) return mal('theme cyan|red|matrix|purple|gold'); guardarCfg({ tema: m }); ponerTema(m); return ok('🎨 ' + arg); }
    case 'pip': cerrarCapa('terminal'); H('pip'); return;
    case 'translate': cerrarCapa('terminal'); traducirPagina(arg ? arg.slice(0, 2) : undefined); return;
    case 'summarize': cerrarCapa('terminal'); resumirAqui(); return;
    case 'phone': { const r = await enviarTelefono(); return r.ok ? ok('📱 sent') : tl(T('Telegram no conectado: abrí el menú de compartir.', 'Telegram not connected: opened the share menu.'), 'aviso'); }
    case 'history': { const q2 = arg.toLowerCase(); historial.filter((h) => !q2 || (h.titulo + h.url).toLowerCase().includes(q2)).slice(-12).reverse().forEach((h) => tl(`  ${new Date(h.t).toLocaleDateString()}  ${(h.titulo || h.url).slice(0, 52)}`)); return; }
    case 'bookmarks': favoritos.slice(0, 20).forEach((f) => tl(`  ★ ${(f.titulo || f.url).slice(0, 60)}`)); return;
    case 'remember': { const r = recordar(arg); return r.ok ? ok('💾 ' + arg) : mal('✕'); }
    case 'memory': memoria.forEach((m) => tl(`  • ${m.texto}`)); return memoria.length ? undefined : tl('  (empty)', 'tenue');
    case 'settings': cerrarCapa('terminal'); return abrirAjustes();
    case 'clear': $('term-salida').innerHTML = ''; return;
    case 'exit': return cerrarCapa('terminal');
    case 'ask': default: { const pregunta = cmd === 'ask' ? arg : q; cerrarCapa('terminal'); chatear(pregunta); }
  }
}

// ════════ ⚙ Ajustes ════════
const SW = (id, titulo, sub) => `<div class="aj-fila"><span>${titulo}${sub ? `<small>${sub}</small>` : ''}</span><label class="sw"><input type="checkbox" data-cfg="${id}" ${cfg[id] !== false && cfg[id] ? 'checked' : ''} /><i></i></label></div>`;
const LLAVE = (p, nombre, sub, enlace) => `<div class="aj-fila col"><span>${nombre}<small>${sub}</small><small class="estado" id="ll-${p}"></small></span>
  <input type="password" id="in-${p}" placeholder="${T('Pega la llave aquí', 'Paste the key here')}" autocomplete="off" />
  <div class="fila-botones"><button class="pri" data-guardar="${p}">${T('Guardar', 'Save')}</button><button class="sec" data-enlace="${enlace}">${T('Conseguir llave', 'Get key')}</button><button class="sec" data-probar="${p}">${T('Probar', 'Test')}</button><button class="sec" data-quitar="${p}">${T('Quitar', 'Remove')}</button></div></div>`;
let seccionAj = '';
function abrirAjustes(sec = '') {
  seccionAj = sec;
  const s = $('ajustes');
  s.innerHTML = `<div class="aj-cab"><button id="aj-x">❮</button><b>${T('AJUSTES', 'SETTINGS')}</b></div>
  <div class="aj-sec" id="aj-general"><h3>${T('General', 'General')}</h3><div class="aj-tarjeta">
    <div class="aj-fila"><span>${T('Idioma', 'Language')}<small>${T('Menús y respuestas de JARVIS', 'Menus and JARVIS replies')}</small></span><select data-sel="idioma"><option value="en">English</option><option value="es">Español</option></select></div>
    <div class="aj-fila col"><span>${T('Tema de colores', 'Color theme')}</span><div class="temas" id="aj-temas">${[['cian', 'Cyan', '56,214,255'], ['rojo', 'Red', '255,64,88'], ['verde', 'Matrix', '0,255,120'], ['morado', 'Purple', '170,110,255'], ['dorado', 'Gold', '255,190,60']].map(([k, n, c]) => `<button data-tema="${k}" class="${cfg.tema === k ? 'activo' : ''}"><i style="background:rgb(${c});box-shadow:0 0 8px rgb(${c})"></i>${n}</button>`).join('')}</div></div>
    <div class="aj-fila"><span>${T('Buscador', 'Search engine')}</span><select data-sel="buscador">${Object.entries(BUSCADORES).map(([k, [n]]) => `<option value="${k}">${n}</option>`).join('')}</select></div>
    ${SW('monitor', T('Monitor del teléfono', 'Phone monitor'), T('Batería, RAM e internet en la barra de abajo', 'Battery, RAM and network in the bottom bar'))}
    ${SW('pipAuto', T('Video flotante al salir', 'Floating video when leaving'), T('Si sales de la app con un video sonando, sigue en una ventanita', 'If you leave the app with a video playing, it keeps going in a small window'))}
    <div class="aj-fila"><span>${T('Navegador predeterminado', 'Default browser')}<small>${T('Que los enlaces de WhatsApp, correos… se abran aquí', 'Open links from WhatsApp, email… here')}</small></span><button class="sec" id="aj-pred">${T('Elegir', 'Choose')}</button></div>
  </div></div>
  <div class="aj-sec" id="aj-inteligente"><h3>🚀 ${T('Funciones inteligentes', 'Smart features')}</h3><div class="aj-tarjeta">
    ${SW('camaraPausa', '💤 ' + T('Pausa automática', 'Auto pause'), T('Con los gestos encendidos: si dejas de mirar el teléfono, el video se pausa; cuando vuelves, sigue solo', 'With gestures on: if you stop looking at the phone, the video pauses; when you come back, it keeps playing'))}
    ${SW('camaraGuardian', '👁 ' + T('Guardián de privacidad', 'Privacy guard'), T('Con los gestos encendidos: si otra persona mira tu pantalla, la página se tapa hasta que se vaya', 'With gestures on: if someone else looks at your screen, the page is covered until they leave'))}
    ${SW('memoriaNavegador', '🧠 ' + T('Memoria del navegador', 'Browser memory'), T('Guarda en el teléfono un pedacito del texto de cada página (nunca privadas, bancos ni contraseñas). Pregunta: «Jarvis, ¿dónde vi unos tenis rojos?»', 'Keeps on the phone a bit of each page\'s text (never private tabs, banks or passwords). Ask: “Jarvis, where did I see some red sneakers?”'))}
    ${SW('doblajeEnVivo', '🗣 ' + T('Doblaje en vivo', 'Live dubbing'), T('En un video: «Jarvis, dobla este video». Lee los subtítulos traducidos con una voz nativa del idioma y baja el sonido original', 'On a video: “Jarvis, dub this video”. Reads the translated subtitles with a native voice and lowers the original sound'))}
    ${SW('buscaLoQueVes', '📸 ' + T('Busca lo que ves', 'Search what you see'), T('«Jarvis, ¿qué es esto?»: se abre la cámara de atrás, apuntas, tocas 📸 y te dice qué es y lo busca', '“Jarvis, what is this?”: the back camera opens, you point, tap 📸 and it tells you what it is and searches it'))}
    ${SW('conversacionVivo', '🗣 ' + T('Conversación en vivo', 'Live conversation'), T('Toca «🗣 En vivo» en el chat de JARVIS y habla con él como en una llamada; te contesta al momento y puedes interrumpirlo. Usa tu llave de Gemini', 'Tap “🗣 Live” in the JARVIS chat and talk like a phone call; it answers instantly and you can interrupt it. Uses your Gemini key'))}
    ${SW('detectorEstafas', '🛡 ' + T('Detector de estafas', 'Scam detector'), T('Al entrar a una tienda revisa la edad del dominio, si imita a una marca y otras señales; si parece fraude, te avisa', 'When you enter a store it checks the domain age, brand imitation and other signs; if it looks like fraud, it warns you'))}
    ${SW('preguntaVideo', '🎬 ' + T('Pregúntale al video', 'Ask the video'), T('En YouTube pregunta «¿en qué minuto explica…?» o toca «🎬 Capítulos»: los minutos saltan a ese momento', 'On YouTube ask “at what minute does he explain…?” or tap “🎬 Chapters”: timestamps jump to that moment'))}
    ${SW('investigador', '🕵 ' + T('Investigador en segundo plano', 'Background researcher'), T('«Jarvis, investiga las mejores laptops gaming de menos de $1,500»: busca mientras sigues navegando y te deja un informe con tabla y fuentes en el chat', '“Jarvis, research the best gaming laptops under $1,500”: it searches while you keep browsing and leaves a report with a table and sources in the chat'))}
    ${SW('comparadorPrecios', '💰 ' + T('Comparador de precios', 'Price comparison'), T('En la página de un producto busca el mismo en otras tiendas y te avisa si está más barato, con fotos y precios en el chat', 'On a product page it looks for the same product in other stores and tells you if it is cheaper, with photos and prices in the chat'))}
  </div></div>
  <div class="aj-sec" id="aj-continuar"><h3>🔄 ${T('Continuar en la PC', 'Continue on PC')}</h3><p class="tenue" style="margin:0 4px 8px">${T('Pasa lo que ves (y el video en el mismo minuto) entre el teléfono y tu PC por el WiFi de casa. En la PC: Configuración › Continuar en el otro dispositivo › Mostrar código.', 'Pass what you are watching (and the video at the same minute) between the phone and your PC over your home WiFi. On the PC: Settings › Continue on the other device › Show code.')}</p><div class="aj-tarjeta">
    ${SW('continuarDispositivo', '🔄 ' + T('Continuar en el otro dispositivo', 'Continue on the other device'), T('Botones 💻 «Seguir en la PC» y 📲 «Traer de la PC» en el panel de JARVIS', 'Buttons 💻 “Continue on PC” and 📲 “Get from PC” in the JARVIS panel'))}
    <div class="aj-fila col"><span>${T('Emparejar con la PC', 'Pair with the PC')}<small id="aj-cont-estado">${cfg.continuarToken ? '💻 ' + T('Emparejado con', 'Paired with') + ' ' + esc(cfg.continuarPC) : T('Sin emparejar', 'Not paired')}</small></span>
      <input type="text" id="aj-cont-pc" placeholder="192.168.1.20:8766" value="${esc(cfg.continuarPC || '')}" inputmode="url" /><input type="text" id="aj-cont-cod" placeholder="${T('Código de 6 números', '6-digit code')}" inputmode="numeric" maxlength="6" />
      <div class="fila-botones"><button class="sec" id="aj-cont-emparejar">${T('Emparejar', 'Pair')}</button><button class="sec" id="aj-cont-olvidar">${T('Olvidar PC', 'Forget PC')}</button></div></div>
  </div></div>
  <div class="aj-sec" id="aj-ia"><h3>🧠 ${T('Cerebro de JARVIS', 'JARVIS brain')}</h3><p class="tenue" style="margin:0 4px 8px">${T('Las llaves se guardan cifradas por Android (Keystore) y nunca se vuelven a mostrar.', 'Keys are encrypted by Android (Keystore) and never shown again.')}</p><div class="aj-tarjeta">
    ${LLAVE('gemini', 'Gemini (Google)', T('Gratis · ve fotos y entiende la voz', 'Free · sees images and understands speech'), 'https://aistudio.google.com/apikey')}
    ${LLAVE('claude', 'Claude (Anthropic)', T('De pago · muy bueno pensando', 'Paid · great at reasoning'), 'https://console.anthropic.com/settings/keys')}
    ${LLAVE('openai', 'OpenAI (ChatGPT)', T('De pago · voz natural', 'Paid · natural voice'), 'https://platform.openai.com/api-keys')}
    <div class="aj-fila"><span>${T('Usar primero', 'Use first')}</span><select data-sel="primera"><option value="gemini">Gemini</option><option value="claude">Claude</option><option value="openai">OpenAI</option></select></div>
    ${SW('vozRespuestas', T('Contestar en voz alta', 'Answer out loud'), T('JARVIS dice lo que escribe', 'JARVIS speaks his replies'))}
    <div class="aj-fila"><span>${T('Voz de JARVIS', 'JARVIS voice')}</span><select data-sel="vozMotor"><option value="sistema">${T('La del teléfono (gratis)', 'Phone voice (free)')}</option><option value="openai">OpenAI</option><option value="gemini">Gemini</option></select></div>
    ${SW('memoriaJarvis', T('Memoria de JARVIS', 'JARVIS memory'), T('Recuerda lo que le cuentas («recuerda que…»)', 'Remembers what you tell him (“remember that…”)'))}
    <div id="aj-mem"></div>
    <div class="aj-fila col"><span>${T('Qwen de tu PC (cerebro local)', 'Qwen on your PC (local brain)')}<small>${T('Si Gemini se agota, contesta el Qwen de tu PC por WiFi. Pon la dirección de tu PC, p. ej. http://192.168.1.20:8080 (llama-server con --host 0.0.0.0).', 'If Gemini runs out, your PC\'s Qwen answers over WiFi. Enter your PC address, e.g. http://192.168.1.20:8080 (llama-server with --host 0.0.0.0).')}</small></span>
      <input type="url" id="aj-qwen" placeholder="http://192.168.1.20:8080" value="${esc(cfg.qwenPC || '')}" /><div class="fila-botones"><label class="sw"><input type="checkbox" data-cfg="localActivo" ${cfg.localActivo ? 'checked' : ''} /><i></i></label><button class="sec" id="aj-qwen-probar">${T('Probar', 'Test')}</button></div></div>
  </div></div>
  <div class="aj-sec" id="aj-seg"><h3>🛡 ${T('Seguridad y privacidad', 'Security & privacy')}</h3><div class="aj-tarjeta">
    ${SW('escaner', T('Escáner de amenazas', 'Threat scanner'), T('Escudo en la barra y aviso rojo si una página parece estafa', 'Shield in the bar and a red alert if a page looks like a scam'))}
    ${SW('guardarHistorial', T('Guardar historial', 'Save history'), '')}
    <div class="aj-fila"><span>${T('Borrar cookies y datos de sitios', 'Clear cookies and site data')}<small>${T('Tendrás que volver a entrar a tus cuentas', "You'll have to sign in again")}</small></span><button class="sec" id="aj-borrar">${T('Borrar', 'Clear')}</button></div>
  </div><p class="tenue" style="margin:8px 4px">${T('El bloqueador de anuncios y rastreadores está siempre activo. Las pestañas privadas no guardan historial ni caché.', 'The ad and tracker blocker is always on. Private tabs keep no history or cache.')}</p></div>
  <div class="aj-sec" id="aj-tel"><h3>📱 Telegram</h3><div class="aj-tarjeta">
    ${LLAVE('telegram', T('Bot de Telegram', 'Telegram bot'), T('El mismo bot de la PC (@BotFather → token). Después escríbele cualquier cosa al bot y pulsa Conectar.', 'Same bot as on the PC (@BotFather → token). Then message the bot and press Connect.'), 'https://t.me/BotFather')}
    <div class="aj-fila"><span>${T('Chat', 'Chat')}<small id="aj-tg-chat">${cfg.telegramChat ? '✓ ' + esc(cfg.telegramChat.nombre || cfg.telegramChat.id) : T('Sin conectar', 'Not connected')}</small></span><button class="sec" id="aj-tg-conectar">${T('Conectar', 'Connect')}</button></div>
  </div></div>
  <div class="aj-sec" id="aj-vig"><h3>🔔 ${T('Vigilante', 'Watcher')}</h3><div class="aj-tarjeta">${SW('vigilar', T('Revisar mis vigilancias', 'Check my watched pages'), T('Cada hora, mientras la app está abierta', 'Every hour while the app is open'))}<div id="aj-vig-lista"></div></div></div>
  <div class="aj-sec" id="aj-respaldo"><h3>💾 ${T('Respaldo de ajustes', 'Settings backup')}</h3><p class="tenue" style="margin:0 4px 8px">${T('Guarda tus llaves, ajustes, favoritos, memoria y vigilancias en un archivo cifrado con una clave que tú eliges. Si cambias de teléfono o reinstalas, lo restauras con un toque. Sin la clave nadie puede abrirlo, y si la olvidas tampoco se puede recuperar.', 'Saves your keys, settings, bookmarks, memory and watched pages in a file encrypted with a password you choose. If you change phones or reinstall, restore it with one tap. Without the password nobody can open it, and if you forget it, it cannot be recovered.')}</p><div class="aj-tarjeta">
    <div class="aj-fila col"><span>${T('Clave del respaldo', 'Backup password')}<small>${T('Mínimo 6 letras o números. Apúntala en un lugar seguro.', 'At least 6 characters. Write it down somewhere safe.')}</small></span>
      <input type="password" id="aj-resp-clave" placeholder="${T('Clave del respaldo', 'Backup password')}" autocomplete="new-password" />
      <div class="fila-botones"><button class="pri" id="aj-resp-crear">${T('Crear respaldo', 'Create backup')}</button><button class="sec" id="aj-resp-abrir">${T('Restaurar respaldo', 'Restore backup')}</button></div><small class="estado" id="aj-resp-estado"></small></div>
  </div></div>
  <div class="aj-sec"><h3>ℹ ${T('Acerca de', 'About')}</h3><div class="aj-tarjeta"><div class="aj-fila"><span>JARVIS Browser · Android<small id="aj-ver"></small></span></div></div></div>`;
  abrirCapa('ajustes', false);
  s.querySelectorAll('[data-sel]').forEach((x) => { const k = x.dataset.sel; x.value = k === 'primera' ? cfg.ordenIA[0] : cfg[k] || ''; });
  if (sec && $('aj-' + sec)) setTimeout(() => $('aj-' + sec).scrollIntoView(), 60);
  pintarLlaves(); pintarMemoriaAj(); pintarVigAj(); H('version').then((v) => { $('aj-ver').textContent = 'v' + v; });
}
window.ajustesAtras = () => false;
$('ajustes').addEventListener('change', (ev) => {
  const t = ev.target;
  if (t.dataset.cfg) { guardarCfg({ [t.dataset.cfg]: t.checked }); if (t.dataset.cfg === 'localActivo') revisarLlaves(); toast(T('Guardado', 'Saved')); }
  if (t.dataset.sel) {
    const k = t.dataset.sel;
    if (k === 'primera') guardarCfg({ ordenIA: [t.value, ...['gemini', 'claude', 'openai'].filter((x) => x !== t.value)] });
    else guardarCfg({ [k]: t.value });
    if (k === 'idioma') { toast(T('Idioma cambiado: se aplica al volver a abrir', 'Language changed: applies on restart')); setTimeout(() => location.reload(), 900); }
    else toast(T('Guardado', 'Saved'));
  }
  if (t.id === 'aj-qwen') { guardarCfg({ qwenPC: t.value.trim() }); revisarLlaves(); }
});
$('ajustes').addEventListener('click', async (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  if (b.id === 'aj-x') return cerrarCapa('ajustes');
  if (b.dataset.tema) { guardarCfg({ tema: b.dataset.tema }); ponerTema(b.dataset.tema); document.querySelectorAll('#aj-temas button').forEach((x) => x.classList.toggle('activo', x === b)); return; }
  if (b.dataset.enlace) { H('nueva', { url: b.dataset.enlace }); cerrarCapa('ajustes'); return; }
  if (b.dataset.guardar) { const p = b.dataset.guardar; const v = $('in-' + p).value.trim(); if (v.length < 12) return toast(T('Esa llave parece incompleta', 'That key looks incomplete')); await H('llave', { nombre: p, valor: v }); $('in-' + p).value = ''; await revisarLlaves(); pintarLlaves(); toast(T('Llave guardada y cifrada', 'Key saved and encrypted')); if (p !== 'telegram') probar(p); return; }
  if (b.dataset.quitar) { await H('llave', { nombre: b.dataset.quitar, valor: '' }); await revisarLlaves(); pintarLlaves(); return toast(T('Llave quitada', 'Key removed')); }
  if (b.dataset.probar) return probar(b.dataset.probar);
  if (b.dataset.olvidar) { olvidarMemoria(b.dataset.olvidar); return pintarMemoriaAj(); }
  if (b.dataset.vigquitar) { vigilancias = vigilancias.filter((v) => v.id !== b.dataset.vigquitar); Datos.guardar('vigilancias', vigilancias); return pintarVigAj(); }
  if (b.id === 'aj-pred') return H('predeterminado');
  if (b.id === 'aj-borrar') { await H('borrar-datos', { cookies: true, cache: true }); return toast(T('Datos borrados', 'Data cleared')); }
  if (b.id === 'aj-qwen-probar') { guardarCfg({ qwenPC: $('aj-qwen').value.trim(), localActivo: true }); await revisarLlaves(); const v = await Cerebro.localVivo(4000); return toast(v ? '🧠 ' + T('Qwen de tu PC responde ✓', 'Your PC Qwen answers ✓') : T('No llego a tu PC. ¿Mismo WiFi y llama-server con --host 0.0.0.0?', "Can't reach your PC. Same WiFi and llama-server with --host 0.0.0.0?"), 4500); }
  if (b.id === 'aj-tg-conectar') return conectarTelegram();
  if (b.id === 'aj-resp-crear' || b.id === 'aj-resp-abrir') return respaldo(b.id === 'aj-resp-crear');
});
// 💾 respaldo: la parte nativa cifra (PBKDF2 + AES-GCM) y Android pregunta dónde guardarlo / cuál abrir
async function respaldo(crear) {
  const inp = $('aj-resp-clave'), est = $('aj-resp-estado'), clave = inp.value;
  if (clave.length < 6) { est.className = 'estado no'; est.textContent = T('La clave necesita al menos 6 letras o números', 'The password needs at least 6 characters'); return; }
  est.className = 'estado'; est.textContent = crear ? T('Elige dónde guardarlo (Descargas, Drive…)', 'Choose where to save it (Downloads, Drive…)') : T('Elige el archivo .jarvis', 'Pick the .jarvis file');
  const r = (await H(crear ? 'respaldo-crear' : 'respaldo-restaurar', { clave })) || { ok: false, error: 'archivo' };
  if (r.ok) inp.value = '';
  const errores = { cancelado: T('Cancelado', 'Cancelled'), clave: T('Clave incorrecta', 'Wrong password'), archivo: T('Ese archivo no es un respaldo de JARVIS (o está dañado)', "That file isn't a JARVIS backup (or it's damaged)"), escribir: T('No se pudo guardar ahí. Prueba otra carpeta.', "Couldn't save there. Try another folder."), corta: T('La clave necesita al menos 6 letras o números', 'The password needs at least 6 characters'), 'sin-selector': T('Este teléfono no dejó elegir el archivo', "This phone didn't allow picking a file") };
  est.className = 'estado ' + (r.ok ? 'si' : 'no');
  if (!r.ok) { est.textContent = errores[r.error] || errores.archivo; return; }
  if (crear) { est.textContent = '✓ ' + T(`Respaldo creado (${r.llaves} llaves, ${r.archivos} archivos). Guárdalo junto a tu clave.`, `Backup created (${r.llaves} keys, ${r.archivos} files). Keep it with your password.`); return toast(T('Respaldo creado', 'Backup created')); }
  est.textContent = '✓ ' + T(`Restaurado (${r.llaves} llaves, ${r.archivos} archivos). Recargando…`, `Restored (${r.llaves} keys, ${r.archivos} files). Reloading…`);
  toast(T('Respaldo restaurado', 'Backup restored')); setTimeout(() => location.reload(), 1500);
}
async function pintarLlaves() {
  const ll = (await H('llaves')) || {};
  for (const p of ['gemini', 'claude', 'openai', 'telegram']) { const e = $('ll-' + p); if (!e) continue; const x = ll[p]; e.textContent = x && x.puesta ? `✓ ${T('Llave puesta', 'Key set')} (…${x.final})` : T('Sin llave', 'No key'); e.className = 'estado ' + (x && x.puesta ? 'si' : 'no'); }
}
async function probar(p) {
  const e = $('ll-' + p); if (e) e.textContent = T('Probando…', 'Testing…');
  try { const r = await Cerebro.pensar({ sistema: 'Reply with one short friendly sentence.', historia: [{ rol: 'user', texto: `Say hello in ${Cerebro.idiomaDe(IDIOMA)}.` }], max: 200 }, [p]); if (e) { e.textContent = `${T('Funciona', 'Works')}: «${r.texto}»`; e.className = 'estado si'; } }
  catch (x) { if (e) { e.textContent = errorIA(x); e.className = 'estado no'; } }
}
function pintarMemoriaAj() {
  const c = $('aj-mem'); if (!c) return;
  c.innerHTML = memoria.slice().reverse().map((m) => `<div class="mem"><span>${esc(m.texto)}</span><button class="sec" data-olvidar="${esc(m.id)}">${T('Olvidar', 'Forget')}</button></div>`).join('');
}
function pintarVigAj() {
  const c = $('aj-vig-lista'); if (!c) return;
  c.innerHTML = vigilancias.map((v) => `<div class="mem"><span>${v.tipo === 'precio' ? '🔔' : '👀'} ${esc(v.titulo || v.url)}${v.precio ? ` · ${esc(v.moneda)}${v.precio}` : ''}</span><button class="sec" data-vigquitar="${v.id}">✕</button></div>`).join('') || `<div class="mem tenue">${T('Ninguna todavía. Abre una página y pulsa «Vigilar precio» en el panel.', 'None yet. Open a page and tap “Watch price” in the panel.')}</div>`;
}
async function conectarTelegram() {
  try {
    const r = await Nativo.fetch('https://api.telegram.org/bot{{LLAVE:telegram}}/getUpdates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"timeout":0}' });
    const j = await r.json(); if (!j || !j.ok) return toast(T('Telegram no aceptó la llave del bot.', "Telegram didn't accept the bot key."), 4000);
    const m = [...(j.result || [])].reverse().map((u) => u.message).find((x) => x && x.chat && x.chat.type === 'private');
    if (!m) return toast(T('Escríbele cualquier cosa a tu bot en Telegram y vuelve a pulsar Conectar.', 'Send any message to your bot in Telegram, then press Connect again.'), 5000);
    guardarCfg({ telegramChat: { id: m.chat.id, nombre: m.chat.first_name || m.chat.username || '' } }); $('aj-tg-chat').textContent = '✓ ' + (m.chat.first_name || m.chat.id);
    toast('📱 ' + T('Telegram conectado', 'Telegram connected'));
  } catch { toast(T('No pude hablar con Telegram.', "Couldn't reach Telegram.")); }
}
