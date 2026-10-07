# Merchant-Ergänzungen · 0.4.0-merchant

Live A/B/C bleiben mit ihren bestätigten Versionen dokumentiert. Dieser Folgeauftrag schließt zwei konkrete P3/P4-Lücken. Neue Abläufe sind gezielt offline geprüft, noch nicht live bestätigt. Kein neuer kompletter A/B/C-Testplan und keine Shadow-Phase.

## Teilentnahme aus Bankstapeln

Das Spiel bietet für `bank_retrieve(pack, slot, dest)` keine Teilmengenangabe. Bei eingeschalteter `merchant.partialBank` kann der Merchant deshalb einen größeren Stapel vorübergehend entnehmen, die gewünschte Menge im Inventar abteilen und den Rest in das ursprüngliche Bankfeld zurücklagern. `merchant.partialBankMaxStack` begrenzt den vorübergehenden Stapel; Standard 9999. Die Funktion ist standardmäßig **ausgeschaltet**. Die Aktivierung erlaubt ausschließlich während dieser gebundenen Bankoperation einen temporären Bestand oberhalb der Itemregel-Höchstmenge. Danach gilt wieder deren `maxCount`.

Die gewünschte Menge ist auf Bedarf, `batch` und verbleibenden Höchstbestand begrenzt. Zwei zusätzliche freie Slots oberhalb `minFreeSlots` sind nötig. Passende ganze kleinere Stapel haben Vorrang; gesperrte/gebundene/falsche Varianten werden nicht angefasst. Ein gespeicherter Zwischenstand bindet Item, Slots, Bankfach und Mengen. Jede tatsächliche Mutation wird über das bestehende Wertjournal und beidseitig beobachtete Bestände bestätigt. Mehrere bestätigte Teilschritte zählen als ein Regelauftrag.

Bis zum Abschluss sind Versand/Annahme, Verbrauch des Arbeitsbestands, Verkauf, Produktion und sonstige Economy-Mutationen blockiert. Rotation und Realmwechsel erkennen die offene Bankarbeit ebenfalls als unsicheren Zustand. Eine bereits begonnene Rücklagerung bleibt auch beim Ausschalten neuer Bankaufträge notwendig. Pause bleibt Pause; nach Start/Reload wird zuerst die Rücklagerung fortgesetzt. **Nicht während einer offenen Wertmutation neu laden.** Ein unbekanntes Ergebnis erfordert weiterhin manuellen Bestandsabgleich; es wird nicht automatisch erneut entnommen. Veränderte Slots oder Mengen sperren den Ablauf, statt die Abweichung zu kaschieren.

Speicherschlüssel: `albot:bank-partial:NAME`. Nicht blind löschen. Bei einer Abweichung pausieren, Live-Inventar und Bank kontrollieren, den Rest gegebenenfalls selbst zurücklagern und erst nach Abgleich den eigenen Zwischenstand korrigieren. `acknowledgeInventory()` löscht diesen Zwischenstand nicht. Der Testbericht enthält `bankPartial` und das Abschlussereignis `bank.partial.complete`.

## Merrit-Bestätigung

Merrit erkennt weiterhin zusätzliche `marketparcel`-Bestände. Außerdem akzeptiert es ein eigenes offizielles `character.on('merrit', …)`-Ereignis mit positivem Shell-Ertrag oder eine neue, namensgebundene Merrit-Receipt. Listener werden bei Dispose/Reload entfernt. Alte/fremde Receipts und beliebige Änderungen von `character.cash` gelten nicht als eigene Belohnung. Ohne passende Event-/Receipt-Fähigkeit bleibt der Inventarabgleich verfügbar.

Der Cooldown wird vor Abschluss gespeichert. `services.merritReward` nennt Quelle, beobachtete Shells und Parcel-Abgleich. Das zulässige Marktangebot wird genauer geprüft: reales Item, Preis/Menge, keine Placeholder-/Giveaway-/ungültigen Angebote, bei Kaufgesuchen ausreichendes Gold. Ein Shell-Ertrag wird nicht garantiert; er hängt vom Spiel ab.

## Persönliche Dateien und gezielter Ergänzungstest

