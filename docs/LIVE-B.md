# Live B – Merchant-Kette, 0.2.2-live-b

Stand 7. Oktober 2026. `0.2.2-live-b` korrigiert den in Schritt 04 beobachteten Liefer-Handshake: ein Offer, das der Empfänger wegen einer kurz belegten Inventarressource oder noch nicht frischer Nähe nicht sofort annehmen kann, wird mit derselben ID innerhalb der bestehenden kurzen Frist erneut gesendet. Zusätzlich wird ein verbrauchter +0-Produktionsinput nicht wieder nachgekauft, sobald das konfigurierte +1-Ziel bereits vorhanden ist. Schritte 01–03 sind im Browser bestanden; Schritt 04 muss mit diesem Kandidaten wiederholt werden. Autostart ist standardmäßig **true**. Browser fordert immer `performance_trick()` an; Headless verwendet lokale IPC, wenn verfügbar.

## Testdateien erzeugen

Mit Node ab 22.9 im Repository:

```powershell
npm.cmd run build
node scripts/export-live-b.mjs profiles/live-a-my-team.json Live-B-Ausgabe
```

Der Ausgabeordner muss neu sein. Das Skript übernimmt das Live-A-Profil einschließlich Namen, Realm, Farmziel und Trankregeln. Es ergänzt vier kleine Testprofile samt fertiger `.js`-Datei und aktuellem Werkstattpaket. Für andere Teams ein eigenes Live-A-Profil angeben. Bei jedem Schritt verwenden **alle vier Charaktere dieselbe jeweilige JS-Datei**. Die Dateien funktionieren unverändert in Browser-CODE und Headless.

In der Werkstatt zuerst `albot.package.json` über **Bot-Paket / Schema laden**, anschließend die passende Profil-JSON über **Profil öffnen** laden. Dann ist **Fertige bot.js exportieren** verfügbar. Ein Live-A-Profil muss zuerst mit dem obigen Skript erweitert werden; Schema-IDs nicht von Hand umbenennen.

## Vorbereitung

- Vier aktive Charaktere, normaler Goo-Betrieb und bestehender Trankvorrat. Die bisherigen Nachschubregeln bleiben erhalten.
- Merchant benötigt mehr als seine 100.000 Gold Reserve, mindestens fünf freie Inventarplätze und einen freien Platz in `items0`.
- Für die nachvollziehbare Kette zunächst keine `gslime` im Merchant-Inventar; ein Farmer muss mindestens zwei besitzen oder sammeln. Andere `gslime`-Bankstapel dürfen vorhanden sein, aber die Entnahme sucht ausschließlich einen Stapel bis zwei Stück.
- Vor Schritt 04: ausschließlich einen gewöhnlichen ungesperrten Testhelm +0 oder keinen Helm im Merchant-Inventar; andere Helme sperren/einlagern. Der erste Farmer darf noch keinen Helm +1 im Inventar haben. Ausgerüstete Helme werden nicht versendet und nicht ersetzt.
- Nicht denselben Charakter gleichzeitig im Browser und Headless anmelden. Kein automatischer Login wurde zur Vorbereitung durchgeführt.

## Ein Testtermin, vier kleine Schritte

| Datei | Erwartete Aktionen | Grenze / Erfolg |
|---|---|---|
| `01-abholung.js` | Farmer liefert `gslime` an Merchant | Merchant erhält insgesamt zwei Stück; Sender und Empfänger melden `confirmed` |
| `02-bank.js` | Merchant fährt zur Bank und lagert den Teststapel in `items0` ein | Eine Einlagerung, maximal zwei Stück; keine weitere Abholung |
| `03-bank-npc.js` | Den kleinen Stapel entnehmen und beim NPC verkaufen | Je eine Entnahme und ein Verkauf, maximal zwei Stück; Bank-/Inventaränderung und Goldzuwachs |
| `04-upgrade-lieferung.js` | Fehlenden Helm +0 / `scroll0` mit Gold kaufen, Chance prüfen, einmal auf +1 versuchen und bei Erfolg an den ersten Farmer liefern | Höchstens ein Kauf je Regel und ein Upgradeversuch; Lieferung wird beidseitig bestätigt; keine automatische Ausrüstung |

Die Käufe sind auf 3.200 Gold für `helmet` und 1.000 Gold für `scroll0` begrenzt, zusammen höchstens 4.200 Gold. Die globale Ausgabengrenze beträgt 10.000 Gold/Stunde; vorhandene Budgets aus früheren Läufen gelten weiter. Höchstens 5.000 Gold geschätzter Itemwert dürfen dem Upgrade ausgesetzt werden. Mindestchance 95 Prozent, keine Erfolgsgarantie: ein beobachteter Fehlschlag bestätigt die Aktion, erfüllt aber noch keine erfolgreiche Verarbeitung/Lieferung. Bei veränderten Spielpreisen oder geringerer Chance wartet der Bot und meldet den Grund.

Nach jedem Schritt erst warten, bis `ALBot.status().pending === 0` und `journal === null`. Dann `ALBot.stop()` auf allen Charakteren, Testberichte sichern und die nächste Datei laden. `maxActions: 1` bleibt bei Pause/Start erhalten, wird beim **Neuladen des Codes** zurückgesetzt. Kein Schritt darf allein zum erneuten Auslösen mehrfach geladen werden. Schritt 03 nicht neu laden, nachdem der Stapel verkauft wurde. Die Stunden-/Verlustbudgets bleiben über einen Reload erhalten.

