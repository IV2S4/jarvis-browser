'use strict';
// 🕵 Investigador en segundo plano [09-nov]: «Jarvis, investiga las mejores laptops gaming de menos de $1,500».
// JARVIS divide el tema en preguntas, busca cada una en internet (Gemini con búsqueda de Google), y escribe un informe
// con tabla comparativa y fuentes. Mientras, tú sigues navegando; al terminar se abre el informe y te avisa.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// llamada a Gemini con búsqueda de Google; devuelve { texto, fuentes:[{titulo,url}] }
async function buscar(llave, texto, max = 2500, intento = 0) {
  let ultimo = null; let cuota = false;
  for (const modelo of ['gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-flash-latest']) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, { method: 'POST', signal: AbortSignal.timeout(90000),
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': llave },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: texto }] }], tools: [{ google_search: {} }], generationConfig: { maxOutputTokens: max, temperature: 0.3 } }) });
      const j = await r.json().catch(() => null);
      if (!r.ok) { ultimo = new Error((j && j.error && j.error.message) || `HTTP ${r.status}`); if (r.status === 429) cuota = true; continue; }
      const c = j?.candidates?.[0];
      const t = (c?.content?.parts || []).map((p) => p.text || '').join('');
      const fuentes = (c?.groundingMetadata?.groundingChunks || []).map((g) => g.web).filter((w) => w && w.uri).map((w) => ({ titulo: w.title || w.uri, url: w.uri }));
      // si Gemini no manda las fuentes aparte, se sacan de los enlaces que puso en el texto
      if (!fuentes.length) for (const m of t.matchAll(/https?:\/\/[^\s)\]>"']+/g)) { const u = m[0].replace(/[.,;]+$/, ''); if (!fuentes.some((f) => f.url === u)) fuentes.push({ titulo: u.replace(/^https?:\/\/(www\.)?/, '').slice(0, 80), url: u }); }
      if (t) return { texto: t, fuentes };
    } catch (e) { ultimo = e; }
  }
  if (cuota && intento < 2) { await new Promise((ok) => setTimeout(ok, 25000)); return buscar(llave, texto, max, intento + 1); }   // límite por minuto: espera y otra vez
  throw ultimo || new Error('sin respuesta');
}

