# JARVIS Browser para Windows: arma el instalador (Navegador-JARVIS-Setup.exe).
# Uso: abre PowerShell en esta carpeta y ejecuta:  powershell -ExecutionPolicy Bypass -File construir.ps1
# Necesita Node.js (LTS). La primera vez baja Electron y electron-builder (unos 200 MB).
# El instalador queda en desktop\salida\ junto con actualizacion.json (versión + huella SHA-256).
$ErrorActionPreference = "Stop"
$D = $PSScriptRoot
$B = Join-Path $D ".obra"          # carpeta de trabajo (no va al repositorio)
$A = Join-Path $B "app"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Write-Host "Falta Node.js: instálalo desde https://nodejs.org (versión LTS) y vuelve a intentarlo."; exit 1 }
$ver = (Get-Content (Join-Path $D "version.txt") -Raw).Trim()
Write-Host "Armando JARVIS Browser $ver para Windows..."
if (Test-Path $A) { Remove-Item $A -Recurse -Force }
if (Test-Path "$B\dist") { Remove-Item "$B\dist" -Recurse -Force }
New-Item -ItemType Directory -Force -Path $A, "$B\extra\idiomas", "$B\extra\inicio" | Out-Null
Copy-Item "$D\app\*" $A -Recurse -Force
Copy-Item "$D\idiomas\*" "$B\extra\idiomas" -Recurse -Force
Copy-Item "$D\inicio\*" "$B\extra\inicio" -Recurse -Force
# el traductor de las ventanas (inglés por defecto) va pegado al final de cada preload
$sinBom = New-Object System.Text.UTF8Encoding($false)
$trad = [IO.File]::ReadAllText("$D\idiomas\traductor-ventana.js")
foreach ($pre in @("preload.js", "preload-config.js")) { [IO.File]::AppendAllText("$A\$pre", "`n" + $trad, $sinBom) }
$pkg = @{
  name = "navegador-jarvis"; productName = "Navegador JARVIS"; version = $ver; main = "main.js"
  description = "JARVIS Browser: navegador con asistente de IA"; author = "Luis (IV2S4)"
  devDependencies = @{ electron = "45.2.3"; "electron-builder" = "^25.1.8" }
  build = @{
    appId = "os.jarvis.navegador"; productName = "Navegador JARVIS"
    directories = @{ output = "dist"; app = "app" }
    extraResources = @(@{ from = "extra/idiomas"; to = "idiomas" }, @{ from = "extra/inicio"; to = "inicio" })
    win = @{ target = @(@{ target = "nsis"; arch = @("x64") }); icon = "app/ui/icono.png" }
    nsis = @{ artifactName = "Navegador-JARVIS-Setup.exe"; oneClick = $false; perMachine = $false; allowToChangeInstallationDirectory = $true; createDesktopShortcut = $true; createStartMenuShortcut = $true; shortcutName = "Navegador JARVIS" }
  }
}
[IO.File]::WriteAllText("$B\package.json", ($pkg | ConvertTo-Json -Depth 8), $sinBom)
[IO.File]::WriteAllText("$A\package.json", (@{ name = "navegador-jarvis"; productName = "Navegador JARVIS"; version = $ver; main = "main.js"; description = "JARVIS Browser"; author = "Luis (IV2S4)"
  dependencies = @{ "@ghostery/adblocker-electron" = "2.20.1"; "vosk-browser" = "0.0.8"; "@mediapipe/tasks-vision" = "0.10.21"; "unpdf" = "1.0.6"; "mammoth" = "1.8.0"; "sql.js" = "1.11.0" } } | ConvertTo-Json), $sinBom)
Push-Location $A
try { npm install --omit=dev --legacy-peer-deps --no-audit --no-fund --loglevel=error } finally { Pop-Location }
Get-ChildItem "$A\node_modules\sql.js\dist" -ErrorAction SilentlyContinue | Where-Object { $_.Name -notin @("sql-wasm.js", "sql-wasm.wasm") } | Remove-Item -Force -Recurse
$env:CSC_IDENTITY_AUTO_DISCOVERY = "false"
Push-Location $B
try {
  npm install --no-audit --no-fund --loglevel=error
  npx electron-builder --win nsis --x64 --publish never
} finally { Pop-Location }
$S = Join-Path $D "salida"; New-Item -ItemType Directory -Force -Path $S | Out-Null
$exe = Get-ChildItem "$B\dist" -Filter "*.exe" -ErrorAction SilentlyContinue
if (-not $exe) { Write-Host "ALTO: no se creó el instalador (mira los mensajes de arriba)"; exit 1 }
$exe | Copy-Item -Destination $S -Force
$inst = Join-Path $S "Navegador-JARVIS-Setup.exe"
$nota = @{ version = $ver; instalador = "Navegador-JARVIS-Setup.exe"; sha256 = (Get-FileHash $inst -Algorithm SHA256).Hash.ToLower(); fecha = (Get-Date).ToString("s") }
[IO.File]::WriteAllText((Join-Path $S "actualizacion.json"), ($nota | ConvertTo-Json), $sinBom)
Write-Host "LISTO: JARVIS Browser $ver -> $inst"
