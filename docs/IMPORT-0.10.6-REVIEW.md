# ALBot 0.10.6-candidate – Importprüfung (noch nicht gemergt)

Quelle: vom Benutzer am 14.10.2026 hochgeladenes Archiv `ALBot-0.10.6-Korrekturen.zip`.
Paketmanifest: `version=0.10.6-candidate`, `sourceCommit=3845d3f`, 770 Offline-Tests, Live-Test ausstehend.

## Kontrollierter Integrationsstatus
- GitHub `main` vor Import: `15c023fda0c3ec9bb32c4c907046efbf625d053c`.
- `sourceCommit=3845d3f31f8ef6265fd17cdd15a423d32921159b` ist im Repository nicht abrufbar. Deshalb gibt es keinen belegten gemeinsamen Git-Merge-Basispunkt.
- Der Quellcode-Snapshot enthält abweichende bestehende Dateien u.a. in `src/main.mjs`, `src/merchant/*`, `src/production/*`, `src/party/*`, `src/items/*` und `scripts/build.mjs`. Ein Copy/Paste nach `main` wurde deshalb nicht durchgeführt.
- Das beigefügte Archiv wurde isoliert extrahiert und mit Node 22 getestet: **770 bestanden, 0 fehlgeschlagen**.
- Das Paket aktiviert `merchant.budgetMode=account-loss`; im Modus werden vorherige Ausgabenlimits aufgehoben. Bei unvollständigen Goldbelegen ist der 85%-Notstopp laut Quellcode/Dokumentation nicht auswertbar. Das ist ein relevantes Betriebsrisiko und muss bei der PR-Abnahme ausdrücklich geprüft werden.
- Persönliche `bot.js` des aktuellen `main` sowie Nicht-PvP-Serverliste, 36-Sekunden-Kampfdauer, Merchant-Versorgung und Farmer-Rotation dürfen beim Import nicht überschrieben werden.
- Der Import-Branch ist eine Vorbereitung, **keine abgeschlossene Implementierung**.

## Freigabegates
1. Gesamten Quellcode-Snapshot (ohne erzwungenen Austausch der persönlichen `bot.js`) auf diesen Import-Branch bringen und die Unterschiede gegen `main` prüfen.
2. GitHub-Linux- und -Windows-CI, Build-/Editor-Artefakte und persönliche CODE-Parität bestehen.
3. Vor der Freigabe Accountgold-Beobachtbarkeit einschließlich aller Offline-Farmer und Bankbestand klären; insbesondere die Fail-open-Phasen des neuen Goldschutzes.
4. PR mit geprüfter Head-SHA gegen den aktuellen `main` squash-mergen; nicht vorher.
