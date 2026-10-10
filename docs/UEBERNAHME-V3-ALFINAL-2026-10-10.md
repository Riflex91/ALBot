# KI-Arbeitsübergabe: gezielte Übernahmen aus v3 und ALFinal

Stand 10. Oktober 2026. Nutzerauftrag: die geprüften Übernahmeempfehlungen im Repository so festhalten, dass eine andere KI daran weiterarbeiten kann. Diese Änderung dokumentiert Arbeit; sie implementiert keine Botfunktion und erteilt keinen neuen Auftrag zum Login oder Deployment. Einstieg für die nächste Implementierung: U01 und U02.

## Aufgaben und Status

**Arbeitsbranch (noch nicht in main):** U01–U06 sind implementiert und automatisiert getestet, U07 ist als sichere, begrenzte Anbindung der offiziellen Progression-API implementiert. GitHub Actions hat `npm test`, `npm run build`, `npm run build:editor` und Bundle-Integrität unter Linux bestanden; unter Windows hat `scripts/VERIFY-U01-U07.ps1` denselben erfolgreichen Prüfumfang bestätigt. **Je Plattform 238/238 Tests, 288.474 Bytes und identischer SHA-256.** Browser-/eigene Headless-API-Verfügbarkeit und die gemeinsame echte Spiel-Livebestätigung stehen aus. Die Nummern bezeichnen neue Restbefunde nach 0.8.4, nicht eine Wiedereröffnung sämtlicher alter Paritätsaufgaben. Vor Beginn aktuellen Branch/Commit und zwischenzeitliche Änderungen prüfen; Audit-Commitstände unten sind die Vergleichsbasis.

| ID | Reihenfolge | Aufgabe | Betroffene ALBot-Module | Stand im Arbeitsbranch |
|---|---|---|---|
| U01 | 1 | Gewählte Farmzeitmetrik durchgehend für Filter, Rangfolge, Routenkosten und Ziele verwenden | src/production/materials.mjs, production.mjs, planner.mjs; Aufrufer in src/world/team-plan.mjs prüfen | Implementiert; gezielter Offline-Nachweis, vollständiger Build und Live ausstehend |
| U02 | 1 | Quest-/Event-Exchange an verifizierte Quelle und NPC binden; bei fehlendem Ziel warten | src/production/production.mjs, planner.mjs, materials.mjs; src/merchant/economy.mjs | Implementiert; gezielter Offline-Nachweis, vollständiger Build und Live ausstehend |
| U03 | 2 | Merchant-Speed und Survival-/Rollenbedingungen vor Gear-Score berücksichtigen | src/production/gear.mjs, intelligence.mjs, allocation.mjs | Implementiert; gezielt offline geprüft, Build/Live offen |
| U04 | 2 | Mengenbegrenzte, aktuelle und variantengenaue Kaufgebote in Produktionsökonomie integrieren | src/production/intelligence.mjs; src/merchant/market.mjs, economy.mjs | Implementiert; gezielt offline geprüft, Build/Live offen |
| U05 | 3 | Accountweite konservative Risikoschicht ergänzen, bestehende harte Budgets erhalten | src/party/account.mjs; src/merchant/economy.mjs; src/production/production.mjs, intelligence.mjs | Implementiert; gezielt offline geprüft, Build/Live offen |
| U06 | 3 | Paladin-Aura mit vorausschauender Gefahr-/Überlebensbewertung ergänzen | src/party/aura.mjs; geeignete Risikosignale aus src/combat anbinden | Implementiert; gezielt offline geprüft, Build/Live offen |
| U07 | 2, nach U01/U02 | Offizielles get_progression() als zusätzliche Entscheidungsquelle integrieren | src/runtime/ports.mjs; src/world/strategy.mjs, team-plan.mjs; src/production/intelligence.mjs, production.mjs; src/party/account.mjs | API-Fallback und Planungs-Tie-Breaker implementiert; eigener Headless-/Browsernachweis offen |

Bei neuen Optionen den bestehenden Konfigurations-/Werkstattvertrag erweitern: editor/lib/schema.mjs, editor/lib/contract.mjs und src/config/full.mjs auf die konkrete Änderung prüfen. Keine wirkungslosen Felder oder still geänderten Profilwerte ausliefern. Die Tabelle nennt Einstiegspunkte, keinen Auftrag, jede Datei zu verändern.

## Stand U01/U02 im Arbeitsbranch (10. Oktober 2026)

- **U01 implementiert:** `materialSources` liefert `selectedHours` und sortiert nach der gewählten Mean-/P90-Metrik. `production.routeScore` nutzt denselben Wert für Beschaffungskosten, statt P90 nach dem Filter durch den Mittelwert zu ersetzen. Beobachtetes Testbeispiel: Mean bevorzugt `uncertain`, P90 bevorzugt `steady`.
- **U02 implementiert:** `exchangeSource` verlangt für questgebundene Tauschmaterialien belegbare `G.quests`-Koordinaten oder eine passende NPC-/Map-Zuordnung. Eventquellen brauchen einen eindeutigen Eventschlüssel und aktiven `S`-Status. Planner und Routenbewertung schließen unbestätigte Quellen aus; die Ausführung prüft dieselbe Quellenidentität, NPC-Koordinaten und Eventaktivität erneut vor dem Dispatch. Gewöhnliche Exchanges bleiben erlaubt.
- **Gezielt offline geprüft (ohne Spielkontakt):** 11 direkte Quellmodulprüfungen über den aktuellen Branchcode (Metrik, Route, Quest-/Event-Zuordnung und Ablauf) bestanden; zusätzlicher Aufruf der echten `createProduction.exchange`-Funktion mit kontrolliertem Runtime-Port bestätigte das Abweisen eines nachträglich inaktiven Events oder entfernten NPCs. Syntaxkompilierung der fünf geänderten Module/Tests über V8 bestanden. Vier Regressionstests wurden in `test/parity.test.mjs` ergänzt, aber **nicht** mit `node --test` ausgeführt.
- **Nicht ausgeführt:** `npm test`, `npm run build`, `npm run build:editor`, Größenprüfung des neu gebauten Artefakts, Windows-/Linux- und Browser-/Headless-Livetest. `main` und verteilte Dist-/Persönlich-Artefakte unverändert. Keine Nutzerprofile, Reservierungen, Journale oder Budgets gelöscht oder geändert.
- **Folgearbeiten:** U03–U07 wurden im Arbeitsbranch ergänzt. Vor Auslieferung sind die vollständigen Build-, Test- und Live-Nachweise zwingend; ältere Hinweise bleiben historische Etappennotizen.

## Fortsetzung U03/U04 im Arbeitsbranch (10. Oktober 2026)

- **U03 implementiert (nicht in main):** `merchantMobility` ist im Full-Config-Schema als Additivfeld mit Default `mobile` vorhanden; `stationary` erlaubt ausdrücklich gearbedingte Speedverluste bei stationären Handelsprofilen. `gearSuitability` sperrt Speedverlust mobiler Merchants unabhängig vom Luck-Score und schützt rollenspezifische Überlebenswerte. Der Check wirkt in automatischen Gearzielen, Gear-Vorschlägen, Ausrüstung und Empfängerzusage sowie unmittelbar vor Equip-Dispatch.
- **U04 implementiert (nicht in main):** `market.liveBids` zählt ausschließlich aktuell sichtbare, erreichbare aktive Kaufgebote gleicher Itemvariante einschließlich `acc` und `data` und begrenzt auf die angebotene Menge. `market.bidValuation` nutzt NPC-Basiswert für unverkaufte Menge, kalkuliert Wegkosten und zieht 75 % des beobachteten Mehrwerts für zukünftige Produktion ab (20 % Abschlag für unmittelbar verfügbare Gebote). `intelligence.mutationEconomics` berücksichtigt diese konservative Erlösschätzung; automatisch erzeugte Verkäufe prüfen zunächst lebende Kaufgebote und fallen andernfalls auf NPC-Verkauf zurück. Explizite NPC-Verkaufsregeln bleiben unverändert. Die vorhandene `market.sellToBid`-Ausführungsprüfung wurde um Varianten-, Menge- und Standortprüfungen verstärkt; gemischte geschützte/abweichende Bestände bleiben gesperrt.
- **Gezielte Offline-Nachweise:** V8-Syntaxkompilierung der geänderten U03-/U04-JS-Module und Regressionstestdatei erfolgreich; U03-Speed-/Stationär-/Überlebens- und Equip-Guard-Szenarien anhand tatsächlich aus dem Branch geladener Funktionen geprüft. U04 Mengenlimit/Premium-Abschlag, exakter Variantenschlüssel, NPC-Rückfall bei verschwundenen Angeboten, geänderte Menge/Variante/Map vor einem `trade_sell`, sowie `mutationEconomics` mit und ohne Gebot offline geprüft.
- **Sechs zusätzliche Regressionstests** für U03/U04 in `test/parity.test.mjs` ergänzt. **Nicht ausgeführt:** Node-Testsuite (`npm test`), npm-Build und Editor-Build, neues Browser-/Headless-Bundle und echte Spiel-/Linux-Prüfung. Container hat keinen direkten GitHub-Netzwerkzugang; keine vollständige lokale Arbeitskopie, deshalb keine vollständigen npm-Kommandos behaupten.
- **Anschließend im Arbeitsbranch implementiert:** U05/U06 sowie die begrenzte U07-Anbindung. Vollständige Build-/Paket- und Liveabnahme bleiben offen. Keine Login-, Deployment-, Budget-, Journal- oder Main-Mutation.

