# ALBot

Ein gemeinsamer Adventure-Land-Bot für Browser-CODE und den vorhandenen Node.js-Headless-Client. Ziel: die Spielfunktionen aus ALFinal sowie v3, v4 und v5 zusammenführen, einschließlich Farmer, Merchant, Item-Regeln, Gruppenplanung und Produktion.

**Stand 7. Oktober 2026:** Live A hat kurze Browser-/Windows-Headless-Nachweise. Live B: Schritte 01 Abholung, 02 Bank und 03 Bank→NPC sind im Browser bestanden. Schritt 04 bestätigte Upgrade und Kauf, aber das erste Lieferangebot wurde beim beschäftigten Empfänger verworfen und lief aus. **0.2.2-live-b** wiederholt unbestätigte Offers mit derselben ID und unterdrückt unnötiges Nachkaufen des +0-Produktionsinputs, sobald das +1-Ziel erfüllt ist. Schritt 04 muss mit 0.2.2 wiederholt werden. P3/P4 sind teilweise implementiert. [Live-B-Anleitung](docs/LIVE-B.md) · [Live-B-Ergebnis](docs/LIVE-B-ERGEBNIS.md).

Zum nächsten Test: [Live-B-Anleitung](docs/LIVE-B.md), [Werkstattpaket](dist/albot.package.json), [Team-Beispiel](profiles/live-b-team.json). Persönliche `0.2.2-live-b`-Stufen liegen unter [`dist/live-b-my-team/`](dist/live-b-my-team/); nach den bestandenen Schritten 01–03 nur Schritt 04 erneut ausführen. Persönliche Testdateien aus dem vorhandenen Live-A-Profil erzeugt `scripts/export-live-b.mjs`. Neue Profile verwenden **autostart: true**. Historische Live-A-Dateien bleiben als Rückfall verfügbar. Die exakt gleiche exportierte Datei läuft in Browser-CODE und Headless.

Build: `npm run build`; gezielte Prüfungen: `npm test`. Node ab 22.9, keine npm-Abhängigkeiten. Der Kandidat ergänzt Bank, NPC-/Spielerhandel und Produktionsregeln. Grenzen und noch offene Merchant-Funktionen stehen in der Live-B-Anleitung. Linux und neue Live-B-Spielaktionen sind noch nicht live nachgewiesen.

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
