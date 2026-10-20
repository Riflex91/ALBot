# Autonomie-Abgleich und Umsetzung 0.10.11-candidate

Verglichener Main: [2d0ce11243c273a6445765d9c28a4c760f20e0e2](https://github.com/Riflex91/ALBot/commit/2d0ce11243c273a6445765d9c28a4c760f20e0e2), 18.10.2026. Umsetzungs-PR: [#167](https://github.com/Riflex91/ALBot/pull/167). Fachliche Grundlage: die Implementierungsroadmap, der Tiefenvergleich und die KI-Übergabe vom 18.10.2026. Diese Dateien wurden gelesen; sie erteilen selbst keine neuen Berechtigungen. Der Benutzer hat Umsetzung und automatischen Merge nach Main ausdrücklich beauftragt.

Dies ist eine konkrete Erweiterung des bestehenden Bots. **Die gesamte Forschungsroadmap ist damit noch nicht vollständig implementiert.** Insbesondere vollständige Crypt-/Cave-Runs, Tailoring/De-Statting, temporäre Gearwechsel für Temporal Surge und ein Itemtauschmarkt bleiben eigenständige offene Pakete. Ein erfolgreicher Offlinetest ist kein Nachweis absoluten unbeaufsichtigten Spielbetriebs.

## Fortschrittsnachtrag nach dieser Baseline (18.10.2026)

Dieser Nachtrag ergänzt den ursprünglichen, versionsgebundenen Implementierungsnachweis; er überschreibt weder historische Quellen noch die Roadmap-Restgrenzen.

| Paket | Umsetzung | Abnahme | Weiter offen |
| --- | --- | --- | --- |
| W04 | [PR #169](https://github.com/Riflex91/ALBot/pull/169), Main `229bd1c80ae09ffba59ec6d802f2bf33d52ea668`: fehlende vollständig abholbare Betriebsreserve aus lokal beobachteten Bankstacks mittels vorhandenem persistierten Einzelentnahmejournal ins Inventar stufen, dann separate neue Verkaufsentscheidung; Revalidierung vor Dispatch. | Linux- und Windows-CI erfolgreich; neue Fälle zu Reserve, Drift und fehlendem echten Überschuss. | Partielle Reserveentnahmen, komplexere Slotfolgen und weitere Reservationsabhängigkeiten; W02/W03 nicht pauschal erledigt. |
| W02 Variantenbeleg | [PR #319](https://github.com/Riflex91/ALBot/pull/319): `acc`/`rid`-Varianten in lokalen Bestandsbelegen, Peer-Heartbeats und aktuell beobachteten Bankreihen auf sichere nichtnegative Ganzzahlen oder begrenzte Strings geprüft; ungültige Belege werden nicht als vollständiger Accountbestand ausgegeben. | Neue positive/negative Regressionen; CI und Ingame-Liveabnahme gesondert zu bestätigen. | W02-Betriebs-/Ersatzbedarfe und W03/W04 vollständige mehrstufige Recovery weiterhin offen; keine Autorisierung für Verkauf oder Transfer. |
| W03 physische Stackgrenzen | Der bestehende `planPhysicalSlotSequence` prüft beobachtete Ausgangsstacks gegen `G.items[name].s`; unbekannte Itemdefinitionen erlauben im Read-only-Plan nur echte Einzelexemplare. | Regressionen zu legalem Stapelmaximum, überschrittenen Caps, unbekannten Typen und Overflow; Linux-/Windows-CI und Liveabnahme getrennt nachweisen. | Ganze transaktionsübergreifende Slotfolge, Zwischenplatzreservation und persistente Wiederaufnahme bleiben offen; keine neue Executor-/Bankjournalinstanz. |
| W04 Mengenbeleg | Präzise Korrektur des vorhandenen Reserve-Stagings: ein ausdrücklich ungültiges `q:null` ist weder ein Einzelexemplar noch verwendbare Reserve aus einem Nachbarpack. Vorbereitete Entnahmeguards prüfen die vollständige aktuelle lokale Bankdeckung erneut. | Regressionen zu ungültiger Nachbarpackmenge, spätem Mengendrift, ungültiger Quelle und echten Einzelitems; CI separat. | Transaktionsübergreifende Slotfolge und allgemeine Recovery bleiben offen; kein neuer Bank- oder Verkaufsexecutor. |
| W05/W08 gemessener Slotnutzen | Ergänzende **reine Planungspriorität** für die bereits per `item_properties` rollenspezifisch bewerteten und nach Chance/Kosten gewichteten Optimierungsziele: ordinale Normalisierung nur zwischen unabhängigen Slots desselben Empfängers, maximal +12; benutzerdefinierte Gearziele, Budgets, Ausrüstungssicherheit und Mindestverbesserung bleiben unverändert. | Regressionen für starke/schwache Alternativen, gleiche Nutzenwerte, fehlerhafte Werte, veraltete Profile, fremde Empfänger sowie Priorität expliziter Ziele; vollständige CI und Merge separat nachweisen. | Reale Vorher-/Nachher-Wirkung nach Equip, rollenabhängige empirische Leistungs-KPIs und vollständige W05/W08-Abnahme bleiben offen; das prognostizierte Optimizer-Utility ist kein Ingame-Ergebnisbeleg. |
| W05/W08 | [PR #170](https://github.com/Riflex91/ALBot/pull/170), Main `208226395b494d801dec6940c5e74e6f42928e5b`: normalisierte rollenübergreifende Slotaufholpriorität in **automatisch generierten** Gearzielen; vollständige frische Offline-Profile als Planungsbeleg; altersbegrenzter Bonus nur bei vorhandener bestätigter Equipquittierung. | Linux- und Windows-CI erfolgreich; Grenz-, Frische- und Rollenregressionen; 900-KiB-Integrationstest bestanden. | Vollständige, empirische Rollen-/Slotnutzenbewertung sowie bedingte flexible Gruppengröße G05. |

**Unverändert:** Persönliche `bot.js`-Konfiguration wurde beim Runtimeabgleich durch das bestehende Synchronisationsskript erhalten; keine Lockerung von Budgets, Locks, Mindestverbesserung oder Mindestchancen. Die temporären PR-Artefaktsynchronisations-Workflows wurden vor beiden Merges entfernt. Main-Merges ändern **nicht** automatisch den bestehenden signierten separaten Bootstrap-Release-Kanal; für neuen Release gilt weiterhin die vorhandene Signierpipeline. Es wurde keine Live-/Dauerabnahme durchgeführt.

**Weiterer Arbeitsfilter:** W02/W03/W04 übrige Restgrenzen, W05/W08 übrige Restgrenzen, W07/N01/G12, W06/G09, W10/W13/G03/G04, N05/N10, W12/N11/N12/G06/G07/G08 sowie W14-Liveabnahme bleiben offen, soweit die Übergabedokumente sie ausdrücklich so einstufen. N14 nur passiv/optional, N15 nur bei reproduziertem Fehler. Für W02 keinen zusätzlichen Accountbedarf oder neuen Verkaufsüberschuss ohne nachgewiesenen endlichen Mengen-/Variantenvertrag erfinden.

---

## Bereits im untersuchten Main enthalten

Nicht nochmals implementiert wurden:

- Signierte Normal-/Overflow-Kapazität einschließlich Stackheadroom.
- Lokale explizite Mengenobergrenze über `keep + excessAction=sell`.
- Begrenzte Slotfolgenplanung für unterstützte Bank-/Compoundwege.
- Persistente Bank-Store-, Swap-, Einzel-, Teilentnahme- und Reclaim-Recovery.
- Regelmäßiger Bankscan für ausdrücklich zum Verkauf freigegebene Bestände.
- Authentifizierte Koordination konkurrierender Bankzugänge.
- Endliche Liefermengen mit persistenten Delivery-Receipts; Crafting-, Upgrade-, Compound- und Beschaffungsplanung.
- Gear-Kompatibilität, Mindestverbesserung, kontrollierte Zuteilung und Equipquittierung.
- Level-Aufholrotation und Browserwechsel mit gespeichertem laufendem CODE-Slot.
- Bossmechanikadapter, Priest-Heilung und Ranger-Gruppenhilfe.

Die vorhandene Recovery konnte insbesondere bereits echte unbekannte Wertwirkungen sperren. Ein fehlender Fortschritt darf nicht durch blindes Journal-Löschen oder nochmaliges Kaufen/Mutieren „repariert“ werden.

## In PR #167 tatsächlich ergänzt

| Bereich | Änderung und tatsächliche Grenze |
| --- | --- |
| Aktionskosten G02 | Gemeinsamer Executor prüft vor Invoke und Wertjournal eine konservative Kostenreserve. Vier-Sekunden-Fenster, aktuelle `character.cc`, lokale Kostenschätzungen, teure Ponty-/Tracker-Aufrufe und CM werden berücksichtigt. Normale Schwelle 160, Überlebensreserve separat, maximal 190. Keine Behauptung eines vollständigen Simulators sämtlicher nativer Socketfolgen. |
| Conditions G10 | Stoned, Stun, Silence und bekannte `G.conditions[*].blocked` wirken auf Dispatch, Fähigkeiten, Neutralpulls und Heil-/DPS-Kredit. Eine versteinerte Figur bleibt als möglicher Schadenempfänger im Modell. Livewerte enthalten Debuffs bereits; keine zweite Statmultiplikation. |
| Tränke N02 | Wirksamer HP-/MP-Anteil inklusive Dualtränken wird bewertet. Die vorhandene absolute Schwelle über 300 bleibt. Town/Fishing/Mining werden normalerweise respektiert; nur beobachtete akute Eigengefährdung unter 35 % HP erlaubt Unterbrechung. Slot, Variante, Ressourcen und Tod werden unmittelbar vor Dispatch neu geprüft. |
| Eventgrace N03 | Fehlende Beobachtung ist für 2500 ms `unknown`; bestätigtes Ende, Definitions-/Risikowechsel und alte Ablaufzeit bleiben verbindlich. Während Ungewissheit weder neue Reise noch neuer neutraler Pull. |
| Abreiseloot N04 | Vor längerer normaler Reise/Realmwechsel eine begrenzte Sammelgelegenheit. Nur sichtbare, erreichbare Truhen mit belegtem Platzbedarf. Nach 3500 ms explizites Überspringen, 30 s lokale Sperre; Verteidigung hat Vorrang. Verschwundene Truhe bedeutet nicht „eigener Loot bestätigt“. |
| Wiederbelebung N16 | Verbrauch einer Essence of Life wird vor Dispatch persistent an beobachteten Tod gebunden. Fehlende Antwort, Reload oder kurz unsichtbarer Empfänger erzeugen keinen zweiten Verbrauch. Freigabe erst nach tatsächlich beobachtetem Leben oder verifizierter neuer Todesgeneration. |
| Gear W05 | Automatische und optimierte Ziele erhalten Aufholpriorität bei belegtem Rückstand innerhalb derselben Klasse. Explizite Zielprioritäten bleiben erhalten. Das ist noch kein vollständig rollenübergreifender Account-Stärkescore. |
| Betriebsvorräte W02 | Ungeregelte, normale und NPC-ersetzbare Standardtränke, scroll0/1, cscroll0/1 und einfache Klassenelixiere erhalten endliche Mengen. Vorratsboden deckt das ganze konfigurierte Farmerteam; Produktionsreserve kommt hinzu. Explizite Regeln, Varianten, seltene Items und nicht nachgewiesene Quellen bleiben geschützt. |
| Bank W04 | Regelmäßiger Scan darf auch solche Betriebsüberschüsse sowie explizites `keep + excessAction=sell` über den vorhandenen Reclaim-Pfad verarbeiten. Der komplette Schutzboden muss schon physisch im Merchantinventar liegen. Aufbewahrte Bankkopien sind keine Verkaufsdeckung. Vor Entnahme, nach Entnahme und vor NPC-Verkauf erneut prüfen. |
| Bankfehler | Neue Reservation nach Entnahme: bei vollständig unverändertem Beleg Rücklagerung in exakt denselben leeren Bankslot. Unerklärte weitere Bestandsänderung: Quarantäne und Diagnose, keine erfundene Rücklagerung. Bei Regelwiderruf kein Downgrade auf Notverkauf. |
| CBurst N07 | Bis zu 16 eindeutige positive Ganzzahl-Manazuteilungen; nur bereits freigegebene Ziele. Neue Mehrzielauswahl zieht ausschließlich schon am eigenen Team gebundene Gegner hinzu. MP-Budget und Basisgebühr werden einmal gerechnet; Resistenz/Piercing und konservative Schadensuntergrenze fließen ein. Jeder Zielzustand wird beim Dispatch neu geprüft. |
| Booster N06 | Optional bereits aktive eigene Booster nach Farmziel umschalten; separate Option startet die Ablaufzeit inaktiver Booster. Kein Cashkauf. Varianten-/Expiry-Guard, Journal und dauerhafte Umschaltfrist. Keep und Locks verbieten Mutation. |
| Blink N08 | Optional auf einem bereits direkt begehbaren lokalen Reiseabschnitt, maximal 600 Pixel, ohne eigene Aggro/Instanz/Kanal, mit mindestens 50 % verbleibendem MP und frischem Cooldown-/Landepunktnachweis einschließlich servergleicher 10-Pixel-Rundung. Kein Überspringen unbekannter Wände oder nativer Routenknoten. |
| Interception N13 | Endlicher lokaler Vorhaltepunkt, höchstens 1,2 s und 60 Pixel, mit stationärem/fehlendem Bewegungs-Fallback. Weiterhin bestehende Kollisions- und Gefahrenguards. Kein unbeschränktes quadratisches Raten. |
| Reise G04 | Optionale Populationswechsel mit unbelegtem Hop-Sickness-/Fatigue-Nutzen werden bei hochleveligen Nicht-Merchants zurückgestellt. Manuelle Vorgaben, Heimkehr und bestehende bestätigte Druckflucht bleiben möglich. Keine Homeänderung und kein behauptetes Clear nach Reconnect. |
| Saison N09 | Kostenlosen Holiday-Spirit nur beim sicheren Vorbeikommen an aktuell bestätigtem Baum abholen. Kein Gruppen-/Instanzabbruch dafür. |
| Systembelohnungen G03 | Authentifizierter Browserreader für `/api/pull_mail`, 40er-Pagination, exakter eigener Empfänger, ausschließlich vom Server markierte Cave-/Tracktrix-Rewards. Freier Betreff/Text wird verworfen. Öffentlicher `take_mail_item`, echte Stack-/Overflowprüfung, ID-/Variantenquittung plus Inventar-/Golddelta. Ein unbekannter Claim wird nicht wiederholt. |
| Mail-Recovery | Nach Reload nur bei serverseitigem `taken=true`, identischer eigener Belohnung und vollständigem passenden Bestandsdelta bestätigen. Unverwandte Bestands-/Goldänderungen halten die Sperre. Headless meldet den fehlenden authentifizierten Leser, statt `get_mail()` zu erfinden. |
| Build | Unveränderte 1-MiB-Grenze und 900-KiB-Gate mit dem vollen Regelkatalog. Wiederholte Stringwerte werden lokal im Runtime-IIFE gepoolt. Nur UI-Metadaten von Schemas werden für CODE verkleinert; Validierung, Defaults, Variantenfelder und vollständige Werkstattpakete bleiben erhalten. Persönliche Konfiguration wird bytegenau geschützt. |

## Einstellungen und Diagnose

Neue Felder sind im bestehenden Full/v1-Schema optional und werden für alte Profile beim Start mit Defaults ergänzt. Der gespeicherte persönliche CODE-JSON wird dafür nicht verändert.

| Feld | Default | Bedeutung |
| --- | --- | --- |
| `general.callCostCeiling` | 160 | Normale Aktionskosten vor Überlebensreserve |
| `world.eventGraceMs` | 2500 | Beobachtungslücke, keine neue Kampferlaubnis |
| `world.seasonalBuff` | true | Kostenloser Buff beim Vorbeikommen |
| `world.rewardMail` | true | Eigene Systembelohnungen bei tatsächlich verfügbarem Reader |
| `world.boosters` | false | Aktive eigene Booster umschalten |
| `world.activateBoosters` | false | Inaktive Booster mit beginnender Ablaufzeit aktivieren; benötigt auch boosters |
| `world.travelBlink` | false | Validierte lokale Mage-Abkürzung |
| `world.respectHopPenalties` | true | Unbepreiste optionale Realmwechsel zurückstellen |

`ALBot.status()` enthält `actionAdmission`, `combatLife`, `revivals`, `rewardMail` und `lootDeparture`. Bestehende APIs wie `explainInventorySlot`, `bossCatalog`, Bank-Recoverystatus und Testbericht bleiben verfügbar. Ein Reader-`supported=false` bedeutet eine konkrete Hostgrenze, keinen erfolgreich ausgeführten Claim.

Die automatische Betriebsvorratsregel gilt nur ohne explizite Itemregel. Ein explizites Keep mit `excessAction=hold` ist weiterhin ein Hold. Für Banküberschuss reicht eine gewünschte Obergrenze allein nicht; die volle Reserve muss tatsächlich getragen und die Quelle frisch beobachtet sein.

## Noch offene Roadmap-Pakete — nicht als fertig markieren

| Paket | Konkreter nächster Implementierungsschritt |
| --- | --- |
| W02/W03 | Mengenpolitik auf weitere belegte Betriebs-/Ersatzbedarfe ausweiten; ganze Folgen mit reservierten Zwischenplätzen und Recovery auch jenseits der vorhandenen Bank-/Compoundpfade. Keine fremden oder veralteten Account-Snapshots als Dispositionsrecht verwenden. |
| W04 | Banküberschuss mit zunächst noch NICHT getragener Reserve: zuerst eine endliche, persistente Reservestaging-Folge ausführen und beobachten; danach erst separate Verkaufsmenge holen. Aktueller Bot verkauft diesen Fall bewusst nicht. |
| W05/W08 | Rollen-/Slotnutzen und Wartealter über alle freigegebenen aktiven/offline Figuren normalisieren. Gleicher Waffenlevel oder rohe DPS sind kein Gleichheitsmaß für Priest, Tank und Ranger. Explizite feste Gruppen erhalten. |
| W06/G09 | Nicht selbst reproduzierbare Materialien als Markt-/Tauschbedarf erklären; endliche `trade_offer`/`trade_swap`-Absichten mit beiden Varianten, Mengen, Wertseiten und Listing-RID. Kein permanenter unbeschaffbarer Auftrag. |
| W07/N01/G12 | Eigener Tailoring-Mutationstyp an konkreter Gearzuteilung. Stat-Scrollmengen nach realem Gradevertrag, frische Servervorschau, Budget, alte/neue Identität und Ergebnisfenster. Optional De-Statting mit tatsächlichem Rückgabescrollplatz und Preis. Menschliche Locks niemals automatisch öffnen. |
| G03 | Authentifizierter Mailreader für den vorhandenen Headless-/Mainframe-Host ist nicht belegt. Solange er fehlt, Diagnose behalten; keine neue Pflichtplattform, Secrets oder erfundene CODE-API. Persönliche Truhenkoordination und vollständige accountweite Rewardallokation sind noch nicht fertig. |
| G04/G05 | Kontoweite Realmfolgen und reale Encouragement-Nettoerträge mit flexibler Gruppengröße vergleichen. Merchant gesondert behandeln; beobachtete Boni nicht zweimal auf Loot multiplizieren. |
| N05/N10 | Kleiner realmgebundener Respawnkalender aus echten Sicht-/Todesereignissen, endlicher Scout mit negativer Beobachtung und Ablauf. Danach erst temporärer Temporal-Orb-Besitz, Cast und beobachtetes Restore. Eine Prognose ist keine Livesichtung. |
| W12/N11 | Vollständiger begrenzter Crypt-Run: Gruppen-/Gearbereitschaft, Schlüsselöffnung mit eigenem Journal, Instanzbindung, Kampfmechanik, Lootabschluss, Recovery und Exit. |
| W12/N12/G06/G07 | Vollständiger Caveadapter: `cave_info`-Berechtigung/Resume, ursprüngliche maximal drei Teilnehmer, Realm/Run/Floor, serverbezogener Reset, `remaining_ms`/`paused`, aktuelle Voteoptionen und Kosten. Cavepurse und Amber sind eigene Währungen. Nera-Respawn und endgültiger Exit sind unterschiedliche Pfade. Kein Exit aus Disconnect ableiten. |
| G08 | Many Eye bleibt wegen nicht modellierter Stone-Mechanik abgelehnt. Mimic/Pale Dino sind jetzt im Bosskatalog; nur reale Gelegenheit und vollständige bestehende Readiness erlauben Kampf. Globale variable Schwellen sind kein eigener Kill-Countdown. |
| W10/W13 | Semantischer Fortschritt für sämtliche Auftragsarten und vollständige rollenverteilte Lootmission. Aktueller Abreise-Timeout ist eine begrenzte Gelegenheit, kein vollständiges eigenes Lootreceipt. |
| N14/N15 | Lucky-Slot nur passiv aus ohnehin stattfindenden Mutationen bewerten. Keine zusätzlichen Würfe. Endpunktconnector erst bei reproduziertem Restfehler der aktuellen nativen Route; keinen zweiten Pathfinder bauen. |
| W14 | Neuer zusammenhängender Live-/Dauertest mit Merchant-/Bankdruck, ungeklärten Antworten, Tod/Revive, Restart, Definitionswechsel und Browserrotation. Kein Offlineergebnis als Livebeleg ausgeben. |

## Bereitstellung für den Livetest

`main/bot.js` enthält nach dem Merge die neu gebaute gemeinsame Runtime mit unveränderter persönlicher Konfiguration. `dist/albot.runtime.js` ist dieselbe Runtime ohne persönlichen JSON-Vorspann; die Werkstatt enthält das vollständige Paket.

**Der installierte signierte V2-Loader verwendet weiterhin den bestehenden Release-Branch; dieser wurde anschließend auf ausdrücklichen Benutzerwunsch auf `0.10.11-candidate` (sequence 4) veröffentlicht.** Maßgeblich sind [BOOTSTRAP-VERTRAG](BOOTSTRAP-VERTRAG.md) und [bootstrap.contract.json](../bootstrap.contract.json). Die vorhandene Pipeline baut und testet die Runtime, erhält persönliche Einstellungen und signiert das neue Manifest mit dem bestehenden Releaseschlüssel. Der vorhandene Bootstrap lädt beim nächsten CODE-Start die neue Version; keine Neuinstallation erforderlich. Signatur-/Hashprüfung bleiben unverändert. Kein neuer Ingame-Ladevorgang beobachtet. Weitere Roadmap-Implementierung wurde auf Benutzerwunsch gestoppt.

## Nachweise und Primärquellen

Build/Tests erfolgen ausschließlich in GitHub Actions; keine lokale Installation oder Dateiänderung für diesen Auftrag. Der finale Linux-/Windows-Lauf ist im [PR #167](https://github.com/Riflex91/ALBot/pull/167/checks) dem jeweils aktuellen Head zugeordnet. Frühere fehlgeschlagene Läufe sind keine Abnahme; unter anderem wurden Profilkompatibilität, Bundlegröße und die Unterscheidung zwischen neuer Reservation und unbekannter physischer Bankdrift gezielt geprüft. Alle neuen Regressionen liegen unter `test/`. Liveprüfung bleibt offen.

- [ALBot-Baseline und bestehende Arbeitsverträge](https://github.com/Riflex91/ALBot/tree/2d0ce11243c273a6445765d9c28a4c760f20e0e2).
- [Offizielle Callkosten, vier Sekunden, Mailclaim, Stat-/De-Statting- und Boosterhandler](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/node/server.js).
- [Öffentliche CODE-Funktionen: Loot, Claim, Shift/Activate und Cave](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/js/runner_functions.js).
- [Authentifizierte Mailpagination und serverseitige Empfängerfelder](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/api.js).
- [Offizieller Browser-API-Helper entfernt infs aus seinem Promise-Ergebnis](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/js/functions.js); der neue Port benutzt deshalb die gleichen authentifizierten AJAX-Parameter und verwirft freie Texte, statt die Mail-UI oder globale Handler zu übernehmen.
- [Conditions einschließlich Stoned](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/design/conditions.js).
- [CBurst, Blink und Revive](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/design/skills.js).
- [Many Eye, Mimic und Pale Dino](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/design/monsters.js).
- [Cavezustand, ursprüngliche Empfänger, Purse und Mailpayout](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/node/logic/cave_of_many_dreams.js).
- [Caveberechtigung, serverbezogener Tagesreset und Resume](https://github.com/kaansoral/adventureland_mongodb/blob/2148cf25d01060f54bcab01dfa7c2cf5b7baf374/node/logic/generated_maps.js).
