# ALBot

Ein gemeinsamer Adventure-Land-Bot für Browser-CODE und den vorhandenen Node.js-Headless-Client. Ziel: die Spielfunktionen aus ALFinal sowie v3, v4 und v5 zusammenführen, einschließlich Farmer, Merchant, Item-Regeln, Gruppenplanung und Produktion.

**Stand 6. Oktober 2026: Die Bot-Werkstatt 2.0 und ihr vollständiger Konfigurationsvertrag sind implementiert. Die neue Spiel-Laufzeit ist noch nicht implementiert.**

Die [Bot-Werkstatt](editor/Bot-Werkstatt.html) als Datei herunterladen und lokal im Browser öffnen. Sie konfiguriert den vollständigen geplanten Bot und kann später fertige Bot-Pakete samt neuen Einstellungsschemata laden. [Anleitung](editor/README.md) · [verbindlicher Integrationsvertrag](docs/WORKSHOP-CONTRACT.md).

## Einstieg

1. [ROADMAP.md](ROADMAP.md): verbindlicher Umfang, Reihenfolge und drei gezielte Live-Testpunkte.
2. [BOT-ANALYSE.md](docs/BOT-ANALYSE.md): Arbeitsweise der vier Versionen, konkrete Quellpfade und Übernahmeentscheidungen.
3. [HOW-TO-USE.md](HOW-TO-USE.md): vollständiger Vertrag des Headless-Clients 1.2.1, API-Version 1.
4. [RUNTIME-VERTRAG.md](docs/RUNTIME-VERTRAG.md): Umsetzung dieses Vertrags im zukünftigen Bot.
5. [AGENTS.md](AGENTS.md): Arbeitsregeln für weitere KIs.

Keine eigene Headless-Laufzeit, Telemetrieplattform oder umfassende Log-Infrastruktur. Keine Shadow-Tests. Der vorhandene Client übernimmt Login, Prozesse, Reconnect und sein optionales Dashboard. Der Bot übernimmt Spielentscheidungen.

Das Headless-Handbuch ist eine Kopie der Client-Dokumentation. Seine Installationsdateien wie `src/cli.js`, `.env.example` und `config.example.json` gehören zum separaten Client und sind in diesem Planungsrepository nicht enthalten. Die ergänzende [Typdefinition](docs/headless-api.d.ts) liegt hier bei.
