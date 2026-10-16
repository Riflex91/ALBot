# Browser-Charakterwechsel: Untersuchung und Korrektur

## Integration vom 16.10.2026

Der ursprüngliche Commit `1f06f0b` im lokalen Branch `codex/browser-rotation-fix-20261015` war nicht auf GitHub veröffentlicht. Seine Quelländerungen und acht Regressionstests wurden auf `47095a9` (Main einschließlich PR #110) übertragen; aktuelle Runtime, Werkstatt und persönliche bot.js wurden neu gebaut, ohne die persönliche Konfiguration zu ändern. 904/904 lokale Offlinetests bestanden. Die folgenden 826 Tests beschreiben ausschließlich den ursprünglichen Stand. Der neue Integrations-PR und dessen Merge sind die öffentlich nachvollziehbare Referenz; der alte lokale Hash ist keine Voraussetzung zum Prüfen der Implementierung. Ein tatsächlicher Charakterwechsel im Spiel bleibt noch zu testen.

Basis: main `faf0f50` (PR #93), 15.10.2026. Nutzer betreibt jeden Farmer in einem separaten Tab/Fenster. Kein Live-Wechsel ausgeführt; die konkrete Ursache seines ausgebliebenen Wechsels ist ohne Ereignisprotokoll nicht abschließend bestimmt.

## Quellen und Abgrenzung

- Earthiverse verwendet in `source/achievementFarmer.ts` AL.Game.startCharacter und in `source/strategy_pattern/context.ts` ALClient-Verbindungen/Disconnects. Das ist Node-/Headless-Code, keine tabübergreifende Browsersteuerung. Untersuchte Revision: https://github.com/earthiverse/adventureland-bots/tree/63b9e23c56d96cc59ecd27f7da2344f508105290
- Öffentlicher Browserstarter: https://gist.github.com/iandjx/92cb712ea122944f2069759f80b32481 — startet Farmer mit `parent.start_character_runner(farmer, code_name)`. Das ist ein Beispiel für Child-Runner, kein geprüfter Ersatz für separate Tabs.
- Offizieller Browsercode: https://github.com/kaansoral/adventureland_mongodb/blob/main/js/functions.js (`start_character_runner`, `stop_character_runner`, `code_persistence_logic`). Start erzeugt ein Child-iframe, Stop entfernt dessen Element im eigenen Dokument; fremde Tabs werden so nicht geschlossen.
- Offizielle CODE-Funktionen: https://github.com/kaansoral/adventureland_mongodb/blob/main/js/runner_functions.js (`get_active_code_slot`, `get_edited_code_slot`, `upload_code`). Laufender Slot und Editor-Slot sind ausdrücklich verschieden.
- Dokumentation: https://adventure.land/docs/guide/multi

## Bestätigte Codefehler im untersuchten ALBot

1. Der Wechsel las den veränderlichen Editor-Slot `parent.code_slot` statt den Slot des laufenden Runners. Beim Öffnen eines anderen Editor-Slots konnte der Ersatzfarmer falschen Code laden.
2. `code_persistence_logic()` kehrt bei `explicit_slot` ohne Ergebnis zurück. ALBot akzeptierte dieses `undefined` als Speicherbestätigung. Die Funktion garantiert dort keine Speicherung des laufenden Bots.

## Änderung

`src/runtime/ports.mjs` bindet beim Erzeugen des Ports den aktiven Slot über `get_active_code_slot()` und den laufenden Quelltext aus `parent.the_code`. Beim Wechsel wartet es zunächst auf eine laufende Editor-Speicherung und sichert dann über die offizielle `upload_code`-Funktion den tatsächlich laufenden Code in seinem ursprünglichen Slot. Ein nur im Editor geöffneter anderer Slot wird dabei nicht gespeichert oder ausgewählt. Der bisherige Inhalt des aktiven Slots wird durch den laufenden Bot ersetzt; das ist Teil der Fortsetzung desselben Bots beim Ersatzcharakter.

Die Editor-Persistenz bleibt nur als kompatibler Rückfall bei unverändertem, nicht explizitem Slot verfügbar. Unbestätigte Ergebnisse verhindern den Disconnect. Nach jedem asynchronen Schritt werden Freigabe und Zielverfügbarkeit erneut geprüft. Der neue Ablehnungsgrund `running-code-save-unavailable` wird vom Accountkoordinator als beendeter Versuch behandelt.

Die bestehende gleiche-Tab-Navigation, Realmwahl, Checkpoints, Sitzungsbindung und Incoming-Heartbeat-Bestätigung bleiben bestehen. Keine zusätzlichen Merchant-Child-Fenster, keine Änderung der Headless-Lifecycle-API und keine Lockerung von Kampf-/Inventarsperren.

## Abnahme

- Acht neue Regressionstests für aktiven/editierten Slot, expliziten Slot, fehlende Speicherbestätigung, Savefehler, späte Promise, laufenden Editorsave, bereits online gegangenes Ziel und Headless-Abgrenzung.
- 826/826 Offline-Tests bestanden; Runtime und Werkstatt gebaut; persönliche bot.js mit unveränderter Konfiguration synchronisiert und Parität geprüft.
- Kein echter Disconnect, Charakterstart, CODE-Upload oder Cloud-Deployment durchgeführt.

## Verwendung und noch offener Live-Test

1. Aktualisierte bot.js im verwendeten CODE-Slot speichern und auf Merchant und aktiven Farmern neu starten. Gemeinsame aktuelle Runtime auf allen Teilnehmern verwenden.
2. Separaten Browser-Tab pro Farmer beibehalten. Der eintretende Farmer darf nicht bereits anderswo online sein.
3. Der bestehende Levelausgleich verlangt belegten Rückstand und Mindesthaltezeit (üblicherweise 30 Minuten). Partybesitzer/feste Mitglieder und aktive Kämpfe beziehungsweise Inventartransaktionen können einen Wechsel verhindern. Dies wurde nicht gelockert.
4. Erwartete Nachweiskette: `account.rotation` → Wechselauftrag/Zusage → alter Farmer-Tab navigiert zum neuen Charakter → passender Incoming-Heartbeat → `account.team` → `account.party-joined` → `account.group-arrived`.
5. Falls kein Wechsel erfolgt: `ALBot.status()` und Testbericht einschließlich `accountChoice`, `account.swap-rejected`, `account.rotation`, `action.end` für `account.switch-window` prüfen. Ein fehlender Versuch, ein abgelehnter Versuch und ein fehlgeschlagener Neustart sind getrennte Probleme.

Nicht behaupten, dass diese Offlinekorrekturen sämtliche Ursachen des Nutzerproblems beseitigen. Insbesondere Navigation, Spielserver-Reconnect und das Fortsetzen des neuen CODE-Kontexts benötigen noch einen echten Browserlauf.