`scripts/export-merchant.mjs <C-Profil.json> <neuer Ausgabeordner>` erzeugt drei Dateien samt Profilen und Paket. Bestehende Einstellungen bleiben im Normalprofil erhalten; Autostart ist true. Die beiden Testprofile verändern nur ihre ausdrücklich beschriebenen Testaufträge und schalten konkurrierende neue Nebenaufgaben ab. Bestehende Merchant-Regeln für das Beispielitem `gslime` führen zu einer Fehlermeldung, nicht zu einem stillen Überschreiben.

| Datei | Vorbereitung und Erwartung |
|---|---|
| `bot.js` | Normalbetrieb mit übernommenem Profil und neuer Runtime. Neue Bankoption bleibt entsprechend dem übernommenen Profil aus. |
| `bank-teilentnahme.js` | Merchant hat kein `gslime` im Inventar, `items0` enthält einen ungesperrten Stapel mit mindestens 2 und höchstens 9999 Stück. Mindestens `minFreeSlots + 2` freie Plätze. Eine Regel entnimmt genau 1 Stück; kein Kauf/Verkauf. Danach besitzt Merchant 1 Stück, Bankstapel ist um 1 kleiner, `bankPartial: null`, `journal: null`, `inventoryBlocked: false`. |
| `merrit.js` | Merchant besitzt dieses 1 `gslime`, ein Stand-Item und einen freien `trade1`-Slot. Die ausdrückliche Testregel stellt einmal 1 Stück für 10.000 Gold in den Stand. Merrit sucht einen freien erlaubten Marktstandplatz und wartet auf eine tatsächliche Belohnung. Ein Verkauf ist möglich; es wird nichts zurückgekauft. Ein aktiver Spiel-Cooldown oder fehlende Voraussetzungen zählen nicht als Belohnungsnachweis. |

Die identische Datei pro Phase auf alle vier eigenen Charaktere laden. Farmer behalten die bestehenden Farm-/Trankregeln. Keine parallele Browser-/Headless-Anmeldung desselben Charakters. Für den Bankablauf reicht ein kurzer Lauf; für Merrit die tatsächliche Spielbereitschaft und Haltezeit beachten. Kein absichtlicher Abbruch einer ungeklärten Mutation. Nach bestätigtem Abschluss optional Pause/Start bzw. Reload prüfen. Vor jedem Phasenwechsel die vier Berichte sichern. Es ist derselbe kleine Ergänzungsablauf in Browser und Headless, kein erneuter Test aller bereits bestätigten Funktionen.

Danach `bot.js` bzw. den zuvor bestätigten Live-C-Code laden. Ein bestehendes Testlisting wird dadurch nicht automatisch entfernt; bei Bedarf im Spiel selbst schließen/entfernen. Der vorherige Live-C-Ordner und die aktive Clientkonfiguration bleiben erhalten. `dist/albot-live-c.package.json` archiviert das bestätigte Paket 0.3.1.

## Verifikation und nächste offene Arbeiten

70 gezielte Prüfungen bestanden: vollständige Bankkette mit Reload zwischen bestätigten Schritten, Blockierung anderer Mutationen, Höchstmenge und Aktionszähler, deaktivierte/zu große/geschützte Stapel, unbekanntes Ergebnis und veränderte Bestände; Shell-Event und neue Receipt, keine Cash-Heuristik; alte C-Profile und Listener-Cleanup. Dazu bestehende Regressionen, Syntax, Paket-Hash und Exportgrößen. Persönliche Dateien: 180.416 bis 180.627 UTF-8-Bytes. Runtime mit 1.276 Regeln für alle 638 Katalogitems: 388.835 Bytes, unter dem 900-KiB-Entwicklungsziel und dem harten 1.048.576-Byte-Limit. Unter Windows ausgeführt, kein Linux- oder zusätzlicher Live-Nachweis.

Weiter offen: versionsgebundener optionaler Updater, vollständige accountweite Gear-/Beschaffungsoptimierung, längerfristige Markt-/Reise-/Teambewertung und endgültige Gesamtfreigabe. Die [Übernahmematrix](INTEGRATIONSSTAND.md) bleibt maßgeblich; diese Ergänzung erklärt die beiden behandelten Lücken, nicht einen bereits vollständig fertigen Super-Bot.
