# ALBot

Ein gemeinsamer Adventure-Land-Bot für Browser-CODE und den vorhandenen Node.js-Headless-Client. Ziel: die Spielfunktionen aus ALFinal sowie v3, v4 und v5 zusammenführen, einschließlich Farmer, Merchant, Item-Regeln, Gruppenplanung und Produktion.

**Stand 6. Oktober 2026: Werkstatt 2.0 und der erste spielbare Testkandidat `0.1.1-live-a` sind implementiert. Der echte Live-Test A steht noch aus.**

Zum Testen: [Live-A-Anleitung](docs/LIVE-A.md), [Bot-Paket für die Werkstatt](dist/albot.package.json), [Solo-Profil](profiles/live-a-solo.json), [Team-Profil](profiles/live-a-team.json). `dist/albot.js` ist ein vollständiges Bundle mit Platzhaltern und ausgeschaltetem Autostart. Eigene Namen über die Werkstatt einsetzen. Die exakt gleiche exportierte Datei läuft in Browser-CODE und Headless.

Build: `npm run build`; gezielte Prüfungen: `npm test`. Node ab 22.9, keine npm-Abhängigkeiten. Unterstützt sind Farmen, sechs Klassenrotationen, Gruppe und kleine Lieferungen aus vorhandenem Bestand. Bank, Handel, Produktion und Welt-Automatik folgen in den weiteren Etappen. Kein Live- oder Linux-Ergebnis wird vorweggenommen.

Die [Bot-Werkstatt](editor/Bot-Werkstatt.html) als Datei herunterladen und lokal im Browser öffnen. Sie konfiguriert den vollständigen geplanten Bot und kann später fertige Bot-Pakete samt neuen Einstellungsschemata laden. [Anleitung](editor/README.md) · [verbindlicher Integrationsvertrag](docs/WORKSHOP-CONTRACT.md).

## Einstieg

1. [ROADMAP.md](ROADMAP.md): verbindlicher Umfang, Reihenfolge und drei gezielte Live-Testpunkte.
2. [BOT-ANALYSE.md](docs/BOT-ANALYSE.md): Arbeitsweise der vier Versionen, konkrete Quellpfade und Übernahmeentscheidungen.
3. [HOW-TO-USE.md](HOW-TO-USE.md): vollständiger Vertrag des Headless-Clients 1.2.1, API-Version 1.
4. [RUNTIME-VERTRAG.md](docs/RUNTIME-VERTRAG.md): Umsetzung dieses Vertrags im zukünftigen Bot.
5. [AGENTS.md](AGENTS.md): Arbeitsregeln für weitere KIs.

Keine eigene Headless-Laufzeit, Telemetrieplattform oder umfassende Log-Infrastruktur. Keine Shadow-Tests. Der vorhandene Client übernimmt Login, Prozesse, Reconnect und sein optionales Dashboard. Der Bot übernimmt Spielentscheidungen.

Das Headless-Handbuch ist eine Kopie der Client-Dokumentation. Seine Installationsdateien wie `src/cli.js`, `.env.example` und `config.example.json` gehören zum separaten Client und sind in diesem Planungsrepository nicht enthalten. Die ergänzende [Typdefinition](docs/headless-api.d.ts) liegt hier bei.

Testprotokoll: im Browser **Testlog speichern** → test-ausgeführtertest.json. Headless ab Client 1.2.2 automatisch unter test-logs/CHARAKTER/. Details und Reparatur des gemeldeten vollen Browser-Speichers: [LIVE-A.md](docs/LIVE-A.md).