## Fortsetzung U05/U06/U07 im Arbeitsbranch (10. Oktober 2026)

**U05 – zusätzliche accountweite Risikoschicht (implementiert; Live offen):** `src/party/account.mjs` wertet frische Gold-Balances der konfigurierten Teammitglieder und den Merchant-Bankgoldwert aus. Jede Charaktersitzung zählt einmal, Peers mit ungeklärtem Journal oder reservierter Logistik werden nicht als sicherer Kontonachweis herangezogen. Unvollständige Daten erzwingen den konservativen Modus; dessen Limit basiert ausschließlich auf einem bekannten Liquiditäts-Mindestwert, nicht auf vermuteten Items. Schwellen für Eintritt/Austritt in den Normalmodus sind relativ zum bestehenden `production.lossBudget` und besitzen Hysterese. Die additive Auto-Policy prüft in `merchant/economy.mjs` **kumulierte** persistierte Stundenexposition aus Kosten und Verlusten, bevor automatisch erzeugte Produktions- oder Dispositionsaktionen gesendet werden. Explizite Regeln und bisherige Budgetgrenzen werden nicht gelockert. Unbekannte oder über dem bestehenden Verlustbudget bewertete Items werden nicht automatisch mutiert. Nicht behauptet: atomarer kontoübergreifender Gold-Snapshot oder Bewertung sämtlicher seltener Itembestände.

**U06 – vorausschauende Aura (implementiert; Live offen):** `party/aura.mjs` bewertet lebende Gegner mit tatsächlichem Ziel innerhalb des Teams und aktuelle Monsterdefinitionen. Drei Sekunden eingehende Attacke/Frequenz werden gegen aktuelle HP verglichen; unbekannte Werte schalten vorsorglich auf defensive Aura. Akute Defensive darf die normale Aura-Haltezeit übersteuern, bei kritischer magischer Gefahr auch eine physische Defensive. Ohne Ziel/Bedrohung wird neu bewertet, kein dauerhafter unbekannter Gefahrenmodus. Der gemeinsame Executor prüft die Auraentscheidung vor Dispatch erneut. Skilldefinitionen, Cooldown, Nutzerstopp und Journalsperre bleiben verbindlich.

**U07 – offizieller Progression Guide als begrenzter Berater (Branchimplementierung; echte API-Parität offen):** `runtime/ports.mjs` bevorzugt `parent.progression_read`, anschließend den offiziellen `get_progression`-Wrapper, sonst die bereitgestellte offizielle `ProgressionRuntime.create`-Factory (kein eigener Algorithmus). Beobachter werden bei Definitionswechsel bzw. Bot-Stop getrennt. `world/progression.mjs` liest höchstens alle 15 s / Planning-Tick nach explizitem Ziel und konservativ abgeleitetem `spendLimit`, mit `allowPvp:false`. Nur validierte, frische Farmrouten innerhalb der bereits erlaubten Monster/Karten beeinflussen sichere Teamplan-Rankings geringfügig; schon vorhandene Produktionsziele erhalten nur einen kleinen Tie-Breaker. `advice.plans` wird weder in Skriptbefehle noch automatische Käufe/Mutationen umgesetzt. Bei fehlender/werfender API läuft die bisherige Planung weiter. Im Full-Profil existiert die neue boolesche Werkstatteinstellung `production.progressionAdvice`. **Die offizielle Headless-Skriptladefolge und reale Funktionsverfügbarkeit sind nicht nachgewiesen**; eigene Headless-Kompatibilität nicht aus dokumentiertem Mainframe-Support ableiten. Kampfbeobachtung startet erst nach erfolgreicher API-Initialisierung; alte Kämpfe nicht als gemessen ausgeben.

**Tatsächlich ausgeführte Prüfungen:** 11 direkte Offline-Szenarien zur neuen U05/U06/U07-Risikologik und API-Lifecycle bestanden, weitere Funktionsproben mit direkt aus dem Branch geladenen `createAccount`, `createEconomy`, `createAura` und `createProgression` bestanden; V8-Syntaxkompilierung der elf geänderten JS-/Testquellen ohne Syntaxfehler. Insgesamt **21 neue Regressionstests** für U01–U07 in `test/parity.test.mjs` ergänzt, aber nicht mit Node `--test` gestartet. Das Skript `scripts/VERIFY-U01-U07.ps1` bietet die vollständige Offlineabnahme auf einem Windows-Klon an; **es wurde hier nicht ausgeführt**. Ein echter Windows-/Linux-Build, identisches neu gebautes Browser-/Headless-Artefakt und Spiel-Livetest fehlen weiterhin. Keine Logins, keine Deployment- oder Merge-Aktion, keine Änderung an Persönlich-Profilen oder bereits gespeicherten Wertjournalen.

**Vor PR-Freigabe:** `npm ci` falls nötig, `npm test`, `npm run build`, `npm run build:editor`, Bundle-/Byteprüfung und nachvollziehbarer Browser-/eigener Headless-Test mit aktualisiertem Full-Profil. Bei fehlenden offiziellen Headless-Progressionsskripten nur Fallback als bestätigt markieren; API-Verfügbarkeit, `rows/plans`-Version, Beobachter/Reload und Übereinstimmung im Browser separat belegen. U05–U07 gelten ausdrücklich **nicht als live abgenommen**.

## Verifizierte Build- und CI-Abnahme (10. Oktober 2026)

