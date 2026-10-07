# Live C · 0.3.2-live-c

Live B wurde vom Nutzer in Browser und Windows-Headless vollständig bestätigt. Dieser Kandidat integriert die nächsten Roadmap-Funktionen. **Live C ist noch nicht bestanden.** Keine Shadow-Tests, kein automatischer Spielstart durch die Entwicklung.

Entwicklungsprüfung unter Windows: **65 gezielte Bot-/Werkstatt-Prüfungen bestanden**, klassischer Build/Syntax und beide Paket-Hashes geprüft. Der tatsächliche C-Build mit 1.276 Regeln für alle 638 Katalogitems misst **381.564 UTF-8-Bytes**, weit unter 1.048.576 Byte. Persönliche Testdateien etwa 173 KB. Werkstattimport/-export, Katalog, Mehrfachbearbeitung und Regelvorschau zusätzlich im DOM geprüft; importierter Runtimecode wurde dabei nicht ausgeführt. Aktive Clientkonfiguration und CODE/main.js per unverändertem Hash geprüft; neue Clientvorlagen offline validiert. Kein Linux-/Live-C-Erfolg daraus abgeleitet.

Browser- und Headless-Rückmeldung: 0.3.1 beseitigte die direkten `move: failed`-Fehler, der Headless-Retest erreichte aber weiterhin keinen nachgewiesenen Bee-Angriff. 0.3.2 lässt die kollisionsbewusste `smart_move`-Pfadsuche rechnen, bevor fehlender Positionsfortschritt bewertet wird, und schützt einen expliziten `farm:bee`-Regelauftrag vor normalem Follow-/Wait-for-Team. Erneuter Live-Lauf steht aus. [Auswertung](LIVE-C-ERGEBNIS.md). Merchant darf in Phase 01/02 ohne Nachschubbedarf warten; Fishing ist ausschließlich in Phase 03 aktiv.

## Dateien und Einstellungen

`dist/albot.package.json` ist das neue Werkstattpaket mit `albot.live-c/v1`. Die bestehende Werkstatt braucht keinen neuen Formularcode: **Bot-Paket / Schema laden**, danach das passende C-Profil öffnen, Einstellungen ändern und **Fertige bot.js exportieren**. Ein B-Profil hat eine andere Schema-ID und muss vorher ausdrücklich migriert werden.

Persönliche Dateien erzeugen:

```powershell
node scripts/export-live-c.mjs "Pfad/zum/Profil.json" "neuer/Ausgabeordner"
```

Das Werkzeug akzeptiert A/B/C-Profile und vollständige Testberichte ohne ausgelassene Item-Regeln. Es ergänzt neue Standardfelder, prüft Konfiguration, Paket-Hash, Syntax und Größe. Ein bestehender Ausgabeordner wird nicht überschrieben. Bei dem bekannten B-Stufe-04-Testprofil entfernt die zusätzliche Option `--from-live-b-test` genau die fünf temporären Helm-/Scroll-Regeln und deaktiviert dessen Upgrade-Test. Persönliche Trank-, Charakter- und Skillregeln bleiben erhalten. Andere Profile werden nicht automatisch bereinigt. Autostart wird entsprechend dem Nutzerauftrag auf **true** gesetzt.

| Datei | Zweck |
|---|---|
| `01-normalbetrieb.js` / `.json` | Bestehende Farm-/Trankregeln mit neuer Runtime; neue riskante Weltaktionen und Rotation ausgeschaltet |
| `02-regelwechsel.js` / `.json` | Bee zusätzlich erlauben; Farmer wechseln bei mindestens 95 % HP und sechs freien Slots per Wenn–dann-Regel zu Bee |
| `03-merchant-nebenaufgabe.js` / `.json` | Fishing für den Merchant aktivieren; Farmer behalten die bisherigen Ziele |
| `albot.package.json` | Runtime und tatsächliches Live-C-Einstellungsschema für die Werkstatt |
| `manifest.json` | Version, Exportgrößen und entfernte temporäre Testregeln |

Der Export aktiviert keine neuen Tool-Kaufregeln. Vor Phase 03 muss der Merchant eine **ungesperrte `rod`** besitzen und darf keine geschützte Mainhand/Offhand für den Wechsel benötigen. Mindestens Level 16, 120 MP und freie Inventarplätze; Fishing muss im Spiel bereit sein. Sonst wird der konkrete fehlende Zustand gemeldet. Dies ist kein erfolgreicher Gathering-Nachweis.

## Ein gemeinsamer Live-Termin

Je Umgebung etwa 20–30 Minuten; dieselben exportierten `.js`-Dateien in Browser und Headless verwenden. Einen Charakter nie gleichzeitig in beiden Umgebungen anmelden. Windows ist verfügbar; Linux erst als geprüft nennen, wenn dort tatsächlich ein Lauf erfolgte.

