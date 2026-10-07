# ALBot

Ein gemeinsamer Adventure-Land-Bot für Browser-CODE und den vorhandenen Node.js-Headless-Client. Ziel: die Spielfunktionen aus ALFinal sowie v3, v4 und v5 zusammenführen, einschließlich Farmer, Merchant, Item-Regeln, Gruppenplanung und Produktion.

**Stand 7. Oktober 2026:** Live B mit `0.2.2-live-b` ist in Browser und Windows-Headless vollständig bestätigt. **`0.3.1-live-c` ist für den nächsten gemeinsamen Live-Test vorbereitet:** Wenn–dann-Regeln, faire Merchant-Aufträge, Gathering/Werkzeugwechsel, Ponty/Merrit, Weltplanung, Accountrotation, Paladin und vereinbarte Teamreisen. Die neuen Optionen sind noch nicht live freigegeben. [Live-C-Anleitung](docs/LIVE-C.md) · [Funktionszuordnung und offene Lücken](docs/INTEGRATIONSSTAND.md) · [Live-B-Ergebnis](docs/LIVE-B-ERGEBNIS.md).

Aktuell: [Werkstattpaket](dist/albot.package.json), [C-Team-Beispiel](profiles/live-c-team.json). Persönliche C-Dateien aus A/B/C-Profilen erzeugt `scripts/export-live-c.mjs`. Paket in der vorhandenen Werkstatt laden, passendes C-Profil öffnen und fertige bot.js exportieren. Neue Exporte verwenden **autostart: true**. Die gleiche exportierte Datei läuft in Browser-CODE und Headless. Historische A/B-Dateien bleiben erhalten; der B-Exporter nutzt [das archivierte B-Paket](dist/albot-live-b.package.json).

Build: `npm run build`; gezielte Prüfungen: `npm test`. Node ab 22.9, keine npm-Abhängigkeiten. Build/Export sind Windows-/Linux-portabel; tatsächlich ausgeführte Prüfungen dieses Kandidaten erfolgten unter Windows. Linux ist weiterhin nicht live nachgewiesen. Kein eigener Host, Socket oder Node-Zugriff im Bot.

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