// 🌐 plan B sin la búsqueda de Gemini (cuando se acaba su cuota) [09-nov]: busca en DuckDuckGo y lee las 3 primeras páginas
const UA_WEB = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';
const sinHtml = (h) => String(h || '').replace(/<(script|style|noscript|svg|nav|footer|header)\b[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&#?[a-z0-9]+;/gi, ' ').replace(/\s+/g, ' ').trim();
async function traerWeb(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA_WEB, 'Accept-Language': 'en-US,en;q=0.9' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.text()).slice(0, 800000);
}
// leer(url) → texto de la página; en la PC lo da una ventana escondida de Chromium (muchas webs bloquean a fetch)
async function buscarEnWeb(q, leer = async (u) => sinHtml(await traerWeb(u))) {
  const html = await traerWeb('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q));
  const res = [];
  for (const m of html.matchAll(/class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)) {
    let u = m[1].replace(/&amp;/g, '&'); const g = /[?&]uddg=([^&]+)/.exec(u); if (g) u = decodeURIComponent(g[1]); if (u.startsWith('//')) u = 'https:' + u;
    if (!/^https?:/.test(u) || /duckduckgo\.com\/y\.js|bing\.com\/aclick/.test(u) || res.some((x) => x.url === u)) continue;   // sin anuncios ni repetidos
    res.push({ titulo: sinHtml(m[2]).slice(0, 120), url: u, texto: sinHtml(m[3]).slice(0, 400) });
    if (res.length >= 8) break;
  }
  if (!res.length) throw new Error('no web results');
  const paginas = [];
  for (const r of res.slice(0, 5)) {   // las 3 primeras que se dejen leer
    if (paginas.length >= 3) break;
    try { const t = String(await leer(r.url) || '').replace(/\s+/g, ' ').trim(); if (t.length > 400 && !/just a moment|access denied|verify you are human|enable javascript/i.test(t.slice(0, 300))) paginas.push(`### ${r.titulo} (${r.url})\n${t.slice(0, 3500)}`); } catch { /* esa no */ }
  }
  return { texto: res.map((r) => `- ${r.titulo}: ${r.texto} (${r.url})`).join('\n') + '\n\n' + paginas.join('\n\n'), fuentes: res.map(({ titulo, url }) => ({ titulo, url })) };
}

// markdown sencillo → HTML (títulos, listas, tablas, negritas, enlaces)
function aHtml(md) {
  const enl = (s) => esc(s).replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>').replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  const ls = String(md).split('\n'); const out = []; let i = 0;
  while (i < ls.length) {
    const l = ls[i].trim();
    if (l.startsWith('|')) {
      const filas = []; while (i < ls.length && ls[i].trim().startsWith('|')) { filas.push(ls[i].trim()); i++; }
      const celdas = (f) => f.replace(/^\||\|$/g, '').split('|').map((x) => x.trim());
      const cuerpo = filas.filter((f) => !/^[|\s:-]+$/.test(f));   // sin la fila |---|---|
      out.push('<table>' + cuerpo.map((f, k) => `<tr>${celdas(f).map((c) => (k === 0 ? `<th>${enl(c)}</th>` : `<td>${enl(c)}</td>`)).join('')}</tr>`).join('') + '</table>');
      continue;
    }
    if (/^#{1,4}\s/.test(l)) { const n = l.match(/^#+/)[0].length; out.push(`<h${n + 1}>${enl(l.replace(/^#+\s*/, ''))}</h${n + 1}>`); i++; continue; }
    if (/^([-*•]|\d+\.)\s+/.test(l)) { const it = []; while (i < ls.length && /^([-*•]|\d+\.)\s+/.test(ls[i].trim())) { it.push(`<li>${enl(ls[i].trim().replace(/^([-*•]|\d+\.)\s+/, ''))}</li>`); i++; } out.push(`<ul>${it.join('')}</ul>`); continue; }
    out.push(l ? `<p>${enl(l)}</p>` : ''); i++;
  }
  return out.join('\n');
}

function pagina(tema, md, fuentes, idioma) {
  const es = idioma === 'es';
  return `<!doctype html><html lang="${es ? 'es' : 'en'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>🕵 ${esc(tema)}</title>
<style>:root{--c:#38d6ff}body{margin:0;background:#03080e;color:#d8f3ff;font:16px/1.6 system-ui,Segoe UI,Roboto,sans-serif}main{max-width:900px;margin:0 auto;padding:32px 20px 60px}
.cab{border-bottom:1px solid rgba(56,214,255,.3);padding-bottom:14px;margin-bottom:20px}.cab small{color:#7f9fb2;letter-spacing:.12em;text-transform:uppercase}
h1{margin:6px 0 0;font-size:28px;color:#fff}h2,h3,h4{color:var(--c);margin-top:28px}a{color:var(--c)}b{color:#fff}
table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px;display:block;overflow-x:auto}th,td{border:1px solid rgba(56,214,255,.25);padding:8px 10px;text-align:left;vertical-align:top}
th{background:rgba(56,214,255,.12);color:#fff}tr:nth-child(even) td{background:rgba(255,255,255,.02)}
.fuentes{margin-top:36px;border-top:1px solid rgba(56,214,255,.3);padding-top:12px;font-size:13px}.fuentes li{margin:4px 0}</style></head>
<body><main><div class="cab"><small>🕵 JARVIS · ${es ? 'Informe de investigación' : 'Research report'} · ${new Date().toLocaleString()}</small><h1>${esc(tema)}</h1></div>
${aHtml(md)}
${fuentes.length ? `<div class="fuentes"><b>${es ? 'Fuentes' : 'Sources'}</b><ol>${fuentes.map((f) => `<li><a href="${esc(f.url)}" target="_blank">${esc(f.titulo)}</a></li>`).join('')}</ol></div>` : ''}
</main></body></html>`;
}

// o: { llave, tema, idioma, nombreIdioma, carpeta, progreso(texto) } → { id, archivo, resumen }
async function investigar(o) {
  const { llave, tema } = o;
  o.progreso && o.progreso('plan');
  // escribir (sin buscar): con cualquier IA que tengas (pensar rota proveedores); si no hay, con Gemini + búsqueda
  const escribir = async (texto, max) => { if (o.pensar) { try { return await o.pensar({ sistema: 'You are a careful research assistant.', historia: [{ rol: 'user', texto }], max }); } catch (e) { if (!llave) throw e; } } return buscar(llave, texto, max); };
  const hoy = `Today is ${new Date().toDateString()}.`;
  const plan = await escribir(`${hoy} I must research this for a user: "${tema}". Write 4 to 6 specific web-search questions (one per line, no numbering, no extra text) that together cover it well (current options/prices/specs, comparisons, pros and cons, expert reviews).`, 600);
  const preguntas = plan.texto.split('\n').map((x) => x.replace(/^[-*\d.)\s]+/, '').trim()).filter((x) => x.length > 8).slice(0, 6);
  const hallazgos = []; const fuentes = new Map(); let sinCuota = false;
  for (let k = 0; k < preguntas.length; k++) {
    o.progreso && o.progreso(`${k + 1}/${preguntas.length}: ${preguntas[k]}`);
    try {
      if (k) await new Promise((ok) => setTimeout(ok, 2500));   // sin prisa: el plan gratis de Gemini limita las búsquedas por minuto
      let r = null;
      if (llave && !sinCuota) { try { r = await buscar(llave, `${hoy} Search the web: ${preguntas[k]}\nAnswer with concrete, current facts (names, prices, specs, dates) in bullet points, and put the source page URL in parentheses after each fact.`, 1500); } catch { sinCuota = true; } }
      if (!r) r = await buscarEnWeb(preguntas[k], o.leerPagina);   // sin cuota de Gemini: DuckDuckGo + las páginas
      hallazgos.push(`## ${preguntas[k]}\n${r.texto}`);
      for (const f of r.fuentes) if (!fuentes.has(f.url) && fuentes.size < 25) fuentes.set(f.url, f);
    } catch { /* esa pregunta falló: seguimos con las demás */ }
  }
  if (!hallazgos.length) throw new Error('No pude buscar en internet.');
  o.progreso && o.progreso('informe');
  const final = await escribir(`${hoy} Using ONLY these research notes, write a clear report in ${o.nombreIdioma} for the user about: "${tema}".
Structure: a 2–3 sentence summary first; then a markdown comparison table of the main options (with the most useful columns: price, key specs, pros, cons…); then a short "My recommendation" section saying which to choose and why; then any warnings. Use markdown (## headings, | tables |, - bullets). No preamble.
NOTES:
${hallazgos.join('\n\n').slice(0, 60000)}`, 4000);
  const id = crypto.randomBytes(6).toString('hex');
  fs.mkdirSync(o.carpeta, { recursive: true });
  const archivo = path.join(o.carpeta, `${id}.html`);
  fs.writeFileSync(archivo, pagina(tema, final.texto, [...fuentes.values()], o.idioma));
  const resumen = final.texto.split('\n').map((x) => x.trim()).filter((x) => x && !x.startsWith('#') && !x.startsWith('|')).slice(0, 2).join(' ').slice(0, 400);
  return { id, archivo, resumen, fuentes: fuentes.size, markdown: final.texto };
}
module.exports = { investigar, aHtml, buscarEnWeb };