1. **Normalbetrieb, etwa 10 Minuten:** Phase 01 auf Merchant und allen Farmern laden. Farmen, HP/MP und mindestens eine tatsächlich benötigte Tranklieferung beobachten. Kein künstlich leergeräumtes Inventar erforderlich. Eine ohne Bedarf ausgebliebene Lieferung ist kein Fehler, aber auch kein Liefernachweis. `ALBot.status()` soll `0.3.2-live-c`, die richtige Umgebung und `running: true` zeigen.
2. **Kontrollierter Regelwechsel, etwa 5 Minuten:** Erst offene Aktionen abschließen, dann Phase 02 auf alle vier Charaktere laden. Bei ausreichenden HP/Slots werden `behavior.rule` und `strategy.request` im Bericht erfasst; `strategy.manual.id` ist `bee`. Jeder Farmer mit erfüllter Bedingung soll zum erlaubten Bee-Ziel wechseln; sein zeitlich begrenzter Bee-Auftrag darf dabei nicht durch normales Follow-/Wait-for-Team zurück zu Goo gezogen werden. Bei verletzten/überfüllten Farmern bleibt die Bedingung bewusst unerfüllt. Anschließend wieder Phase 01 laden und die Rückkehr zu Goo prüfen.
3. **Pause/Resume/Reload:** Bei `pending: 0`, `journal: null`, `inventoryBlocked: false` pausieren und wieder starten. Danach dasselbe Skript einmal neu laden, auch den Merchant. Keine doppelten Lieferungen und kein zweiter Scheduler. **Nicht mitten in einer offenen Wertaktion neu laden:** ein angehaltener ungeklärter Auftrag wäre die vorgesehene Schutzreaktion.
4. **Ein Merchant-Nebenauftrag, wenn die Voraussetzungen vorliegen:** Phase 03 laden. Merchant reist an einen aus `G.maps` abgeleiteten Angelplatz, legt Offhand ab, nutzt die Rod und startet Fishing. Er wartet auf `character.q.fishing`, stellt danach ursprüngliche Mainhand/Offhand wieder her und bleibt für Nachschub erreichbar. Ein laufender Fishing-Cooldown zählt nicht als neuer erfolgreicher Cast. Fehlt eine Rod oder die Spielbereitschaft, Phase 03 auslassen und dies ausdrücklich im Ergebnis nennen.
5. **Berichte sichern:** Nach jeder Phase und vor jedem Reload alle vier Testdateien in einen eigenen Ordner kopieren bzw. herunterladen. Browser: **Testlog speichern** oder `ALBot.exportTestReport()`. Headless: `test-logs/CHARAKTER/test-ausgeführtertest.json`; spätere Läufe überschreiben diese Datei. Phase und Umgebung müssen dem Dateisatz zugeordnet sein.

Browser fordert `performance_trick()` weiterhin beim Laden an. Headless verwendet kein Audio und kein Ingame-DOM-Panel. Die Clientausgabe zeigt nach Neustart keine `[Charaktername]`-Präfixe mehr; Testberichte bleiben charakterbezogen.

## Woran der Lauf bewertet wird

- Farmen, Verbrauch, Wechsel und Gruppenbewegung entsprechen dem gewählten Profil.
- Benötigte Lieferungen erreichen `offer → accept → send → receipt → done`, mit beidseitig beobachteter Menge.
- Neue Welt-/Merchant-Arbeit erzeugt keine konkurrierende Inventaraktion und verdrängt Nachschub nicht dauerhaft.
- Ende ohne neue ungeklärte Wertaktion, offene Journale oder unerklärte Incidents; transiente `not_there`/`openning`-Zähler sind getrennt zu beurteilen.
- Pause beendet den Scheduler; Resume/Reload aktiviert genau eine Instanz.
- Fishing, sofern ausgeführt, mit beobachtetem Start und vollständigem Ausrüstungsrückwechsel.

Boss-/Eventreisen, Paladin, Magiport und Accountrotation sind implementierte, gezielt offline geprüfte Optionen, aber **durch diesen Vier-Ranger/Merchant-Termin nicht automatisch live bestätigt**. Das persönliche Paket lässt sie ausgeschaltet. Ihre Aktivierung benötigt passende Charaktere und explizite erlaubte Ziele. Ein Realmwechsel ist ausschließlich ein geprüfter Aufruf des Leaders, keine automatische Serverrunde.

## Grenzen der Etappe

Noch offen: versionsgebundener automatischer Updater, Teilentnahme eines zu großen Bankstapels, vollständige kontoübergreifende Kosten-/Gear-/Reiseoptimierung, langfristige Marktpreishistorie und Merrit-Bestätigung bei reinen Shell-Belohnungen. Eventplanung unterstützt aktuell Live-Einträge mit bekanntem Monster und konkreter öffentlicher Kartenposition. Diese Lücken sind in [INTEGRATIONSSTAND.md](INTEGRATIONSSTAND.md) und der Roadmap ausgewiesen. C ist eine Integrationsetappe, keine behauptete vollständige Freigabe aller Vorgängerfunktionen.
