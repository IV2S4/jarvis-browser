'use strict';
// ⌨ Terminal de comandos (Ctrl+K) [04-nov] — sacada de main.js al ordenar el código.
// Recibe del navegador (main.js) las funciones que usa y, para lo que cambia (configuración, pestañas…), funciones que lo devuelven.
const net = require('net');
const dnsP = require('dns').promises;
const proteccion = require('./proteccion');
const escaner = require('./escaner');

module.exports = function crearTerminal(ctx) {
  const { aUrl, nueva, navegar, actual, wc, activarPestana, cerrarPestana, reabrirPestana, urlDe, abrirPanel, aviso, avisarEstado, memoriaMB, cambioGaming,
    configurarLocal, arrancarQwen, apagarQwen, estadoLocal, centroMando, dividir, videoFlotante, clipThat, traducirPagina, enviarTelefono, abrirConfig,
    tr, enIngles, INICIO, revisadas } = ctx;
  const AYUDA = [
    ['open <site>', 'abre en una pestaña nueva (youtube, cnn.com…)'], ['go <site>', 'abre aquí mismo'], ['search <text>', 'busca en internet'],
    ['tabs', 'lista las pestañas'], ['tab <n>', 'cambia a la pestaña n'], ['close [n]', 'cierra la pestaña'], ['reopen', 'reabre la última pestaña cerrada (Ctrl+Mayús+T)'], ['new · private', 'pestaña nueva o privada'],
    ['back · forward · reload', 'navegar'], ['scan', 'escanea la página actual'], ['map', 'mapa de conexiones'], ['trace <site>', 'IP, país y tiempo de respuesta de un servidor'],
    ['sys', 'CPU, RAM, GPU e internet'], ['gaming [on|off]', 'modo gaming'], ['local [on|off|start|stop]', 'cerebro local Qwen'], ['hud [on|off]', 'centro de mando'],
    ['downloads', 'últimas descargas revisadas'], ['split · pip · clip', 'pantalla dividida, video flotante, guardar jugada'], ['translate [lang]', 'traduce la página'],
    ['summarize', 'resume la página'], ['phone', 'manda la página a tu teléfono'], ['history <text>', 'busca en tu historial'], ['settings', 'abre la configuración'],
    ['ask <question>', 'pregúntale a JARVIS (o escribe la pregunta tal cual)'], ['clear · exit', 'limpiar · cerrar'],
  ];
  const COMANDOS = ['help', 'open', 'go', 'search', 'tabs', 'tab', 'close', 'reopen', 'new', 'private', 'back', 'forward', 'reload', 'scan', 'map', 'trace', 'sys', 'gaming', 'local', 'hud',
    'downloads', 'split', 'pip', 'clip', 'translate', 'summarize', 'phone', 'history', 'settings', 'ask', 'clear', 'exit'];
  const ALIAS = { ayuda: 'help', abre: 'open', abrir: 'open', ir: 'go', busca: 'search', buscar: 'search', pestanas: 'tabs', pestañas: 'tabs', pestana: 'tab', pestaña: 'tab', cierra: 'close', cerrar: 'close', reabre: 'reopen', reabrir: 'reopen',
    nueva: 'new', privada: 'private', atras: 'back', atrás: 'back', adelante: 'forward', recarga: 'reload', escanea: 'scan', mapa: 'map', rastrea: 'trace', ping: 'trace', whois: 'trace', sistema: 'sys',
    descargas: 'downloads', dividir: 'split', traduce: 'translate', resume: 'summarize', telefono: 'phone', teléfono: 'phone', historial: 'history', ajustes: 'settings', config: 'settings',
    pregunta: 'ask', limpiar: 'clear', salir: 'exit', mando: 'hud', quit: 'exit', '?': 'help' };
  const L = (t, c = '') => ({ t: String(t), c });
  const TT = (es, en) => (enIngles() ? en : es);   // c: '' | 'ok' | 'mal' | 'aviso' | 'tenue' | 'titulo'
  const onOff = (a, actual) => (/^(on|si|sí|1|encender|enciende)$/i.test(a) ? true : /^(off|no|0|apagar|apaga)$/i.test(a) ? false : !actual);
  function guardarCfg(c) { Object.assign(ctx.cfg(), c); proteccion.guardarConfig(ctx.cfg()); avisarEstado(); }

  async function trace(destino) {
    let host = String(destino || '').trim();
    if (!host) { try { host = new URL(urlDe(actual())).hostname; } catch { return [L(TT('Uso: trace <sitio>', 'Usage: trace <site>'), 'aviso')]; } }
    try { host = new URL(/^\w+:\/\//.test(host) ? host : 'https://' + host).hostname; } catch { /* */ }
    const out = [L(`TRACE ${host}`, 'titulo')];
    let ip = '';
    try { ip = (await dnsP.lookup(host, { family: 4 })).address; out.push(L(`  IP ........ ${ip}`)); } catch { return [...out, L(TT('  No resuelve: el sitio no existe o no hay internet.', '  Does not resolve: the site does not exist or there is no internet.'), 'mal')]; }
    const ms = await new Promise((ok) => { const t0 = Date.now(); const s = net.connect({ host: ip, port: 443, timeout: 4000 }, () => { ok(Date.now() - t0); s.destroy(); }); s.on('error', () => ok(-1)); s.on('timeout', () => { ok(-1); s.destroy(); }); });
    out.push(L(`  PING ...... ${ms >= 0 ? ms + ' ms' : TT('sin respuesta', 'no response')}`, ms >= 0 ? (ms < 80 ? 'ok' : 'aviso') : 'mal'));
    const g = await escaner.ubicar([host]).catch(() => null); const s = g && g.servidores[0];
    if (s) { out.push(L(`  ${TT('LUGAR .....', 'LOCATION ..')} [${s.cc}] ${s.ciudad || ''}, ${s.pais}`)); if (s.org) out.push(L(`  ${TT('RED .......', 'NETWORK ...')} ${s.org}`)); }
    const r = escaner.riesgo('https://' + host, null);
    out.push(L(`  ${TT('RIESGO ....', 'RISK ......')} ${TT(r.nivel.toUpperCase(), { bajo: 'LOW', medio: 'MEDIUM', alto: 'HIGH' }[r.nivel])}${r.pistas.length ? ' · ' + r.pistas.join(', ') : ''}`, r.nivel === 'bajo' ? 'ok' : r.nivel === 'medio' ? 'aviso' : 'mal'));
    return out;
  }

  async function terminal(linea) {
    const texto = String(linea || '').trim();
    if (!texto) return { lineas: [] };
    const [c0, ...resto] = texto.split(/\s+/); const arg = resto.join(' ');
    const cmd = ALIAS[c0.toLowerCase()] || c0.toLowerCase();
    const p = actual();
    switch (cmd) {
      case 'help': return { lineas: [L(TT('COMANDOS', 'COMMANDS'), 'titulo'), ...AYUDA.map(([a, b]) => L(`  ${a.padEnd(26)} ${tr(b)}`)), L(TT('  Tab completa · ↑↓ historial · Esc cierra', '  Tab completes · ↑↓ history · Esc closes'), 'tenue')] };
      case 'open': if (!arg) return { lineas: [L(TT('Uso: open <sitio>', 'Usage: open <site>'), 'aviso')] }; nueva(aUrl(/^[\w-]+$/.test(arg) && !arg.includes('.') ? arg + '.com' : arg)); return { lineas: [L(`→ ${arg}`, 'ok')], cerrar: true };
      case 'go': if (!arg) return { lineas: [L(TT('Uso: go <sitio>', 'Usage: go <site>'), 'aviso')] }; navegar(arg); return { lineas: [L(`→ ${arg}`, 'ok')], cerrar: true };
      case 'search': if (!arg) return { lineas: [L(TT('Uso: search <texto>', 'Usage: search <text>'), 'aviso')] }; nueva(proteccion.buscar(ctx.cfg(), arg)); return { lineas: [L(`🔎 ${arg}`, 'ok')], cerrar: true };
      case 'tabs': return { lineas: [L(`${ctx.pestanas().length} ${TT('PESTAÑAS', 'TABS')}`, 'titulo'), ...ctx.pestanas().map((x, i) => L(`  ${String(i + 1).padStart(2)} ${x.id === ctx.activa() ? '▶' : ' '} ${(x.dormida ? '💤 ' : '') + (x.dormida ? x.dormida.titulo : x.vista.webContents.getTitle() || urlDe(x)).slice(0, 70)}`, x.id === ctx.activa() ? 'ok' : ''))] };
      case 'tab': { const n = Number(arg) - 1; if (!ctx.pestanas()[n]) return { lineas: [L(TT('No existe esa pestaña. Escribe «tabs».', 'No such tab. Type “tabs”.'), 'mal')] }; activarPestana(ctx.pestanas()[n].id); return { lineas: [L(`→ #${n + 1}`, 'ok')], cerrar: true }; }
      case 'close': { const x = arg ? ctx.pestanas()[Number(arg) - 1] : p; if (!x) return { lineas: [L(TT('No existe esa pestaña.', 'No such tab.'), 'mal')] }; cerrarPestana(x.id); return { lineas: [L(TT('✕ cerrada', '✕ closed'), 'ok')] }; }
      case 'reopen': { const x = reabrirPestana(); return { lineas: [L(x ? `↺ ${x.titulo || x.url}` : TT('No hay pestañas cerradas.', 'No closed tabs.'), x ? 'ok' : 'aviso')], cerrar: Boolean(x) }; }
      case 'new': nueva(INICIO); return { lineas: [L(TT('+ pestaña nueva', '+ new tab'), 'ok')], cerrar: true };
      case 'private': nueva(INICIO, true, true); return { lineas: [L(TT('🕶 pestaña privada', '🕶 private tab'), 'ok')], cerrar: true };
      case 'back': wc()?.navigationHistory.goBack(); return { lineas: [L('←', 'ok')] };
      case 'forward': wc()?.navigationHistory.goForward(); return { lineas: [L('→', 'ok')] };
      case 'reload': wc()?.reload(); return { lineas: [L('⟳', 'ok')] };
      case 'scan': {
        if (!p || !/^https?:/.test(urlDe(p))) return { lineas: [L(TT('Abre una página web primero.', 'Open a web page first.'), 'aviso')] };
        const r = escaner.resumen(p.vista.webContents.id, urlDe(p));
        const niv = TT(r.nivel.toUpperCase(), { bajo: 'LOW', medio: 'MEDIUM', alto: 'HIGH' }[r.nivel]);
        return { lineas: [L(`SCAN ${proteccion.host(urlDe(p))}`, 'titulo'), L(`  ${TT('RIESGO ........', 'RISK ..........')} ${niv}`, r.nivel === 'bajo' ? 'ok' : r.nivel === 'medio' ? 'aviso' : 'mal'),
          L(`  ${TT('CONEXIÓN ......', 'CONNECTION ....')} ${r.https ? TT('HTTPS (cifrada)', 'HTTPS (encrypted)') : TT('HTTP (sin cifrar)', 'HTTP (unencrypted)')}`, r.https ? 'ok' : 'mal'),
          L(`  ${TT('RASTREADORES ..', 'TRACKERS ......')} ${r.rastreadores} ${TT('bloqueados', 'blocked')}`), L(`  ${TT('ANUNCIOS ......', 'ADS ...........')} ${r.anuncios} ${TT('bloqueados', 'blocked')}`),
          L(`  ${TT('TERCEROS ......', 'THIRD PARTY ...')} ${r.terceros} ${TT('servidores', 'servers')}`), ...(r.pistas.length ? [L(`  ${TT('PISTAS ........', 'FLAGS .........')} ${r.pistas.join(', ')}`, 'aviso')] : []),
          ...r.hosts.slice(0, 8).map((h) => L(`    ${h.bloqueado ? '✕' : h.propio ? '●' : '○'} ${h.host}`, h.bloqueado ? 'mal' : 'tenue'))] };
      }
      case 'map': abrirPanel(true); aviso('panel-pestana', 'escaner'); return { lineas: [L(TT('🗺 mapa abierto en el panel', '🗺 map opened in the panel'), 'ok')], cerrar: true };
      case 'trace': return { lineas: await trace(arg) };
      case 'sys': {
        const m = ctx.ultimoMonitor(); if (!m) return { lineas: [L(TT('Midiendo… vuelve a escribir «sys» en 2 segundos.', 'Measuring… type “sys” again in 2 seconds.'), 'aviso')] };
        const barra = (v) => '█'.repeat(Math.round(v / 10)) + '░'.repeat(10 - Math.round(v / 10));
        return { lineas: [L(TT('SISTEMA', 'SYSTEM'), 'titulo'), L(`  CPU  ${barra(m.cpu)} ${m.cpu}%`, m.cpu > 85 ? 'mal' : ''), L(`  RAM  ${barra(m.ram)} ${m.ram}%`, m.ram > 85 ? 'mal' : ''),
          ...(m.gpu ? [L(`  GPU  ${barra(m.gpu.uso)} ${m.gpu.uso}% · ${m.gpu.temp}°C · VRAM ${m.gpu.vram}%`, m.gpu.temp > 80 ? 'mal' : '')] : []),
          ...(m.red ? [L(`  NET  ↓ ${(m.red.bajada / 1048576).toFixed(2)} MB/s  ↑ ${(m.red.subida / 1048576).toFixed(2)} MB/s`)] : []),
          L(TT(`  JARVIS usa ${memoriaMB()} MB de RAM`, `  JARVIS is using ${memoriaMB()} MB of RAM`), 'tenue')] };
      }
      case 'gaming': { const on = onOff(arg, Boolean(ctx.gaming())); cambioGaming(on ? { titulo: 'Manual' } : null); return { lineas: [L(on ? TT('🎮 MODO GAMING ACTIVADO', '🎮 GAMING MODE ON') : TT('Modo ctx.gaming() apagado', 'Gaming mode off'), on ? 'ok' : '')] }; }
      case 'local': {
        const a = arg.toLowerCase();
        if (a === 'start') { if (!ctx.cfg().cerebroLocal) guardarCfg({ cerebroLocal: true }); configurarLocal(); arrancarQwen(); return { lineas: [L(TT('🧠 Encendiendo Qwen… (unos 20-60 s)', '🧠 Starting Qwen… (about 20-60 s)'), 'ok')] }; }
        if (a === 'stop') { const habia = Boolean(ctx.qwenProc()); apagarQwen(); return { lineas: [L(habia ? TT('Apagando…', 'Shutting down…') : TT('Qwen apagado (si lo abriste tú con su acceso directo, ciérralo desde su ventana).', 'Qwen stopped (if you opened it with its shortcut, close it from its window).'), 'ok')] }; }
        if (a) { guardarCfg({ cerebroLocal: onOff(a, ctx.cfg().cerebroLocal) }); configurarLocal(); }
        const e = await estadoLocal();
        return { lineas: [L(TT('CEREBRO LOCAL', 'LOCAL BRAIN'), 'titulo'), L(`  ${e.activo ? TT('ACTIVADO', 'ENABLED') : TT('DESACTIVADO', 'DISABLED')}`, e.activo ? 'ok' : 'tenue'), L(`  Qwen ${e.vivo ? 'ONLINE' : e.arrancando ? TT('ARRANCANDO…', 'STARTING…') : 'OFFLINE'} · ${e.url}`, e.vivo ? 'ok' : 'aviso'),
          L(`  ${e.encontrado ? '✓' : '✕'} ${e.bat}`, e.encontrado ? 'tenue' : 'mal')] };
      }
      case 'hud': { const on = onOff(arg, Boolean(ctx.cfg().centroMando)); guardarCfg({ centroMando: on }); centroMando(on); return { lineas: [L(on ? TT('🖥 Centro de mando encendido', '🖥 Command center on') : TT('Centro de mando apagado', 'Command center off'), on ? 'ok' : '')] }; }
      case 'downloads': {
        if (!revisadas.length) return { lineas: [L(TT('Todavía no hay descargas revisadas en esta sesión.', 'No scanned downloads yet this session.'), 'tenue')] };
        const ico = { limpio: [TT('✓ LIMPIO', '✓ CLEAN'), 'ok'], peligroso: [TT('✕ PELIGROSO', '✕ DANGEROUS'), 'mal'], sospechoso: [TT('! SOSPECHOSO', '! SUSPICIOUS'), 'aviso'], quitado: [TT('✕ QUITADO POR WINDOWS', '✕ REMOVED BY WINDOWS'), 'mal'], 'sin-revisar': [TT('? SIN REVISAR', '? NOT SCANNED'), 'tenue'] };
        return { lineas: [L(TT('DESCARGAS', 'DOWNLOADS'), 'titulo'), ...revisadas.slice(0, 12).map((d) => { const [t, c] = ico[d.veredicto] || ['?', 'tenue']; return L(`  ${t.padEnd(24)} ${d.nombre}`, c); })] };
      }
      case 'split': dividir(); return { lineas: [L(TT('◧ pantalla dividida', '◧ split screen'), 'ok')], cerrar: true };
      case 'pip': videoFlotante(); return { lineas: [L(TT('▣ video flotante', '▣ floating video'), 'ok')], cerrar: true };
      case 'clip': clipThat(); return { lineas: [L(TT('🎬 guardando la jugada…', '🎬 saving the clip…'), 'ok')] };
      case 'translate': traducirPagina(arg ? arg.slice(0, 2).toLowerCase() : undefined); return { lineas: [L(TT('🌐 traduciendo la página…', '🌐 translating the page…'), 'ok')], cerrar: true };
      case 'summarize': abrirPanel(true); aviso('preguntar', 'Resume esta página en pocas frases.'); return { lineas: [L(TT('📝 resumiendo en el panel…', '📝 summarizing in the panel…'), 'ok')], cerrar: true };
      case 'phone': { const r = await enviarTelefono({}); return { lineas: [L(r && r.ok ? TT('📱 enviado a tu teléfono', '📱 sent to your phone') : `✕ ${tr((r && r.error) || 'no se pudo')}`, r && r.ok ? 'ok' : 'mal')] }; }
      case 'history': {
        const h = proteccion.historial.buscar(arg || '', 10);
        return { lineas: [L(TT('HISTORIAL', 'HISTORY'), 'titulo'), ...(h.length ? h.map((x) => L(`  ${new Date(x.t).toLocaleDateString()}  ${(x.titulo || x.url).slice(0, 60)}`)) : [L(TT('  nada', '  nothing'), 'tenue')])] };
      }
      case 'settings': abrirConfig(arg || ''); return { lineas: [L(TT('⚙ configuración abierta', '⚙ settings opened'), 'ok')], cerrar: true };
      case 'clear': return { limpiar: true, lineas: [] };
      case 'exit': return { cerrar: true, lineas: [] };
      case 'ask': default: {
        const q = cmd === 'ask' ? arg : texto;
        if (!q) return { lineas: [L(TT('Uso: ask <pregunta>', 'Usage: ask <question>'), 'aviso')] };
        abrirPanel(true); aviso('chat-externo', q);
        return { lineas: [L(`→ JARVIS: ${q}`, 'ok'), L(TT('  la respuesta sale en el panel', '  the answer appears in the panel'), 'tenue')] };
      }
    }
  }

  return { terminal, COMANDOS };
};
