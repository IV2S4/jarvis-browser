'use strict';
// Modo gaming automático [04-nov]
// Cada 20 s mira (en segundo plano, sin trabar nada) si hay un juego abierto con ventana.
// Lo reconoce por la carpeta donde está instalado (Steam, Epic, Battle.net, Riot, EA, Ubisoft, Xbox, GOG, Rockstar)
// o por el nombre del programa. Los lanzadores (Steam, Epic Launcher, Battle.net…) no cuentan.
const { execFile } = require('child_process');

const RUTAS = /\\steamapps\\common\\|\\Epic Games\\(?!Launcher\\)|\\Riot Games\\(?!Riot Client\\)|\\Battle\.net\\.+\\.+\.exe$|\\EA Games\\|\\Electronic Arts\\|\\Ubisoft Game Launcher\\games\\|\\XboxGames\\|\\GOG Galaxy\\Games\\|\\Rockstar Games\\(?!Launcher\\)|\\Call of Duty\\|\\Battlefield/i;
const NOMBRES = /^(cod|cod\d*|bf6|bf2042|valorant(-win64-shipping)?|cs2|fortniteclient-win64-shipping|gta5|gtav|gta5_enhanced|r5apex|r5apex_dx12|overwatch|destiny2|eldenring|cyberpunk2077|rocketleague|warframe\.x64|discovery|deltaforceclient-win64-shipping|leagueoflegends|league of legends|dota2|tslgame|marvel-win64-shipping|fc\d+|nba2k\d+|robloxplayerbeta|minecraft\.windows|helldivers2|thefirstdescendant|m1-win64-shipping)$/i;
const EXCLUIR = /launcher|crashhandler|crashreport|helper|setup|install|easyanticheat|battleye|unitycrash|bootstrap|steamwebhelper|epicwebhelper|riotclient|battle\.net|agent|updater|overlay|uninst|unrealeditor|unrealinsights|\\Epic Games\\UE_\d|unity hub|unity\.exe|godot|blender|\\Engine\\Binaries\\/i;   // editores (Unreal, Unity, Godot, Blender) no son juegos
const PS = "Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.Path } | ForEach-Object { $_.Name + '|' + $_.Path + '|' + $_.MainWindowTitle }";

let temporizador = null;
let actual = null;      // juego detectado
let fallos = 0;         // veces seguidas sin juego (para no apagar y encender por un parpadeo)

function buscar() {
  return new Promise((ok) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', PS], { windowsHide: true, timeout: 15000, maxBuffer: 2 * 1024 * 1024 }, (err, salida) => {
      if (err || !salida) return ok(null);
      for (const linea of String(salida).split(/\r?\n/)) {
        const [nombre, ruta, titulo] = linea.split('|');
        if (!nombre || !ruta || EXCLUIR.test(nombre) || EXCLUIR.test(ruta)) continue;
        if (RUTAS.test(ruta) || NOMBRES.test(nombre)) return ok({ nombre, titulo: (titulo || '').trim() || nombre });
      }
      ok(null);
    });
  });
}

// alCambiar(juego|null): se llama al empezar y al terminar de jugar
function iniciar(alCambiar, activo) {
  if (process.platform !== 'win32' || temporizador) return;
  const vuelta = async () => {
    if (!activo()) { if (actual) { actual = null; alCambiar(null); } return; }
    const j = await buscar();
    if (j) { fallos = 0; if (!actual || actual.nombre !== j.nombre) { actual = j; alCambiar(j); } }
    else if (actual && ++fallos >= 2) { actual = null; fallos = 0; alCambiar(null); }
  };
  temporizador = setInterval(vuelta, 20000);
  setTimeout(vuelta, 8000);
}

module.exports = { iniciar, buscar, actual: () => actual };