Eine normale Übergabe einmal vor ihrem Beginn oder nach ihrem bestätigten Abschluss durch Stop/Neuladen unterbrechen. Kein erzwungener Kill mitten in einer Wertaktion nötig. Wenn eine Aktion ungeklärt bleibt: stoppen, reale Bestände prüfen und Log senden. `ALBot.acknowledgeInventory()` nur nach tatsächlichem Abgleich verwenden; nicht automatisch ausführen lassen.

## Headless starten

Der vorhandene Client liest ausschließlich seine `config.json`; er hat keinen `--config`-Schalter. Nach Stoppen des Clients eine Sicherung anlegen und bei den vier aktiven Einträgen beispielsweise setzen:

```json
"script": "./CODE/albot-live-b/01-abholung.js"
```

Danach `npm.cmd run check` und `npm.cmd start`. Bei Folgeschritten den Dateinamen in allen vier Einträgen ändern. Unter Linux entsprechend `npm run check` / `npm start`. `CODE/main.js` und die aktive `config.json` werden vom Exportskript nicht überschrieben. Zur Rückkehr zur bisherigen Version die gesicherte Clientkonfiguration wieder einsetzen.

Im Browser den gesamten Inhalt der jeweiligen `.js`-Datei in CODE einfügen und ausführen; kein Loader und kein zusätzliches Runtime-Skript nötig. Wegen Autostart beginnen freigegebene Aktionen sofort.

## Testberichte und Bewertung

Browser: **Testlog speichern**, alternativ `ALBot.exportTestReport()`. Headless: `test-logs/CHARAKTER/test-ausgeführtertest.json`. Vor dem nächsten Schritt alle vier Dateien in einen Ordner mit Schrittnamen kopieren, da der Client diese Dateinamen wiederverwendet. Berichte enthalten Profilname, Version, Umgebung, Economy-Budget, Produktionsschritte, Inventar, `actionStats`, begrenzte Ereignisse und Fehler.

Bestanden ist die Kette erst mit beobachteter Abholung, Bankänderungen, NPC-Verkauf, günstiger Verarbeitung und bestätigter Lieferung. Browser: Schritt 01 bestand mit 0.2.0; 0.2.1 korrigierte den Merchant-Loot/Bank-Starvation-Fehler und bestand danach Schritt 02 sowie Schritt 03. Schritt 04 bestätigte Preview/Upgrade und einen Kauf, erreichte aber nur `offer`/Empfang ohne `accept`; der Sender lief in einen Timeout. 0.2.2 wiederholt unbestätigte Offers mit derselben ID und verhindert das Nachkaufen des +0-Inputs nach erfülltem +1-Ziel. Nur Schritt 04 erneut ausführen. `returned` beziehungsweise ein erfülltes Promise genügt bei Wertaktionen nicht. Die 46 Offlineprüfungen sind gezielte Funktions-/Grenztests, keine Shadow-Tests und kein Live-Nachweis. Der neue Lauf kann zunächst headless erfolgen; Browserkompatibilität der neuen Bank-/Produktionsaktionen bleibt bis zu einer realen Browserausführung offen.

## Umfang und bekannte Grenzen

Implementiert: getrennte Erwerbs-/Inventar-/Produktionsregeln, NPC-Kauf mit Gold, Verkauf, Bankeinlagerung mit Stackteilung, begrenzte Entnahme ganzer Stapel, Bankgold bei Bankbesuchen, Zusammenlegen/Erweiterungsbudget, Listings/Kaufgesuche/sichtbare Marktangebote, Mluck, Produktionsbuffs, Upgrade/Compound mit Chanceabfrage, gewöhnliches Craft/Exchange, begrenzter Abhängigkeitsplan, explizite Materialaufträge und einfache Gear-Bewertung. Nicht jede dieser Funktionen ist Teil dieses Live-Szenarios oder bereits live geprüft.

Noch offen: Fishing/Mining mit vollständigem Werkzeugrückwechsel, Merrit, Ponty, faire langfristige Aufgabenplanung, bessere empirische Kosten-/Farmzeitoptimierung, vollständige accountweite Produktions-/Gear-Ziele, P5-Weltfunktionen und Live C. Diese Einstellungen werden im Kandidaten nicht als fertig unterstützt beworben; die vollständige Werkstatt behält ihren geplanten Vertrag. P3/P4 sind deshalb **teilweise implementiert**, nicht pauschal abgeschlossen.

Bankentnahmen teilen keine großen Bankstapel: überschreitet der Stapel Bedarf, Batch oder Höchstbestand, wird er nicht entnommen. Marktvergleich verwendet nur sichtbare passende Angebote. Farmzeitplanung verwendet eine grobe feste Schätzung von 20 Kills/Stunde und nur ausdrücklich erlaubte Monster; sie ist keine gemessene Prognose. Produktionsziele beschreiben wiederkehrenden lokalen Zielbestand, keine dauerhafte Erledigung pro Empfänger. Jede Teilaktion benötigt weiterhin eine explizite passende Item-Regel; Zustellung erfolgt über `send` plus Empfängerbedarf. Offline-Gearprofile liefern Vorschläge, keine Aktionen auf ausgeloggten Charakteren.
