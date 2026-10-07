# Aktuell: P3/P4 · 0.5.0-p3p4

P3/P4-Implementierung ergänzt; der gemeinsame Live-Test steht aus. [Vertrag und Einstellungen](docs/P3-P4.md), [gemeinsamer Testablauf](docs/P3-P4-LIVE.md). Aktuelles Paket: dist/albot.package.json, Werkstatt: editor/Bot-Werkstatt.html, Schema albot.p3p4/v1. Bestehende A/B/C-Konfigurationen bleiben lauffähig. Abgeleitete Zielplanung ist ausdrücklich opt-in; Autostart bei neuen Exporten true.

# ALBot

Ein gemeinsamer Adventure-Land-Bot für Browser-CODE und den vorhandenen Node.js-Headless-Client. Ziel: die Spielfunktionen aus ALFinal sowie v3, v4 und v5 zusammenführen, einschließlich Farmer, Merchant, Item-Regeln, Gruppenplanung und Produktion.

**Stand 7. Oktober 2026:** Live B mit `0.2.2-live-b` ist in Browser und Windows-Headless vollständig bestätigt. **Live C mit `0.3.1-live-c` ist laut Nutzerbestätigung bestanden.** Das bestätigt den vereinbarten Testablauf, einschließlich Bee-Wechsel und Merchant-Nebenaufgabe. Ausgeschaltete Welt-/Account-/Teamreiseoptionen und offene Roadmapfunktionen bleiben getrennt zu beurteilen; die Umgebungen wurden für diese C-Bestätigung nicht einzeln benannt. [Live-C-Ergebnis](docs/LIVE-C-ERGEBNIS.md) · [Live-C-Anleitung](docs/LIVE-C.md) · [Funktionszuordnung und offene Lücken](docs/INTEGRATIONSSTAND.md).

Aktuelles [Werkstattpaket](dist/albot.package.json), [P3/P4-Teambeispiel](profiles/p3p4-team.json). Persönliches Testpaket: `node scripts/export-p3p4.mjs Profil.json neuer-Ordner`. Paket in der vorhandenen Werkstatt laden, bestehende Werte übernehmen und Profil öffnen. Neue Exporte starten automatisch. Bestätigte historische Pakete A/B/C bleiben separat; der Merchant-Exporter verwendet das archivierte 0.4.0-Paket.

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