- **Linux und Windows:** Je 203/203 Node-/Werkstatt-/Runtimeprüfungen erfolgreich; keine Testfehler oder übersprungenen Tests. [Erfolgreicher gemeinsamer CI-Lauf](https://github.com/Riflex91/ALBot/actions/runs/38078224947).
- **Build:** `npm ci --ignore-scripts`, `npm run build`, `npm test`, `npm run build:editor` unter Linux. Windows: `npm ci --ignore-scripts` plus `scripts/VERIFY-U01-U07.ps1` inklusive der drei npm-Kommandos, Syntax und Integritätscheck.
- **Gemeinsames Artefakt:** `dist/albot.js`, genau **283.986 Bytes**; SHA-256 `c69e36ec8b9aab68bbe52c180fdfea5bb8543c63ceb050fdb3a375afa9c52e89` auf beiden Systemen; `dist/manifest.json` stimmt mit dem Bundle überein. Das harte 1.048.576-Byte-Limit bleibt unverändert. Neues `src/world/progression.mjs` ist jetzt ausdrücklich im klassischen Bundle enthalten; `src/runtime/ports.mjs` verwendet dieselbe Runtime für Browser/Headless.
- **Erzeugte Review-Dateien:** GitHub Actions archiviert einmal das gemeinsame Bundle, Runtime, Paket, Manifest, Werkstatt und generische Beispielprofile als herunterladbares, sieben Tage verfügbares Prüf-Artefakt. Es ist kein persönliches Full-Profil und kein Nachweis eines echten Spiel-Logins.
- **Korrekturen durch ersten roten CI-Lauf:** Alte Runtime-Fixtures verlangten einen frischen Build **vor** `npm test`; sonst prüften sie eine alte `dist`-Version und meldeten ungültige neue Felder. Ältere P3/P4-Fixtures besitzen optional kein `p.root`/`p.parent`; die neuen Source-Statuspfade verwenden darum sichere optionale Zugriffe. Ein historischer Dispositionsfall mit Verlustbudget Null darf weiterhin planen; tatsächliche Mutationen bleiben durch die bisherigen Budget- und Mindestchancen-Guards begrenzt.
- **Weiterhin nicht verifiziert:** reales Browser-/Windows-Headless-Spielverhalten und offizielle `get_progression()`-API-Verfügbarkeit auf der eigenen Headless-Plattform; eigene Gameplay-Wertaktionen, langfristige Kontorisiko-Hysterese unter echten Sessionwechseln, reale Quest-/Event-Exchanges. CI-Simulationen ersetzen keine Livetests.
- **Vorgehen:** PR #9 bleibt Draft und ungemergt; `main`, persönliche Einstellungen/Exporte und persistente Journale bleiben unangetastet. Keinen realen Login, Upload oder Betrieb als erfolgreich behaupten.

### Zusätzlicher U07-Runtime- und Wiederanlaufnachweis

Der Anschluss an die tatsächliche klassische Bundle-Ladefolge wurde mit sechs zusätzlichen Regressionstests vertieft (drei Policy-/Planungsprüfungen und drei komplette Runtime-Szenarien). Der offizielle Guide wird nun erst **nach erfolgreichem Start** initialisiert, nicht beim Laden eines pausierten CODE-Kontexts. `Pause` und `Stop` setzen Advice-Cache und eigene Beobachter zurück; anschließender Start initialisiert die Quelle **sofort**. Eine Empfehlung zählt nur mit `row.kind='farm'`, `action.kind='farm'`, explizitem `route.safe===true`, gültiger Karte/Monster-Freigabe, ohne `reasons` und ohne abgelaufenen Zeitstempel. Automatische Zielvorschläge bleiben durch bestehende sichere Teamziele begrenzt; nur bestätigte offizielle Item-Pläne können eine kleine Prioritätsabweichung auslösen.

**Nachweis:** [GitHub Actions 38078224947](https://github.com/Riflex91/ALBot/actions/runs/38078224947): **203/203 Tests unter Linux und Windows**, Build und Werkstatt erfolgreich, Shared Bundle **283.986 Bytes**, identischer SHA-256 `c69e36ec8b9aab68bbe52c180fdfea5bb8543c63ceb050fdb3a375afa9c52e89`. Der Test simuliert Browser-/Headless-CODE mit gültiger Guide-Antwort, fehlender offizieller API, dem Start/Pause/Neustart und Factory-Observer-Cleanup. Echte Spielserver, Player-API-Verfügbarkeit und Live-Gameplay bleiben **ungeprüft**.

### U05 Transferabschluss und U07 Realm-/Zeitvalidierung

- **U05:** `src/items/gold.mjs` hält den Zeitpunkt einer tatsächlichen oder möglicherweise stattgefundenen Goldübergabe fest. `src/party/transport.mjs` meldet `goldTransferPending` und `goldTransferAt` in Heartbeats; `src/party/account.mjs` schließt laufende sowie innerhalb von mindestens zwei Message-TTLs gerade abgeschlossene Übergaben vorübergehend vom nachgewiesenen Liquiditäts-Mindestwert aus. Das verhindert die Doppelzählung eines Betrags bei zeitlich versetzten Sender-/Empfänger-Heartbeats. Der Kontonachweis wird ggf. konservativer; Transfer-/Wertjournale werden nicht gelöscht.
- **U07:** Der Guide muss einen endlichen, höchstens zwei Minuten von der lokalen Zeit abweichenden `at`-Wert liefern. `advice.realm` muss im echten Runtime-Port dem aktiven Server entsprechen; der offizielle `EU II`-Stil und das ALBot-Kürzel `EUII` werden dabei normalisiert. Undatierte oder realm-fremde Empfehlungen bewirken keinen Farm-/Produktionsbonus; bestehende Scheduler-Fallbacks laufen weiter.
- **Abnahme:** [GitHub Actions 38078224947](https://github.com/Riflex91/ALBot/actions/runs/38078224947) hat unter Linux und Windows jeweils **203/203** Node-/Runtimeprüfungen bestanden, Runtime und Werkstatt erfolgreich gebaut, Byte- und Hash-Manifeste geprüft. Shared Bundle **283.986 Bytes**, SHA-256 `c69e36ec8b9aab68bbe52c180fdfea5bb8543c63ceb050fdb3a375afa9c52e89` auf beiden Plattformen. Echte Spieltests stehen weiterhin aus.

### U04 – serverseitige Inventarauswahl beim Live-Bid-Verkauf

Der [offizielle CODE-Wrapper `trade_sell`](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/js/runner_functions.js#L1258-L1263) bestätigt ausdrücklich, dass der Spielserver das verkaufte Item selbst aus dem Inventar wählt. Deshalb prüft `src/merchant/market.mjs` alle Inventarstapel mit dem passenden Itemnamen und Level. Jeder potenziell auswählbare Stapel muss dieselbe Variante einschließlich `acc`/`data` haben, ungesperrt und durch die zugehörigen Inventarregeln freigegeben sein und die komplette geplante Verkaufsmenge tragen können. Der Guard prüft dies erneut vor dem Dispatch; gesplittete oder geschützte Stapel blockieren den Verkauf. Nicht endliche Preise und Slots außerhalb `trade1` bis `trade16` werden ebenfalls abgewiesen.

**Abnahme:** Die zwei neuen U04-Regressionstests und alle bisherigen Tests ergeben **205/205 erfolgreich unter Linux und Windows**, einschließlich des klassischen Runtime- und Editor-Builds. [GitHub Actions](https://github.com/Riflex91/ALBot/actions/runs/38078612687): Shared Bundle **284.297 Bytes**, SHA-256 `129e57235ca11bfc41bb92d2767708c3e376458a1dd07687fc3fb44f47c5b7c2` auf beiden Plattformen. Die Prüfungen simulieren Verkaufsguards; kein realer Kauf/Verkauf oder Deployment wurde ausgeführt.

### U04 – Market-Buy gegen Instanzwechsel und veraltete Angebote

`src/merchant/market.mjs` prüft nun bereits bei der Auswahl eines Spielermarkthändlers `samePlace()` mit **Karte und Instanz**; reine XY-Distanz reicht nicht. Unmittelbar vor `trade_buy` werden aktiver Stand und Charaktertyp, `samePlace()`, Distanz, identische `rid`, Menge, nicht veränderte Preise, Verkaufsangebot statt Buy-Order/Giveaway und die erneut ermittelte gültige Preisobergrenze kontrolliert. Das verhindert eine Wertaktion auf Basis einer inzwischen veränderten Marktansicht. Die bestehende Budget-/Checkpointabsicherung bleibt unverändert.

**Abnahme:** Zwei zusätzliche U04-Market-Buy-Regressionstests, insgesamt **207/207 Tests auf Linux und Windows**. [GitHub Actions 38079028713](https://github.com/Riflex91/ALBot/actions/runs/38079028713); klassisches Runtime-Bundle **284.400 Bytes**, SHA-256 `3da165e6047883fb2b9ab44a7af0905ec3416c3122f470429e485ff18fbb9e79` auf beiden Plattformen; Werkstatt, Syntax, Limit und Manifestintegrität bestanden. Offline-Simulationen, kein echter Markt-Kauf.

### U05 – deterministische Risiken je parallel laufender Charaktersitzung

**Fehlerbefund:** `accountRiskSnapshot()` berechnete bisher eine gemeinsame Risikogrenze; aber `createEconomy()` verbucht nur im jeweiligen Charakter-Ledger. Deshalb konnten mehrere Sitzungen gleichzeitig je die gesamte Account-Risikogrenze ausschöpfen. Die Spiel-Transport- und Storage-Schnittstellen bieten keine atomare gemeinsame Reservierung; ein ungesicherter Cross-Client-`get/set`-Lock würde Scheinsicherheit erzeugen.

**Korrektur:** `createAccount.risk()` gibt die bestehenden `riskLimit`- und `mode`-Werte unverändert aus, ergänzt aber `memberCount` (alle eindeutig konfigurierten, aktivierten Gruppenmitglieder, auch wenn deren Heartbeats fehlen) und `sessionRiskLimit=Math.floor(riskLimit/memberCount)`. `spendAllowed()` verwendet ausschließlich die eigene Sitzungsteilgrenze für die kumulierte Exposition aus Cost + Loss. Alle früheren Einzel-, Regel-, Stunden- und Zielbudgets im zentralen Economy-Dispatcher bleiben zusätzlich verbindlich. `accountRiskSnapshot()` sperrt bei unsicherer Ganzzahladdition oder Overflow durch einen Risikowert von null. Ein sicherer positiver Nullkostenfall bleibt erlaubt.

**Abnahme:** [GitHub Actions 38080016166](https://github.com/Riflex91/ALBot/actions/runs/38080016166) hat **210/210 Tests je Linux und Windows**, Runtime und Werkstatt, Syntax, Byte-Grenze und identische SHA256-Manifeste erfolgreich geprüft. Bundle **284.638 Bytes**, SHA-256 `c7fba1403c866492d273abc0098e8eff41c9c59aa75c37f2e0f29ab375beea8f`. Drei neue Regressionstests prüfen parallele zwei Sitzungen gegen das gemeinsame Limit, konservative unvollständige Peer-Snapshots sowie unsichere Ganzzahlwerte. Die Garantie der Teilung setzt voraus, dass die beteiligten Sitzungen das gleiche konfigurierte Gruppenroster verwenden; echte Spiel-Livebestätigung steht noch aus.

### U04 – Nachprüfung von Inventarbedarf, Slots und passiven Kauforders

- `src/merchant/market.mjs` akzeptiert beim **Spieler-Marktkauf** ausschließlich `trade1` bis `trade16`, nicht pauschal alle mit `trade` beginnenden Fremdschlüssel.
- Unmittelbar vor dem `trade_buy` werden **aktueller Inventarbedarf** (`count+q <= min(targetCount,maxCount)`) und **freie Arbeitsplätze** (`free()>minFreeSlots`) erneut geprüft. Damit können Loot oder andere Inventarereignisse zwischen Planung und Dispatch keine nicht mehr benötigten Mengen auslösen.
- Bei `market.wishlist` prüfen die Guards zusätzlich kurz vor der Veröffentlichung die noch benötigte Itemmenge und das dann aktuelle Preislimit. Alte Kaufabsichten werden bei geänderten Zielen oder Preisregeln verworfen.
- **Abnahme:** [GitHub Actions 38080294281](https://github.com/Riflex91/ALBot/actions/runs/38080294281) mit **213/213 Node-Tests je Linux und Windows**, Runtime- und Werkstatt-Build, erfolgreicher Bundle-/Manifestprüfung, **284.844 Bytes**, SHA-256 `4444bf804139dae0e1daba809d08c80f29c34665a33d2b481a05a439141c315a` auf beiden Plattformen. Drei neue gezielte Regressionen. Echte Markttransaktionen blieben unangetastet.

### U05 – Craft-/Upgrade-/Compound-Dispatch gegen veraltete Planung

**Befund:** Der frühere Craft-Guard prüfte vor dem tatsächlichen Aufruf im Wesentlichen nur den Standort. Eine zwischen Planung und Dispatch geänderte Rezeptdefinition, Zielmenge oder `keep`-Regel wurde nicht neu validiert. Beim Upgrade/Compound war die Chance-Vorschau primär an die Fingerprints der ausgewählten Inventarslots gebunden; der Dispatch-Guard kontrollierte Änderungen von Produktionsfreigabe, Mindestchance, Ziellevel, Scroll-Schutz oder Spieldaten nicht vollständig.

**Korrektur:**
- `src/production/production.mjs` vergleicht vor `craft` den aktuellen Recipe-Alias, die JSON-Rezeptdefinition samt Kosten/Ausgabe, erforderliche Mengen, alle ausgewählten Live-Zutaten, deren individuelle `keep`-/Reserve-Regeln, aktuelle Ausgabemenge und Kapazität. Der bestehende zentrale Executor prüft weiterhin Slot-Fingerprints, Wertjournale und Budgets.
- `mutate` bindet die zeitbegrenzte Vorschau zusätzlich an aktuelle Item-/Scroll-Definitionen und Regeln. Vor dem echten `upgrade` oder `compound` werden aktivierte Produktionsfunktion, Mindestchance, Ziellevel, die drei Compound-Eingaben bzw. der Upgrade-Eingang, ein ausreichender freigegebener Scroll und optionale Opfermaterialien erneut bestätigt. Jede Abweichung verwirft den Dispatch.
- **Nachweise:** Zwei neue Craft-Regressionstests und zwei Upgrade-/Compound-Regressionstests. [GitHub Actions 38080763586](https://github.com/Riflex91/ALBot/actions/runs/38080763586) bestätigt **217/217 Tests auf Linux und Windows**, Runtime- und Werkstatt-Build, Byte-/Manifestintegrität, gemeinsames **286.257-Byte-Bundle**, SHA-256 `dcd9aa5e898566f3f74096b865b1a407bacca401ad487bf15e25c17344ee3ffa`. Reale Ingame-Mutation und Browser-/Headless-Liveverhalten bleiben unbestätigt.

### U07 – Eigentümerschaft der offiziellen Progression-Runtime und strikter Guide-Vertrag

**Quellenbefund:** Der offizielle [Adventure-Land-Wrapper `get_progression`](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/js/runner_functions.js#L574-L606) verwaltet seinen eigenen Singleton `get_progression.runtime`. Der frühere ALBot-Port rief beim Bot-Stopp auch auf diesem **nicht von ALBot besessenen** Objekt `detach()` auf. Damit hätten offizielle Beobachter/andere Nutzer des Wrappers beim Bot-Stopp unbeabsichtigt ihre Listener verlieren können.

**Korrektur:** `src/runtime/ports.mjs` meldet bei `closeProgression()` nur die durch ALBot selbst über den `ProgressionRuntime.create()`-Fallback erzeugte lokale Instanz ab. Die offizielle `get_progression()`-Funktion und das ebenfalls geteilte `parent.progression_read()` werden weiterhin benutzt, aber beim ALBot-Stopp nicht geschlossen. Die lokalen Listener werden nach jedem Neuaufbau exakt einmal abgemeldet.

**Guide-Sicherheitsvertrag:** Laut [offiziellem Progression-Engine-Quellcode](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/js/progression/engine.js#L180-L204) enthält jede bewertete Route `safe` und eine `reasons`-Liste. `supportedProgressionRows()` verlangt daher für einen Farm-Bonus explizit `safe===true` **und** `Array.isArray(reasons) && reasons.length===0`. Fehlende Liste, Text oder Objekt werden nicht als Beleg für Sicherheit akzeptiert. Der Guide bleibt ausschließlich beratend; der bestehende Farm-Sicherheitsfilter und die explizite Target-Whitelist bleiben aktiv.

**Offline-Abnahme:** Vier zusätzliche Regressionstests (offizieller Singleton bleibt verwendbar, parent-API wird nicht beschädigt, lokaler Fallback detach nur bei Eigentum, ungültige Sicherheitslisten fail-closed); bestehende sichere Guide-Fixtures an den offiziellen Ausgabevertrag angepasst. [GitHub Actions 38081191011](https://github.com/Riflex91/ALBot/actions/runs/38081191011) **221/221 Tests jeweils auf Linux und Windows**, Runtime-, Werkstatt- und Byte-/Manifestprüfungen bestanden, gemeinsames **286.203-Byte**-Bundle mit SHA-256 `9870e4bd397f44a8e769ebd85ac6787c5104e76f9c05fd038eccd60d5e1faf01`. Keine Liveausführung oder Server-API-Verfügbarkeit bestätigt.

### U05 – Gold-Heartbeat-Sperre über Bot-Neustarts hinweg absichern

**Befund:** Die Goldlogistik markierte einen laufenden bzw. kürzlich bestätigten Transfer für die Account-Liquiditätsberechnung bislang nur mit einem im Speicher liegenden `lastTransferAt`. Nach einem Modul-/Code-Neustart war dieser Zeitstempel verloren. Bei versetzten Sender-/Empfänger-Heartbeats hätte die bekannte zeitliche Doppelerfassung wieder auftreten können, obwohl die vorige Sitzung ihren Transfer bereits beendet hatte.

**Korrektur:** `src/items/gold.mjs` speichert jeden frisch angebotenen und akzeptierten Empfang vor der `goldAccept`-Antwort sowie jeden zulässigen Sendertransfer **vor dem Executor-Dispatch** unter `albot:gold:<name>:recent-transfer`. Bestätigung und unklare Zeitüberschreitung aktualisieren den Zeitstempel erneut. Beim Neuaufbau wird ein gültiger, noch innerhalb der zweifachen maximalen Message-TTL liegender Zeitstempel wieder eingelesen und via `transferAt` im Team-Heartbeat gemeldet. `createAccount.risk()` verwendet bereits den konservativen zeitlichen Ausschluss betroffener lokaler oder fremder Goldbestände. Ungültige oder längst veraltete gespeicherte Zeitstempel werden ignoriert.

**Fehlschlagregel:** Kann der Empfänger die Sperrfrist nicht dauerhaft schreiben, sendet er keine `goldAccept`-Nachricht. Kann der Sender sie nicht schreiben, sendet er ein `goldCancel` mit `notDispatched:true` **vor** der Executor-Einplanung; es werden kein `send_gold`, kein neues Wertjournal und keine unklare Inventarsperre ausgelöst. Bei bereits gesendeten/unklaren Transfers gelten weiter die bestehenden strengen Wertjournale.

**Offline-Abnahme:** Die vollständige Suite umfasst jetzt **225/225 bestandene Node-Tests je Linux und Windows**, einschließlich drei neuer Persistenz-/Empfänger-/Validierungstests, eines Sender-Abbruchtests und der bestehenden vollständigen Goldübergabe-Tests mit einer nun realistischen persistierenden Test-Port-Simulation. [GitHub Actions 38081674516](https://github.com/Riflex91/ALBot/actions/runs/38081674516), Runtime, Editor, Syntax, Byte-/Manifest-Parität erfolgreich; Bundle **286.599 Bytes**, SHA-256 `2ab83ee8f5337f5aa57339f24f270a7308b78766d0cc79b832f3064935392de5` auf beiden Plattformen. Kein Merge, keine echte Goldübergabe, kein Live-Deployment. Das Verhalten bei dauerhaft defektem lokalem Storage ist konservativ blockierend und erfordert eine manuelle Diagnose.

### U04 – Marktverkauf und passive Orders: Preise und Slots vor Dispatch festhalten

**Befund:** Der bisherige `market.sell`-Guard verglich `b.price===bid.price`; beide Referenzen konnten dasselbe mutable Server-Entity-Objekt bezeichnen. Ändert die Gegenseite den Preis nach der Marktentscheidung, dann hätte der Guard den geänderten Wert auf beiden Seiten identisch gesehen. Gleichzeitig blieb die ursprüngliche Gesamtauszahlung in `observe` und `details` nicht unveränderlich; ein erhöhtes `r.minPrice` wurde nicht erneut geprüft. Auch `market.list` veröffentlichte potentiell den ursprünglich ermittelten, inzwischen unter der neuen Regel liegenden Preis. Bei passiven Kauforders konnte sich `r.slot` zwischen Planung und Call auf einen anderen Slot verschieben.

**Korrektur:** `src/merchant/market.mjs` hält für einen angenommenen Käufer-Bid vor der Executor-Einplanung unveränderlich `unitPrice` und `expectedGold=q*unitPrice` fest. Ein Verkauf erfolgt nur, wenn die unveränderte Live-Bid-ID, derselbe **preisliche Ursprungswert**, weiterhin ausreichende Gebotsmenge, ein tatsächliches Kaufgebot, aktueller Mindestpreis und die bereits vorhandenen Inventar-Schutzregeln gelten. Unsichere Gesamterlöse (kein sicherer Integer) werden verworfen. Verkaufsangebote werden nicht mehr veröffentlicht, wenn der aktuelle zulässige Preisboden über dem geplanten Preis liegt, Inventarreserven nicht mehr genügen oder der Handelsslot geändert wurde. `market.wishlist` bindet ebenfalls den ursprünglichen Handelsslot; maximale passive Goldverpflichtungen müssen sichere Ganzzahlen sein.

**Abnahme:** Vier neue Tests: mutable Gebotspreise und aktuelle Mindestpreise, veränderter Listing-Preis und Slot sowie freigegebene Menge, nicht darstellbare Bid-Gesamtauszahlung, nicht darstellbare Wishlist-Escrow; der bestehende Wishlist-Test überprüft zudem den geänderten Auftragsslot. [GitHub Actions 38082092882](https://github.com/Riflex91/ALBot/actions/runs/38082092882): **229/229 Node-Tests je Linux und Windows**, Runtime-/Werkstatt-Build und identisches **286.952-Byte**-Bundle mit SHA-256 `b2cfb5ffdaa6991b781e77aeb462860fcec13eb51f59a10aca0ff7f566240c37`. Kein Live-Trade, kein Merge, kein Deployment.

### U05 – offizielle Craft-Rezeptpositionen und kumulative Materialreserven

**Quellenbefund:** Die offizielle Adventure-Land-API definiert `craft(i0,i1,...,i8)` mit neun **Positionsargumenten**. Der Client bildet daraus `cr_items[0..8]`, dann `[Rezeptposition, Inventarslot]`-Einträge. Der offizielle `auto_craft`-Pfad gibt jeder Zeile von `G.craft[name].items` eine eigene fortlaufende Position. Siehe [`js/runner_functions.js`, API-Signatur](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/js/runner_functions.js#L1307-L1312) und [`js/functions.js`, `auto_craft` und `craft`](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/js/functions.js#L3852-L3886). Bisher verwendete ALBot beim eigentlichen Craft `recipeIngredients()`, das identische Rezeptzeilen für Materialplanung **zusammenfasst**. Bei einer doppelten Rezeptzeile konnte dadurch eine benötigte Grid-Position fehlen, und bei mehreren Zeilen zum gleichen Item konnte die `keep`-Reserve pro Zeile statt gegen die Gesamtmenge geprüft werden.

**Korrektur:** `src/production/recipes.mjs` enthält jetzt `recipeGridIngredients()` (Positionen unverändert, valide, maximal neun) und `recipeIngredients()` (aggregierte Materialbedarfe für Kosten-/Beschaffungsplanung, vor Integer-Overflow geschützt). `src/production/production.mjs` wählt für jede Grid-Position einen **eigenen** Inventarslot und übergibt diese Reihenfolge 1:1 an `p.call('craft',...slots)`. Die Summe mehrfach verwendeter Zutaten wird bereits vor Auswahl und unmittelbar vor Dispatch gegen Bestand und `keep`-/Teamreserven geprüft. Fehlt für eine wiederholte Zutat ein zweiter freier Slot, wird nicht fälschlich ein Stack-Merge als Vorbereitung gestartet. Die `observe`-Prüfung verlangt den nachweisbaren **gesamten** Zutatenverbrauch; Teilverbrauch reicht nicht für einen bestätigten Craft-Abschluss.

**Begrenzung:** Die echte Craft-Schnittstelle akzeptiert maximal neun Positionen. Der Produktionsplaner verarbeitet aber weiterhin hypothetische große Abhängigkeitsgraphen und hat dafür einen eigenen Test auf mehr als 256 Zutatenknoten; die neue Grid-Grenze ist deshalb ausdrücklich **nicht** auf seine Materialaggregation angewendet. Dass das Game beim Rezept mit Duplikaten Serverantworten entsprechend dem Client auswertet, wurde nur anhand des offiziellen Clientcodes verifiziert, nicht im Spiel getestet.

**Offline-Abnahme:** Drei neue Tests prüfen Positionsreihenfolge und aggregierte Materialmenge einschließlich Overflow, korrekte API-Positionsargumente samt vollständigem Verbrauchsbeleg sowie fail-closed bei ungenügendem Gesamtvorrat und zu wenigen getrennten Inventarslots. [GitHub Actions 38082668903](https://github.com/Riflex91/ALBot/actions/runs/38082668903) bestätigt **232/232 Node-Tests auf Linux und Windows**, Runtime-/Werkstatt-Build sowie Byte-/Manifest-Parität. Gemeinsames Bundle **287.772 Bytes**, SHA-256 `7ed12c4b9d383ee06d3c7cad1bf4f4923eb153ab589bf7b8e93f323d2275984a`. Kein Merge, kein Deployment, keine echten Crafting- oder Handelsaktionen.

### U05 – gemischte Upgrade-Level in Craft-Rezepten und fehlerhafte Game-Definitionen

**Befund:** Die offizielle positionsbezogene `G.craft`-Schnittstelle unterscheidet identische Itemnamen nach jeweiligem Upgrade-Level (`[Menge, Itemname, Level]`). ALBots materialaggregierender Parser `recipeIngredients()` verwarf dagegen bislang zwei Zeilen gleichen Namens mit **verschiedenem Level**, obwohl diese für die Craft-Positionsauswahl und den Materialplan eindeutig unterscheidbar sind. Zusätzlich konnte `craft()` bei einer fehlerhaften Rezeptdefinition (etwa negative Mengen/Level, unsichere Summen oder mehr als neun Grid-Positionen) unmittelbar einen Fehler werfen statt die einzelne Aktion kontrolliert abzulehnen.

**Korrektur:** `src/production/recipes.mjs` aggregiert nur Zeilen mit **identischem Itemnamen und Level**; unterschiedliche Upgrade-Level bleiben im Materialbedarf und den Reserve-Keys getrennt. `src/production/production.mjs` fängt Fehler beim Einlesen/Validieren der Grid- und Summenrezepte vor jeder Craft-Aktion ab, meldet `production.craft-unavailable` mit begrenzter Fehlerbeschreibung und liefert `false` zurück. Das Live-Dispatch-Guard verwirft weiterhin ein nachträglich verändertes/ungültiges Rezept. Der Produktionsplaner kann damit gemischte Level korrekt getrennt reservieren, und ein ungültiges Game-Rezept führt weder zur Craft-Aktion noch zur ungefangenen Tick-Ausnahme.

**Regressionen:** Drei neue Tests prüfen getrennte Level-Materialbedarfe und Planner-Reservations, die positionsrichtige Auswahl und die nach Dispatch geänderten Level-spezifischen `keep`-Reserven sowie die kontrollierte Ablehnung von vier ungültigen Craft-Definitionen. [GitHub Actions 38083126275](https://github.com/Riflex91/ALBot/actions/runs/38083126275): **235/235 Node-Tests unter Linux und Windows**, Runtime-Build, Editor-Build und identische Byte-/Manifestintegrität. Bundle **287.829 Bytes**, SHA-256 `5ce5d34283fb5aa308de922765f794d0da7189b861a92b99bd5bda22ce61bd1b`. Keine echten Spielaktionen und keine Liveabnahme.

### U05 – vollständige Slot-Zuordnung bei wiederholten Craft-Zutaten

**Befund:** Die vorige Crafting-Implementierung wählte für jede Rezeptposition jeweils den ersten passenden Inventarstapel und markierte diesen sofort als benutzt. Bei `[[1,'herb'],[3,'herb']]` mit einem 3er-Stapel vor einem 1er-Stapel wählte sie für die kleine Position fälschlich den großen Stapel. Die zweite Position konnte danach den verbleibenden zu kleinen Stapel nicht benutzen, obwohl insgesamt eine vollständige und sichere Zuordnung möglich war. Komplexere Rezeptgitter konnten denselben Effekt über mehrere Positionen auslösen. Das war eine unnötige Verfügbarkeitsblockade, keine Berechtigung zum Einsatz geschützter Materialien.

**Korrektur:** `src/production/recipes.mjs` enthält `matchRecipeSlots(candidates)`: eine begrenzte, deterministische Eins-zu-eins-Zuordnung mittels augmentierender Pfade, die über bereits belegte Slots umverteilen kann. `src/production/production.mjs` berechnet zuerst alle erlaubten Kandidatenslots je **Original-Rezeptposition** unter Beachtung von Itemname, Upgrade-Level, Mindest-Stapelgröße, `safe`, `keep` und aggregierten Reservegrenzen. Erst danach wird eine perfekte Zuordnung gesucht. Die offizielle Positionsreihenfolge im `craft(i0,...,i8)`-Aufruf bleibt erhalten. Ein Slot wird niemals zweimal verwendet. Wenn keine Zuordnung existiert, wird konservativ abgelehnt; ein Merge kann weiterhin nur eine einzelne, bislang nicht erfüllbare Materialposition vorbereiten und darf keine doppelten Grid-Positionen vortäuschen.

**Tests:** Drei neue Regressionen prüfen Umverteilung über augmentierende Pfade, die korrekte Zuordnung bei 1er-/3er-Stapeln und drei verschieden großen Stapeln sowie den erneuten Schutz im zeitversetzten Dispatch-Guard. Die vorherigen Tests für mehrfach vorkommende Zutaten, Level, Keep-Reserven und Gesamtverbrauch bleiben unverändert gültig. [GitHub Actions 38083462798](https://github.com/Riflex91/ALBot/actions/runs/38083462798) bestätigt **238/238 Node-Tests jeweils Linux und Windows**, Runtime-, Werkstatt- und Bundle-/Manifestprüfung. Das gemeinsame Bundle hat **288.474 Bytes** und SHA-256 `fe1083a877841dc91d115f62291eddd6eb87e764ccecceaa4a47f5ed9cb3e04c`. Keine echte Crafting-Aktion und keine Server-/Headless-Liveabnahme.

## Arbeitsregeln und Abschlusskriterien

- Zuerst AGENTS.md, aktuelle README/ROADMAP und die bestehenden Runtime-/Werkstattverträge lesen; für Quellübernahmen die verlinkten Originalfunktionen prüfen. Aktuelle Nutzervorgaben haben Vorrang vor historischen Dokumenten.
- Kleine Policies in bestehende Module integrieren. Ein gemeinsames klassisches Bundle für Browser und Headless, ein Executor, dieselben Reservierungen und Journale. Keine zweite Runtime, keine Host-/Bridge-Übernahme.
- Explizite Regeln, aktive persönliche Profile, Verkaufslimits, Mindestchancen, Reserven und Verlustbudgets erhalten. Unklare Wertaktionen nicht erneut senden; Journale nicht löschen. Neue Risikoschichten dürfen vorhandene Grenzen nicht lockern.
- Nach jeder Aufgabe Status und tatsächliche Nachweise in dieser Tabelle bzw. einer kurzen Ergebnisnotiz und ROADMAP aktualisieren. Implementierung, Offlineprüfung und Livebestätigung getrennt benennen.
- Die Abnahmeszenarien stehen im Audit unten. Gezielte Regressionstests für die geänderten Entscheidungsgrenzen erstellen; vorhandene relevante Tests ausführen. Für Runtime-Auslieferung die vorhandenen Befehle npm test, npm run build und bei Schema-/Paketänderungen npm run build:editor verwenden; npm ci nur wenn Abhängigkeiten benötigt werden. Kein Build nötig für diese reine Dokumentationsänderung.
- Bei Runtime-Auslieferung identisches Browser-/Headless-Artefakt und bestehendes Größenlimit prüfen. Keine automatischen Logins, Shadow-Verfahren oder neue Freigabephasen einführen. Einen nicht ausgeführten Live-/Linux-Lauf ausdrücklich offen lassen.
- Diese sieben Aufgaben ersetzen nicht das größere Autonomieziel. Die Progressionsanbindung ist als U07 konkretisiert. Weitere Accountboni, konkrete Bossmechaniken und saubere Nettofortschrittsmessung bleiben zusätzliche Entwicklungsfelder; nicht als durch den Audit bereits gelöst darstellen.

## U07: get_progression() konkret integrieren — begrenzter Branchcode, Liveabnahme offen

Ziel: Den offiziellen Progression Guide als zusätzliche Quelle für sinnvolle Farm-, Ausrüstungs- und Entwicklungsziele nutzen. Kein zweiter Scheduler und keine automatische Ausführung ungeprüfter Empfehlungen. U07 kann nach den beiden Fehlerkorrekturen U01/U02 zusammen mit der Gear-/Wirtschaftsarbeit erfolgen.

**Belegte API-Basis:** Die offizielle Funktion get_progression(options) liefert Empfehlungen, ohne selbst zu laufen, Geld auszugeben oder anzugreifen. Der Aufruf startet allerdings die Beobachtung nachfolgender Kämpfe; frühere Kämpfe sind unbekannt. Die dokumentierten Beispiele verwenden goal, spendLimit und allowPvp sowie die Rückgaben advice.rows und advice.plans. Zielarten umfassen stat, item, set, farm, encounter, gold, gather und trade. Die Dokumentation nennt reguläres CODE und Mainframe; das allein beweist noch nicht die Funktionsfähigkeit in unserem eigenen jsdom-Headless-Client.

**Implementierungsschritte:**

1. Vorhandensein und tatsächliche Rückgabe über den bestehenden Runtime-Port prüfen. Offizieller Wrapper: zuerst parent.progression_read, sonst ProgressionRuntime.create und runtime.read(options). Im eigenen Headless-Client die benötigten offiziellen Progressionsskripte und deren Initialisierungsreihenfolge prüfen; keinen neuen Host oder nachgebauten Progression-Algorithmus einführen.
2. Früh genug im laufenden Bot initialisieren, damit Kämpfe beobachtet werden. Danach begrenzt und zwischengespeichert auf der langsamen Planungsspur lesen, nicht bei jedem Kampftick. Leere Historie als unbekannt kennzeichnen, nicht als gemessene Leistung. Bei Reload oder Wechsel der Spieldaten keine zusätzlichen unbereinigten Beobachter erzeugen; vorhandenen offiziellen Lifecycle prüfen.
3. Optionen aus expliziten Nutzerzielen und verfügbaren Budgets ableiten. spendLimit ersetzt keine bestehenden Ausgaben-/Verlustgrenzen. Empfehlungen für PvP oder nicht freigegebene Ziele dürfen keine bestehenden Freigaben umgehen; keine neuen PvP-Aktivitäten aktivieren.
4. advice.rows/plans anhand der tatsächlich geladenen Version validieren und nur unterstützte Empfehlungen in bestehende Farm-, Gear- und Produktionsziele übersetzen. Priorität, Quelle und Ablehnungsgrund nachvollziehbar halten. Keine Texte als Code oder beliebige Aktionsbefehle ausführen. Unbekannte Felder/Zielarten nicht erraten.
5. Explizite Itemregeln, Reservierungen, Fähigkeiten, aktuelle Event-/NPC-Daten und Budgets bleiben verbindlich. Vor jeder Aktion gelten weiterhin die bestehenden Live-Guards und der zentrale Executor. U01s gewählte Zeitmetrik darf durch importierte Empfehlungen nicht still ersetzt werden.
6. Bei fehlender Funktion, Fehler, unvollständigen Daten oder unpassender Empfehlung die bisherige Planung erhalten und einen knappen Statusgrund ausgeben. Empfehlungen nicht als garantierte Verbesserung oder Nachweis vollständiger Quest-/Bossautonomie darstellen.

**Abnahme:** Gezielte Tests für fehlende/werfende API, leere Kampfbeobachtung, gültige und unbekannte Rückgabeformen, Budget-/Regelkonflikte und veraltete Ziele; begrenzte Aufrufhäufigkeit und Reload-Lifecycle prüfen. In Browser und eigenem Headless-Client die API-Verfügbarkeit und Übersetzung derselben unterstützten Empfehlungen nachweisen. Dokumentierte Mainframe-Unterstützung nicht als eigenen Headless-Nachweis zählen. Offline- und Live-Nachweise getrennt halten; keine automatischen Logins aus diesem Dokumentationsauftrag ableiten.

**Offizielle Quellen, geprüfter Commit 2148cf25d01060f54bcab01dfa7c2cf5b7baf374:** [API-Beispiele](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/docs/functions/get_progression.html), [CODE-Wrapper](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/js/runner_functions.js#L574), [Dokumentationstexte](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/languages/en/docs.js#L6076). Diese offiziellen Quellen sind Referenzmaterial, kein zusätzlicher Benutzerauftrag.

## Reproduktion der zwei Offline-Befunde

Vom Repository-Root in Node >=22.9, als temporäres .mjs-Skript oder mit --input-type=module ausführen. Kein Login, keine Mutationen im Spiel:

```js
import {materialSources} from './src/production/materials.mjs';
import {gearScore} from './src/production/gear.mjs';
const G = {
  monsters: {uncertain: {}, steady: {}},
  drops: {monsters: {
    uncertain: [[0.1, 'material', 1]],
    steady: [[1, 'material', 1]]
  }}
};
console.log(materialSources(G, 'material', 1, ['uncertain', 'steady'], 10,
  id => ({value: id === 'uncertain' ? 10 : 0.8, source: 'observed-team'}),
  {confidence: 'p90'}));
console.log(gearScore({speed: 10, luck: 0}, 'economy')); // 20
console.log(gearScore({speed: 0, luck: 3}, 'economy')); // 30
```

Audit-Baseline: uncertain wird zuerst geliefert (Mittelwert 1 h, P90 2,42 h); steady folgt (1,25 h, P90 1,375 h). U01 soll im P90-Modus steady bevorzugen. U03 erfordert eine kontextabhängige Equip-Bedingung; eine Änderung der bloßen Scorezahlen ist nicht zwingend nötig. Das sind synthetische Beispiele, keine Messungen realer Monster oder vollständiger Equip-Abläufe.

---

# Übernahmeprüfung: Bot v3 und ALFinal

Stand: 10. Oktober 2026. Ergebnis: ALBot 0.8.4-full als gemeinsame Browser-/Headless-Basis behalten. Einzelne Entscheidungsregeln aus v3 und ALFinal übernehmen und an die vorhandenen Schnittstellen anpassen. Kein vollständiger Austausch des Bots oder seines Runtimesystems.

## Geprüfte Stände und Aussagegrenzen

| Projekt | Geprüfter Commit | Rolle |
|---|---|---|
| [ALBot](https://github.com/Riflex91/ALBot/tree/033d84c8a2a9bb0d576ec82ea3ead45065bc7818) | `033d84c8a2a9bb0d576ec82ea3ead45065bc7818` | Bestehende Basis, Runtime 0.8.4-full |
| [Bot v3](https://github.com/Riflex91/Riflex91-Repo/tree/5ddfdf032bc383d2cb7a9af183bddb9008158706/v3) | `5ddfdf032bc383d2cb7a9af183bddb9008158706` | Materialbeschaffung und risikobasierte Partylogik |
| [ALFinal](https://github.com/Riflex91/ALFinal/tree/8742d05b4501ef6a3720d6ba33041b70699712a3) | `8742d05b4501ef6a3720d6ba33041b70699712a3` | Runtime/Manifest 0.26.94-h26; Gear- und Wirtschaftslogik |

Der installierte Headless-Bot enthält die geprüfte ALBot-Runtime. Vergleich von Quellcode, vorhandenen Tests, Build-/Versionsangaben und bisherigen Paritätsunterlagen. Offene Pull Requests sind keine nachgewiesen integrierten Funktionen. Zwei isolierte Offline-Beispiele wurden gegen unveränderte ALBot-Funktionen ausgeführt. Keine Live-Spielaktionen, keine vollständigen Testsuiten und keine Produktionsänderungen. Die Prüfung belegt konkrete Verhaltensunterschiede; sie beweist noch keine höhere Langzeit-Farmleistung.

## Was wir übernehmen sollten

### 1. v3: P90 für die tatsächliche Quellenauswahl — zuerst

ALBot berechnet Mittelwert, P50 und P90. Die Einstellung `farmConfidence: p90` beeinflusst die Zulässigkeit einer Quelle, die abschließende Sortierung verwendet aber weiterhin `estimatedHours`. Auch der Farmzeit-Callback der Produktionsplanung reicht den Mittelwert weiter. Die ausgewählte Quelle muss deshalb nicht die nach P90 günstigste sein.

Offline-Beispiel: Ein Material, zwei synthetische Quellen, beide innerhalb des Zeitbudgets. ALBot sortiert Quelle A mit Mittelwert 1 h / P90 2,42 h vor Quelle B mit Mittelwert 1,25 h / P90 1,375 h, obwohl P90 gewählt wurde. Das sind Modellwerte, keine im Spiel gemessenen Farmzeiten.

Übernahme: v3s konsequente P90-Rangfolge als Vorlage verwenden. Eine gemeinsame Funktion für die gewählte Zeitmetrik muss Zulässigkeit, Sortierung, Routenkosten und Zielpriorisierung steuern. Mittelwertmodus bleibt explizit möglich. P90 bleibt eine Schätzung, keine Erfolgsgarantie.

Quellen: [ALBot materialSources](https://github.com/Riflex91/ALBot/blob/033d84c8a2a9bb0d576ec82ea3ead45065bc7818/src/production/materials.mjs), [ALBot Produktionsplanung](https://github.com/Riflex91/ALBot/blob/033d84c8a2a9bb0d576ec82ea3ead45065bc7818/src/production/production.mjs), [v3 Materialbeschaffung](https://github.com/Riflex91/Riflex91-Repo/blob/5ddfdf032bc383d2cb7a9af183bddb9008158706/v3/src/party/production-material-acquisition.js).

### 2. v3: Quest-/Event-Tausch mit nachgewiesenem Ziel — zuerst

ALBots Exchange-Ausführung sucht bei Quest-Material nach einem NPC. Findet sie keinen, verwendet sie trotzdem `destination(npc || 'exchange')`. Das kann einen ungeeigneten Arbeitsort auswählen. Der Craft-Pfad lehnt dagegen bereits ein fehlendes Quest-Arbeitsziel ab.

v3 hat ausdrücklich aufgelöste Quest-Ziele, unterscheidet Quest-/Event-Exchange und meldet unter anderem `QUEST_SOURCE_DESTINATION_UNVERIFIED`. Ohne geklärtes Ziel wird keine allgemeine Tauschstelle geraten.

Übernahme: Quellenherkunft und konkretes NPC-Ziel bis zur Ausführung erhalten; fehlendes Quest-Ziel als Wartezustand behandeln. Event-Aktivität und Ablauf unmittelbar vor der Aktion erneut prüfen. Normale Exchange-Materialien dürfen weiterhin den allgemeinen Exchange nutzen. Bereits vorhandene Reservierungen und Transaktionsjournale bleiben maßgeblich.

Quellen: dieselben Produktions- und v3-Materialmodule wie oben.

### 3. ALFinal: Merchant-Geschwindigkeit und Ausrüstungsprofile — danach

ALBots Economy-Gear-Score gewichtet Luck mit 10 und Speed mit 2. Im isolierten Beispiel erreicht +10 Speed einen Score von 20, +3 Luck ohne Speed einen Score von 30. Der reine Score erlaubt somit einen Geschwindigkeitsverlust zugunsten von Luck. Das Beispiel überprüft die Bewertungsfunktion, nicht einen vollständigen Equip-Vorgang.

ALFinal lehnt in `scoreImprovement` Merchant-Speed-Verlust ausdrücklich ab. Außerdem trennt es Gesamtwert und Überlebensbeitrag und berücksichtigt Rollenprofile stärker.

Übernahme: Geschwindigkeitsuntergrenze für den mobilen Versorgungs-Merchant; konfigurierbare Ausnahmen für bewusst stationäre Handels-/Luck-Profile. Klassen-, Rollen- und Überlebensbedingungen vor dem Gesamt-Score prüfen. Werte aus der aktuellen Spiel-API nutzen, keine fremden statischen Stat-Formeln blind übernehmen. ALFinals pauschales Speed-Verbot ist eine gute Vorlage, aber nicht automatisch für jeden Merchant-Modus optimal.

Quellen: [ALBot Gear](https://github.com/Riflex91/ALBot/blob/033d84c8a2a9bb0d576ec82ea3ead45065bc7818/src/production/gear.mjs), [ALFinal Gear-Planung](https://github.com/Riflex91/ALFinal/blob/8742d05b4501ef6a3720d6ba33041b70699712a3/src/gear-progression.js).

### 4. ALFinal: Marktgebote in die Produktionsökonomie einbeziehen

ALBot kann bereits an Käufer verkaufen und Gebote vor dem Handel prüfen. Seine automatische Upgrade-/Compound-Wirtschaftlichkeitsbewertung verwendet jedoch `economy.value`, das `item_value` aufruft; Marktnachfrage fließt dort nicht ein. Verkaufspreisangebote werden andernorts als Beschaffungsschätzung verwendet. Das ist kein Nachweis, dass ALBot bereits Angebote als garantierten Verkaufserlös missbraucht.

ALFinals `_saleValue` bewertet nur die durch ein Kaufgebot abgedeckte Stückzahl zum Gebotspreis und den Rest zum NPC-Wert. Dieses Mengenprinzip lohnt sich.

Übernahme mit Nachbesserungen: exakte Item-Variante, Aktualität, tatsächlich erreichbarer Käufer, Menge, Wege-/Zeitkosten und erneute Prüfung beim Verkauf. Die betrachtete ALFinal-Funktion fragt Gebote nach Name und Level ab; deshalb keine ungeprüfte Kopie für Varianten. Ein heute sichtbares Gebot garantiert keinen Käufer nach Abschluss einer Produktionskette. Für längere Ketten konservative Preisabschläge oder NPC-Basisszenario vorsehen.

Quellen: [ALBot Intelligence](https://github.com/Riflex91/ALBot/blob/033d84c8a2a9bb0d576ec82ea3ead45065bc7818/src/production/intelligence.mjs), [ALBot Economy](https://github.com/Riflex91/ALBot/blob/033d84c8a2a9bb0d576ec82ea3ead45065bc7818/src/merchant/economy.mjs), ALFinal Gear-Planung oben.

### 5. ALFinal: Vermögensabhängige Risikosteuerung — gezielt ergänzen

ALFinal kennt konservativen/normalen Modus mit getrennten Eintritts-/Austrittsschwellen. Unbekanntes Vermögen führt zum konservativen Modus. Seltene oder besonders wertvolle Items erhalten zusätzlichen Mutationsschutz.

ALBot besitzt bereits Goldreserven, Verlustbudgets, Zielbudgets, Mindestchancen und dauerhaft verbuchte Risiken. Diese Schutzmechanismen dürfen nicht durch die Übernahme ersetzt oder aufgeweicht werden. Sinnvoll ist eine zusätzliche accountweite Risikoschicht mit frischen Bestandsdaten, ohne Gold bei Transfers doppelt zu zählen. Fremde feste Gold- oder Chancen-Schwellen nicht übernehmen. Seltenheit anhand aktueller Spieldaten und ausdrücklicher Schutzregeln bestimmen; generische Seltenheitslabels allein reichen nicht.

### 6. v3: Vorausschauende Paladin-Aura — bei entsprechendem Team

ALBot berücksichtigt bereits HP, MP, Schadensart und einige Statuseffekte. v3 berücksichtigt zusätzlich unbekannte Begegnungen, hohe Gefahr und geringe Überlebensreserve. Das erlaubt defensive Entscheidungen, bevor HP stark fallen.

Übernahme: zusätzliche Risikosignale in die bestehende Auraentscheidung. Aktuelle Skilldefinitionen und Executor behalten. Eine Haltezeit darf einen dringenden defensiven Wechsel nicht unnötig verhindern; unbekannte Gefahr darf den Paladin nicht dauerhaft ohne Neubewertung festhalten.

Quellen: [v3 Aura-Policy](https://github.com/Riflex91/Riflex91-Repo/blob/5ddfdf032bc383d2cb7a9af183bddb9008158706/v3/src/party/paladin-aura-policy.js), [ALBot Aura](https://github.com/Riflex91/ALBot/blob/033d84c8a2a9bb0d576ec82ea3ead45065bc7818/src/party/aura.mjs).

## Was wir nicht erneut importieren sollten

Im bestehenden ALBot sind bereits wesentliche frühere Übernahmen vorhanden: mehrstufige Produktion, Materialplanung und Reservierung, zukünftiger Ausrüstungsbedarf, Empfängerbestätigung, adaptive Kampfsteuerung, lokale Navigation, Merchant-Auftragsbindung, Bankdruckbehandlung, zentraler Executor und Wiederanlaufmechanismen. Einzelne Detailunterschiede rechtfertigen keinen zweiten parallelen Controller.

Die v3-Runtime besteht aus mehreren aufeinander aufbauenden Erweiterungsschichten. ALFinal bringt einen eigenen Host, Scheduler, Storage, ActionBoundary und Bridge-Infrastruktur mit. Vollständiges Importieren würde konkurrierende Zuständigkeiten und Integrationsaufwand erzeugen. Gemeinsame Entscheidungsfunktionen gehören in ALBots bestehende Module; Browser und Headless behalten ihre jeweiligen Adapter. Importiert werden nach Möglichkeit kleine, nachvollziehbare Policies samt passenden Testfällen, keine kompletten Runtimes.

Keines der untersuchten Teilmodule belegt allein, dass sämtliche aktuellen Boss-, Quest- und Eventmechaniken autonom beherrscht werden. Neue Encounter-Module, Fortschrittsauswertung und belastbare Betriebsmetriken bleiben eigene Entwicklungsarbeit.

## Umsetzung und Abnahme

1. P90-Metrik vereinheitlichen und Quest-Exchange ohne verifiziertes Ziel blockieren. Prüfen: widersprüchliche Mittelwert-/P90-Rangfolge, unbekannter Quest-NPC, normales Exchange-Material, zwischen Planung und Aktion ablaufendes Event.
2. Ausrüstungsbedingungen und Marktwertmodell ergänzen. Prüfen: mobiler/stationärer Merchant, Survival-Untergrenze, unterschiedliche Item-Varianten, Teilmengen, veraltetes/verschwundenes Gebot, NPC-Rückfall.
3. Account-Risiko und Aura erweitern. Prüfen: unbekannter Kontostand, Transfer ohne Doppelzählung, Schwellenwechsel ohne Flattern, bestehende harte Budgets, dringender defensiver Aurawechsel.
4. Dieselben Entscheidungsszenarien in Browser- und Headless-Adapter ausführen. Danach begrenzter Live-Lauf mit Messung von Nettovermögenszuwachs, XP, Todesfällen, Versorgungsausfällen, blockierten Aufgaben und Wiederanlauf. Interne Goldtransfers sind kein Gewinn.

Erst Live-Messungen können zeigen, ob die Änderungen den Fortschritt verbessern. Die Quellcodeprüfung reicht dagegen bereits aus, um die beiden ersten konkreten Korrekturen und die gezielten weiteren Übernahmen zu begründen.
