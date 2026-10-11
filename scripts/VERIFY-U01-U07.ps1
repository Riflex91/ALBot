# ALBot Offline-Abnahme: keine Anmeldung, kein Deployment, keine Journale loeschen.
# Ausfuehren vom Repo aus: powershell -ExecutionPolicy Bypass -File .\scripts\VERIFY-U01-U07.ps1
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path -Parent $PSScriptRoot)
function Check-Exit($label) {
  if ($LASTEXITCODE -ne 0) { throw "$label fehlgeschlagen (Exit $LASTEXITCODE)" }
}
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'Node.js >=22.9 erforderlich' }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm.cmd erforderlich' }
$version = (& node -p 'process.versions.node').Trim().Split('.')
Check-Exit 'Node-Abfrage'
if ([int]$version[0] -lt 22 -or ([int]$version[0] -eq 22 -and [int]$version[1] -lt 9)) {
  throw ('Node.js >=22.9 erforderlich; installiert: ' + ($version -join '.'))
}
if (-not (Test-Path 'node_modules/terser')) { throw 'Abhaengigkeiten fehlen: zuerst npm.cmd ci ausfuehren' }
Write-Host '1/5: Klassischen Bot bauen (frisches Test-Artefakt)'
& npm.cmd run build
Check-Exit 'npm run build'
Write-Host '2/5: Node-Pruefungen (einschliesslich Runtime-Artefakt)'
& npm.cmd test
Check-Exit 'npm test'
$bundle = Join-Path (Get-Location) 'dist/albot.js'
if (-not (Test-Path $bundle)) { throw 'dist/albot.js fehlt' }
Write-Host '3/5: Syntax des ausgelieferten Bundles'
& node --check $bundle
Check-Exit 'node --check dist/albot.js'
$bytes = (Get-Item $bundle).Length
if ($bytes -gt 1048576) { throw "Bundle zu gross: $bytes > 1048576 Bytes" }
Write-Host "Bundle: $bytes / 1048576 Bytes"
Write-Host '4/5: Werkstatt mit demselben Runtimepaket bauen'
& npm.cmd run build:editor
Check-Exit 'npm run build:editor'
Write-Host '5/5: Fingerprint fuer identischen Browser-/Headless-Import'
$hash = Get-FileHash -Algorithm SHA256 $bundle
Write-Host ('Artefakt: dist/albot.js | SHA256: ' + $hash.Hash)
& node --input-type=module -e 'import fs from "node:fs"; import crypto from "node:crypto"; const bytes=fs.readFileSync("dist/albot.js"); const manifest=JSON.parse(fs.readFileSync("dist/manifest.json","utf8")); const sha=crypto.createHash("sha256").update(bytes).digest("hex"); if(manifest.bytes!==bytes.length || manifest.sha256!==sha) {throw new Error("Manifest stimmt nicht mit Bundle ueberein")};'
Check-Exit 'Bundle/Manifest-Identitaet'
Write-Host 'PASS (offline): Tests, Build, Syntax, Werkstatt, Groessenlimit.'
Write-Host 'OFFEN: Eigenen Browser-CODE und Headless CODE/main.js auf identischen Hash pruefen; kein Live-/Linux-Nachweis.'
