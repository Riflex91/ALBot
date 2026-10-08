# Erneuter Quellvergleich: v3/v4 und ALBot 0.7.0

Stand: 8. Oktober 2026. **ALBot hat noch nicht alle fachlichen Abläufe von v3/v4 gleichwertig implementiert.** 0.7.0 erweitert die Grundfunktionen erheblich, schließt aber nicht sämtliche Unterschiede. Die bisherige Formulierung „alle Auditpunkte umgesetzt“ war als Aussage vollständiger Funktionsgleichheit zu weitgehend.

## Prüfgrundlage und Grenzen

- ALBot: `f0da199203f0a0224bb238af33255259b3c3e481`, Runtime `0.7.0-full`.
- Referenzrepository: `43bcdee99ab12a92f7cbf8e7bcdac8f0e99983f2`; v3 `3.0.0-alpha.20.149`, v4 `4.0.0-alpha.0`.
- Strukturinventar: sämtliche 239 JavaScript-Dateien unter `v3/src` (68.760 Zeilen) und 111 TypeScript-Dateien unter `v4/laufzeit/quelle` (18.240 Zeilen). [Modulinventar](V3-V4-MODULINVENTAR-0.7.0.csv) enthält Pfade, Zeilenzahl, maschinell erkannte Symbole und Importe. Das Inventar ist keine Behauptung einer manuellen Prüfung jeder Hilfszeile; Importerreichbarkeit allein beweist keine aktive Ausführung.
- Fachprüfung: Einstieg, Komposition, nachträgliche Installer, konkrete Entscheidungen, Ausführungswege und Ergebnisabgleich mit den entsprechenden ALBot-Pfaden. Zusätzliche gezielte Offline-Reproduktionen für drei Mengen-/Integrationsgrenzen; keine Shadow-Tests, kein Login, keine Spielaktionen.
- ALFinal und v5 wurden in diesem Folgeaudit nicht erneut vollständig geprüft. Alte Livebestätigungen ersetzen keine neue gemeinsame Bestätigung des aktuellen Bots. Vorliegende Logs waren nicht Gegenstand dieses Auftrags.

Bewertungen: **Vorhanden** bezeichnet den beschriebenen Grundablauf, keine identische Umsetzung aller historischen Sonderfälle. **Teilweise** bedeutet einen konkret benannten Verhaltensunterschied. **Fehlt** bedeutet, dass kein entsprechender integrierter Entscheidungsablauf gefunden wurde. **Ausgeschlossen** bezeichnet vom Nutzer ausgeschlossene Infrastruktur, keine nachzuholende Spielfunktion.

## So arbeiten die Referenzen tatsächlich

### v3: geschichtete Runtime mit späteren Verhaltenskorrekturen

`src/composition/runtime-composition.js` setzt Runtime, Stability sowie Alpha9–Alpha20 und Alpha20.5 zusammen. Methoden späterer Schichten überschreiben frühere Methoden; Konstruktoren richten die Fachservices ein. Ein Vergleich nur mit den ersten Farmer-/Merchant-Modulen reicht deshalb nicht.

`src/index-production.js` ergänzt Produktionsplanung/-ausführung und ruft `installProductionLiveServices` auf. `src/production-live-services.js` installiert anschließend Alpha25/26, Alpha27-Konvergenz, Merchant-Ownership und Reiseintelligenz, P0-Nachschub-/Potionkorrekturen sowie **Alpha31, Alpha32 und Alpha33**. Die Tick-Verkettung und gepatchten Methoden bestimmen das spätere Verhalten. `src/reliability/integrated-party-control.js` installiert außerdem Pull-Lernen, Encounter-Lifecycle, AoE-Eignungsprüfung, taktischen Gruppenkampf, fortgeschrittene Bewegung und Party-Skill-Engine.

Der fachliche Zusammenhang ist: aktueller Gruppen-/Skillzustand → geeigneter Farm-/Produktionsauftrag → Encounter-/Pullentscheidung → Bewegung und Skills → beobachtetes Ergebnis → erneute Bewertung. Beim Merchant: Bestände und Bedarf → wirtschaftliche Disposition/Produktionsgraph → einzelne begrenzte Bank-/Kauf-/Mutations-/Lieferaktion → Ergebnisabgleich und Wiederanlauf. Alpha33 ergänzt insbesondere Mark-Zuständigkeit, Orbit-Bewegung und bestätigte Ausrüstungslieferung mit anschließender Farmer-Ausrüstung.

Viele ältere Modulkonstanten heißen weiterhin `shadow-*`. Das ist allein weder Beweis einer aktiven Mutation noch Beweis fehlender späterer Einbindung. Dieser Audit verfolgt die Installer und Verbraucher; er führt diese alten Verfahren nicht aus und übernimmt keine Shadow-Infrastruktur.

### v4: Verträge, Planungsmodelle und begrenzte Ausführungsbrücken

`laufzeit/quelle/index.ts` ist ein Exportverzeichnis, kein Vollbetriebs-Loop. Die fachlichen Schwerpunkte sind normalisierte Spielbeobachtung, Skillkatalog/-Policy, technisch verfügbare Fähigkeiten, vertrauensgebundene Capability-Synchronisierung, Gruppenrollen und konkrete eigene Aktionsanfragen. `kern/aktions-auswahl.ts` ordnet Anfragen nach Wichtigkeit, Priorität und Eingangsreihenfolge; Steuerung und Ressourcenbesitz begrenzen die Ausführung.

`ausfuehrung/adventure-land-produktions-einstieg.ts` und `adventure-land-produktions-bootstrap.ts` verlangen für aktiven Betrieb eine ausdrückliche Konfiguration/Fähigkeitsvorgabe. Gruppenziel-Vorbereitung und Live-Ausführungsbrücken sind eigene begrenzte Wege. Der Block8.6-Candidate kombiniert Produktions- und Capability-Runtime, deklariert selbst aber `spielAutoritaet: false` und `neustartAutoritaet: false`.

**v4 ist kein zweiter vollständiger autonomer Merchant-/Produktionsbot.** Seine Modelle werden unten als Modelle verglichen; aus einem exportierten Modell wird keine angeblich historisch bewährte Spielfunktion. Freigabetexte, Replay-/Evidence-Verfahren und Telemetrie sind keine erforderlichen Funktionen des gewünschten ALBots.

## Breitenabgleich der Spielfunktionen

ALBot-Pfade beziehen sich auf `src/`. Die detaillierten Unterschiede D01–D15 folgen im nächsten Abschnitt.

| Bereich | ALBot-Pfad | Ergebnis |
|---|---|---|
| Ein Bot pro Charakter, Start/Stop, Bereinigung | `main.mjs`, `runtime/ports.mjs` | Vorhanden |
| Browser/Headless-Erkennung, Browser-Performance-Trick | `main.mjs`, `runtime/ports.mjs` | Vorhanden; Headless übernimmt der Client |
| Loot, Einzelkampf, gemeinsames Fokusziel | `combat/farmer.mjs`, `party/transport.mjs` | Vorhanden |
| Automatische Monster-/Spawnwahl und EXP-/Goldwertung | `world/team-plan.mjs`, `world/strategy.mjs` | Vorhandene Grundautomatik; D01/D12 begrenzen die Gleichwertigkeit |
| Standortdruck, verlorene Kills, Wechselhysterese | `world/team-plan.mjs`, `combat/threats.mjs` | Vorhandene Grundautomatik; D12 |
| AoE-Skills und Aggrogrenze | `combat/skills.mjs`, `world/risk.mjs` | Teilweise: D01 |
| Lernen geeigneter Pullgröße, taktische Encounter-Phasen | `world/team-plan.mjs` | Fehlt als entsprechender Ablauf: D01 |
| Rückzug, Kiting, Erholung, Respawn | `combat/farmer.mjs`, `core/movement.mjs` | Vorhandene Grundaktionen; D02/D05 |
| Terrainkorrektur und verankertes Aggro-Orbit | `core/movement.mjs`, `combat/farmer.mjs` | Teilweise/fehlende Spezialabläufe: D02 |
| Klassenrotation, Unterstützung, individuelle Skillregeln | `combat/skills.mjs`, `config/full.mjs` | Vorhanden; D04/D13 |
| Hunter’s Mark: aktive Wirkung respektieren | `combat/skills.mjs` | Vorhanden über `condition: marked`; gemeinsame Zuständigkeit fehlt: D04 |
| Partyaufbau, Leader/Follower, Heartbeat und Sitzungen | `main.mjs`, `party/transport.mjs`, `party/account.mjs` | Vorhanden; vertiefte Fähigkeitenwahl D13 |
| Transport, Serverwechsel, Magiport, Catch-up/Accountwahl | `party/travel.mjs`, `party/account.mjs`, `world/servers.mjs` | Vorhanden, konfigurations-/beobachtungsgebunden; Reiseoptimierung D03 |
| Paladin-Aura und Gruppenbuffs | `party/aura.mjs`, `combat/skills.mjs` | Vorhanden |
| Automatische HP-/MP-Potions und Regeneration | `combat/farmer.mjs` | Vorhanden; Ressourceneffizienz D05 |
| Klassen-Elixiere, Beschaffung, Lieferung, Equip-Abgleich | `items/elixirs.mjs`, `production/production.mjs` | Vorhandene Grundautomatik |
| Gemeinsamer Item-Regelsatz mit Rolle/Charakter/Level/Schutz | `core/policy.mjs`, `merchant/economy.mjs`, `items/logistics.mjs` | Vorhanden |
| Lokale Werkstatt, Katalog, Item-/Skillregeln, Bundleexport | `editor/`, `ui/panel.mjs` | Vorhanden; alte Skill-Spezialparameter D15 |
| Nachschub, Loot-Abholung, Goldreserven, genauer Empfänger | `items/logistics.mjs`, `items/gold.mjs` | Vorhandene Grundabläufe; bewegte Serviceziele D14 |
| Offer/Accept/Send/Receipt/Done, unbekannter Transfer hält an | `items/logistics.mjs`, `core/recovery.mjs` | Vorhanden; Gear-spezifische Zusage D08 |
| Bankkatalog, Ein-/Auslagern, Teilentnahme und Rücklagerung | `merchant/bank.mjs` | Vorhanden |
| Bankgold, Zusammenlegen, Packwahl, Kapazitätsbudget | `merchant/bank.mjs` | Vorhanden; Freigaberettung teilweise D10 |
| NPC-Kauf/-Verkauf | `merchant/economy.mjs` | Vorhanden |
| Stand, Listings, Wishlist, Spieler-Kauf/-Verkauf | `merchant/market.mjs`, `merchant/controller.mjs` | Vorhanden |
| Preisgrenzen/-vergleich, Angebotsgeschichte, Ponty/Schnäppchen | `merchant/market.mjs` | Vorhandene begrenzte Angebotsauswertung; kein Nachweis verkaufter Marktangebote |
| Giveaways | `merchant/market.mjs` | Vorhanden |
| Mluck-Erneuerung und Anreise | `merchant/controller.mjs` | Vorhandene Grundautomatik; Reise-/Servicevergleich D03/D14 |
| Fairness zwischen Merchant-Aufträgen und Nachschub | `merchant/controller.mjs`, `core/fair-tasks.mjs` | Vorhanden; globale Arbitration D11 |
| Fishing/Mining, Werkzeugwechsel/-rückwechsel | `merchant/services.mjs` | Vorhanden |
| Merrit mit Reward-Abgleich | `merchant/services.mjs` | Vorhanden |
| Rollenbezogenes Gear, Offlineprofile, Zielausrüstung | `production/gear.mjs`, `production/intelligence.mjs` | Vorhandene Grundautomatik; D07/D08 |
| Upgrade/Compound, Scroll/Offering, Chance/Verlustbudget | `production/production.mjs` | Vorhanden; Gewinnproduktion D06 |
| Craft/Exchange, Zutaten, Station, Ergebnisabgleich | `production/planner.mjs`, `production/production.mjs` | Vorhanden; Mengenbefund F02/D09 |
| Beschaffungsgraph Bestand→Bank/Kauf/Farm→Produktion→Lieferung | `production/planner.mjs`, `production/production.mjs` | Vorhandener begrenzter Graph; D07/D09 |
| Direkte/nestierte Drops, Eventbindung, P90-Zeitschätzung | `production/materials.mjs`, `production/probability.mjs` | Vorhandene Grundmodelle; D09 |
| Gemeinsamer Materialauftrag, Fortschritt und Mengenquoten | `production/production.mjs`, `world/team-plan.mjs` | Teilweise; F01/D09 |
| Monsterhunt, Bosse/Events, Rückkehr zum Farmen | `world/strategy.mjs`, `world/risk.mjs` | Vorhanden; gemeinsame Nutzenwahl D09/D11 |
| Inhaltsfingerprints, Wiederanlauf, Aktionslocks | `world/content.mjs`, `core/recovery.mjs`, `core/executor.mjs` | Vorhandene Grundmechanismen; D11/D12 |

## Verbleibende Unterschiede mit Quellbelegen

Referenzpfade beginnen mit `v3/src/` oder `v4/laufzeit/quelle/`. Funktionsnamen und ALBot-Zeilen beziehen sich auf die oben festgehaltenen Commits.

### D01 — Adaptive Pull-/AoE-Steuerung

v3 `autonomy/adaptive-pull-learning.js` (`recommend`, ab Zeile 315), `smart-aoe-planner.js` und `tactical-party-combat.js` (`canAddTarget`, `_tryAgitatePull`, `maybeExpandPull`) berücksichtigen Lernprofile pro Pullgröße/Gruppe, HP/MP, Skillkapazität und Encounter-Phasen `RECOVER/BUILD/HOLD/BURN/FINISH/ABORT`. Die Einbindung erfolgt über `reliability/integrated-party-control.js`.

ALBot `world/team-plan.mjs:29` schätzt AoE-Dichte aus Klassenanzahl und konfigurierten Grenzen; `combat/skills.mjs:34` verwendet Mehrzielskills erst an bereits auf die Gruppe gerichteten Gegnern. Es fehlen Lernprofile für Pullgrößen, phasenabhängiges Pack-Aufbauen und dieselbe taktische Entscheidung zum Hinzupullen. Vorhandene AoE-Skills sind kein gleichwertiger Ersatz. **Priorität: hoch.**

### D02 — Terrain, Orbit und Bewegungszusammenhalt

v3 `reliability/alpha31-party-role-liveness-hotfix.js` prüft Bewegungssegmente und Orbit-Wegpunkte. `alpha32-navigation-merchant-recovery.js` ergänzt lokale Detours/gesperrte Ziele; `alpha33-mark-orbit-merchant-delivery.js` (`_trainingAnchor`, `_spiralEscape`, `_anchoredOrbitAlternative`) bindet Bewegung an einen Farmanker. `autonomy/advanced-party-movement.js` ergänzt die Gruppenbewegung.

ALBot `combat/farmer.mjs` besitzt gewichteten Mehrgegner-Rückzug, Seitenalternativen und Follow-Verhalten. `core/movement.mjs` wählt direkte Bewegung oder Host-`smart_move` und bricht bei Stillstand ab. Es fehlen die eigenen Orbit-/Spiral- und vollständigen Terrainkorrekturen. `smart_move` kann Wege lösen, belegt aber keine Gleichwertigkeit dieser Kampfbewegung. **Priorität: hoch.**

### D03 — Gemessene Merchant-Reiseoptimierung

v3 `reliability/alpha27-merchant-travel-intelligence.js` (`estimateTravelStrategy`) vergleicht WALK mit TOWN-Kanalzeit plus Restweg und berücksichtigt gemessene Zeiten/Mindestgewinn. ALBot erfasst Reisezeiten für Kostenschätzungen, führt aber keine entsprechende Town-versus-Laufen-Entscheidung aus; `core/movement.mjs` verwendet `move`/`smart_move`. **Fehlt als Fachentscheidung.**

### D04 — Hunter’s-Mark-Zuständigkeit und Effektbeobachtung

v3 Alpha33 (`_huntersMarkOwner`, Mark-Guard ab Zeile 275) wählt einen Ranger und liest auch alternative Effektcontainer/-laufzeiten. ALBot nutzt `G.skills.huntersmark.condition` und `target.s.marked` bereits korrekt als Wiederholungsbremse. Der lokal gespeicherte Spielkatalog bestätigt `condition: marked`; es wäre falsch, ALBot pauschal ständiges Nachmarkieren zu unterstellen.

Es fehlt die gemeinsame Ranger-Zuständigkeit; `world/team-plan.mjs:23` verteilt keinen Mark-Auftrag, `combat/skills.mjs:26` hat dafür keine Rollenbindung. Bei gleichzeitigem Blick auf einen noch unmarkierten Gegner können mehrere Ranger entscheiden. Alternative Effektdarstellungen sind ebenfalls nicht gleichwertig abgedeckt.

### D05 — Ressourcentopoff und Potion-Effizienz

v3 `farmer/farmer-resource-topoff-hotfix.js` bewertet Auffüllen und Potion-Ausnutzung anhand tatsächlicher Wiederherstellung; spätere P0-Korrekturen behandeln Bundle-Deltas und gemeinsame Obergrenzen. ALBot `combat/farmer.mjs` verwendet Schwellwerte, erste passende Potion und Regeneration, aber keine entsprechende an Wiederherstellungswerten orientierte Effizienzauswahl/vorbereitende Pullbereitschaft. Die historische Zahl 4500 muss nicht übernommen werden; benötigte Budgets/Grenzen sollten konfigurierbar bleiben.

### D06 — Wirtschaftliche Upgrade-/Compound-Disposition

v3 `economy/item-economic-evaluator.js` (`evaluateUpgradeEconomics`, `evaluateCompoundEconomics`, Zeilen 120–217) vergleicht unmittelbaren Verkauf mit erwarteten zukünftigen Erlösen minus Scrollkosten und berücksichtigt Ansammeln von Compound-Sätzen.

ALBot `production/intelligence.mjs:18` schließt Items mit Upgrade/Compound oder Level > 0 aus der automatischen Disposition aus. Zielgebundene Mutation ist vorhanden, aber automatische Gewinnproduktion, passende Satzbildung und wirtschaftliche Liquidation solcher Beute **fehlen**. Das Schutzverhalten ist nicht an sich ein Fehler; es ersetzt den gewünschten ökonomischen Ablauf nicht. **Priorität: hoch.**

### D07 — Accountweite Gear-Optimierung aus realem Bestand

v3 `economy/gear-progression.js` (`evaluate`, ab Zeile 317) bewertet tatsächlich vorhandene Kandidaten aus bekannten Inventaren und ihre zukünftige Kurve ab beobachtetem Level; `item-intelligence.js` und `sell-safety.js` liefern zukünftigen Gear-Schutz. Kapitallage und Risiko werden zusätzlich berücksichtigt.

ALBot `production/intelligence.mjs:10` untersucht `autoGearItems` mit basierendem `G.items[name].g`, Levelkurve und Rollenwert. Offlineprofile, Zielreservierungen und Budgets existieren. Es fehlt jedoch die gleichwertige gemeinsame Auswahl aus realem Konto-/Bankbestand mit bereits bezahltem Fortschritt, Wiederverteilung und alternativer Verkaufs-/Produktionsverwendung. Historische Fallbackchancen sind Planannahmen; lokale Mutation prüft separat die tatsächliche Vorschau. **Priorität: hoch.**

### D08 — Ausrüstungslieferung bis zum bestätigten Empfänger-Equip

v3 Alpha33 (`_prepareGearDeliveryIntentAck`, `_acceptGearDeliveryIntentAck`, `_acceptGearDeliveryIntent`, Farmer-Equip/Reservation und Freigabe alter Ziele) koppelt Ziel-ID, Empfänger, Equipment-Slot und Vorlieferungszustand. Der Farmer bestätigt die Gear-Absicht und rüstet danach passend aus.

ALBot `production/allocation.mjs` bindet Sender-Slot/Fingerprint und Empfängersitzung; generische Logistik bestätigt den Transfer. Der aktuelle Equipment-Slot des Empfängers ist kein entsprechender Teil der Zusage. Konfigurierte Equip-Ziele werden lokal ausgeführt, automatische Gear-Auswahl und Transfer-Receipt belegen aber nicht, dass genau der zugesagte Upgrade-Slot anschließend eingerichtet wurde. **Teilweise; Priorität hoch.**

### D09 — Material-/Produktionsziele vollständig gemeinsam entscheiden

v3 `party/production-material-acquisition.js` zieht Farmer-/Merchant-/Bankbestand von risikoangepasstem Exchange-Input ab (`riskAdjustedInputUnits`, Zeile 311) und vergleicht mehrere blockierte Produktionsziele nach Nutzen pro P90-Farmstunde (`chooseProductionTeamFarmObjective`, Zeile 679).

ALBot besitzt einen begrenzten Graph, P90-Kostenschätzung, Fortschritt und gemeinsame Plan-ID. Dennoch:

- `production/planner.mjs:39` berechnet tatsächlich geplanten Exchange-Input aus dem Erwartungswert; P90 in `production/costs.mjs` verändert diese Inputmenge nicht. Nachplanung existiert, ist aber keine gleichwertige P90-Beschaffungsentscheidung.
- `production/production.mjs` nimmt das erste machbare Ziel nach Priorität und den ersten Farm-Schritt; `world/team-plan.mjs` nimmt den ersten Materialauftrag. Eine gemeinsame Grenznutzenbewertung aller Produktionsziele fehlt.
- Materialbedarf verdrängt gewöhnliche Weltaktivitäten grundsätzlich. EXP, Quest, Boss/Event und Produktionsnutzen werden nicht durchgängig in derselben Nutzenentscheidung verglichen.
- Mengenquoten sind im Angriffsweg nicht individuell wirksam: F01.

**Priorität: hoch.** Event-/Quest-Grundfilter und eine probabilistische Zeitschätzung sind bereits vorhanden; sie dürfen nicht erneut als vollständig fehlend gelistet werden.

### D10 — Bankdruck wirtschaftlich beheben

v3 `economy/bank-capacity-manager.js`, `controlled-merchant-space-recovery*.js` und `merchant-space-recovery-journal.js` bilden eigene Planung/Wiederanlauf für Freigaberettung und Konsolidierung.

ALBot `merchant/bank.mjs` kann speichern, teilentnehmen, rücklagern, konsolidieren, budgetiert erweitern und Bestand mit expliziter Verkaufsregel freigeben. `reclaim` ab Zeile 90 verlangt aber ausdrücklich eine passende NPC-Verkaufsregel ohne Reserven. Wirtschaftliche automatische Disposition aus D06/D07 und eine daraus abgeleitete gemeinsame Rettungsplanung fehlen. **Grundaktionen vorhanden; vollständige autonome Kapazitätsrettung teilweise.**

### D11 — Globale Arbitration auf Aktionsebene

v4 `kern/aktions-auswahl.ts`, `aktions-steuerung.ts` sowie `spiellogik/gruppen-aktionsanfragen.ts` modellieren konkrete Anfragen, Wichtigkeit, Ressourcen und ausgewählten Ausführer. Diese Modellfunktion ist unabhängig vom Umfang historisch freigegebener Spielaktionen.

ALBot `core/priority.mjs` sortiert Modul-Callbacks. `main.mjs:119` führt Teamreise/Verhalten und Logistik davor aus; Planung und weitere Aktionen folgen danach. Combat ist nicht exklusiv, Merchant hat zusätzlich eine eigene Fairnessauswahl. Ressourcenlocks sind vorhanden, aber **keine alle Produzenten erfassende Anfrageauswahl**. Es fehlt die entsprechende gemeinsame Entscheidung bei konkurrierenden Reise-, Kampf-, Nachschub-, Produktions- und Weltaufträgen. **Priorität: hoch.**

### D12 — Wissensalter und semantische Inhaltsänderungen

v3 `world/knowledge-aging.js` senkt Vertrauen alter Leistungsdaten und bindet Risikoneubewertung an Gruppenfingerprints. `content-drift.js` und `farmer/content-safety.js` behandeln Inhaltsänderungen differenzierter.

ALBot `world/team-plan.mjs` speichert Standortgeschichte nach Realm, UTC-Stunde und Spawn. Eine gleichwertige Alterungs-/Gruppen- und Equipmentbindung fehlt. `world/content.mjs` erkennt geänderte Hashes, pausiert maximal zehn Sekunden und gibt eine stabile Definition automatisch wieder frei. Das ist eine sinnvolle Invalidierung, aber keine semantische Einstufung nach Änderungstyp und erforderlicher neuer Erkenntnis. **Teilweise.**

### D13 — Technisch aktuelle Fähigkeiten für Gruppenrollen

v4 `spiellogik/charakter-faehigkeiten.ts` (`resolve`) unterscheidet strukturell vorhandene, technisch bereite, konfigurierte und aktuell automatisierbare Skills. Capability-Sync/-Gruppenwahl bindet Rollenentscheidungen an Snapshotgeneration, Vertrauen und Sicherheitszustand; konkrete Gruppenpläne nennen den Ausführer und die Aktion.

ALBot `world/team-plan.mjs:21` wählt Rollen vorwiegend anhand Klasse, Skillname und HP-Verhältnis. Lokale Skills prüfen Mana, Cooldown, Waffe und Reichweite **erst bei Ausführung**. Der gemeinsame Rollenplan synchronisiert diese momentane Ausführbarkeit nicht gleichwertig. Eine gewählte, lokal nicht bereite Rolle bedeutet nicht automatisch einen neuen Träger. **Teilweise.** Die Übernahme der alten Freigabebürokratie ist dafür nicht erforderlich.

### D14 — Bewegte Serviceziele und Nachschubbereitschaft

v3 `party/moving-target-freshness.js` berechnet Positionsunsicherheit aus Geschwindigkeit und Meldungsalter; Merchant-Serviceplanung nutzt passende Budgets und Ressourcenreichweite. Alpha32/33 ergänzen Nachschub-/Abholungswiederanlauf und Rollen-Liveness.

ALBot besitzt frische Heartbeats, aktuelle Transferdistanz/-identität und priorisierte Logistik. Eine gleichwertige bewegungsabhängige Rendezvousplanung fehlt. Außerdem lehnt `world/strategy.mjs:25` Serviceanreise bei `h.threats > 0` pauschal ab. Das ist ein vorhandener konservativer Schutz, kann aber Nachschub im laufenden Farmkampf verzögern; ohne Laufzeitbelege wird daraus kein behaupteter dauerhafter Stillstand. Es fehlt die differenzierte sichere Servicebereitschaft einschließlich Bewegungsunsicherheit. **Teilweise.**

### D15 — Skill-spezifische Semantik in Werkstatt und Runtime

v3 `autonomy/skill-catalog-service.js`, `skill-policy.js`, `party-skill-engine.js` und v4 `spiellogik/skill-policy-semantik.ts` verwenden Skill-spezifische Parameter, etwa Mindestzahl verletzter Mitglieder, Mindestziele und Mana-Budgetanteile.

ALBot hat einen unterstützten Skillkatalog, allgemeine Bedingungen, Zielwahl, MP-Reserve, Intervall und maximale Zielzahl. Standardrotationen enthalten jedoch weiterhin feste Schwellen; Mehrzielausführung hat eine allgemeine Mindestzahl von zwei. Eine allgemeine Bedingung bildet nicht jeden gemeinsamen Skill-spezifischen Parameter und jede konkrete Entscheidung der Vorgänger ab. **Teilweise; diese Restparameter gehören in den bestehenden gemeinsamen Werkstattvertrag.**

## Drei konkrete Implementierungsbefunde

### F01 — Individuelle Materialquoten werden vom gemeinsamen Zielpfad umgangen

Quellpfad: `production/production.mjs:166` prüft eine individuelle Quote in `farmTargets`. `world/strategy.mjs:77` liefert bei Teamplan jedoch vorher direkt dessen Ziel zurück. `main.mjs:89` verwendet `teamPlan.wantsCombat`, das nur gemeinsame Erfüllung (`remaining === 0`) prüft.

Gezielte Offline-Reproduktion mit der echten `createStrategy`-Funktion: gemeinsames Ziel `bee`, lokale Quotenfunktion würde kein weiteres Materialziel liefern. Ergebnis: `targets = ["bee"]`, **Aufrufe der Quotenfunktion: 0**. Keine Spielaktionen.

Folge: Die gemeldeten Quoten begrenzen nicht eigenständig neue Pulls je Farmer. Die gemeinsame Mengenbremse ist vorhanden; ein bereits laufender Kampf darf weiterhin beendet werden. Für eine verbindliche individuelle Mengenregel muss dieselbe Prüfung im gemeinsamen Ziel-/Angriffsweg greifen. Dieser Befund ist nicht durch die vorhandenen Quotenfelder erledigt.

### F02 — Craft-Batches werden als Outputmenge behandelt

Quellpfad: `production/planner.mjs:29–31` setzt beim Craft-Schritt `quantity = batches`. `production/production.mjs:45` verwendet diese Zahl zur Ableitung von `targetCount/maxCount`. `craft` in Zeile 88 prüft dagegen tatsächliche Outputmenge plus `yieldCount` gegen diese Grenzen.

Gezielte Offline-Reproduktion mit dem echten Planner: Bedarf 10 Outputs, Rezept liefert 5 je Craft, Zutaten sind planbar. Planner erzeugt 2 Batches; die abgeleitete Zielgrenze wird 2; der nächste Output von 5 wird verweigert. Batchanzahl und Itemmenge benötigen unterschiedliche Größen.

**Wichtige Eingrenzung:** Im lokal gespeicherten Spielkatalog `17478` wurde kein Rezept mit `q/quantity > 1` gefunden. Damit ist dies ein reproduzierbarer Fehler des unterstützten Rezeptmodells, kein belegter aktueller Stillstand eines solchen Live-Rezepts. Die Aussage „alle Rezepte konsistent“ ist dennoch nicht gedeckt.

### F03 — Follower erneuern Ablaufzeit und Rollen bei gleicher Plan-ID nicht

Quellpfad: `world/team-plan.mjs:25`. Follower übernehmen `next` ausschließlich, wenn noch kein `current` vorliegt oder die ID unterschiedlich ist. Bei einem gültigen Leaderplan mit derselben ID erneuern sie weder `expires` noch `roles`. Der Leader verlängert dagegen seine bestehende Plangültigkeit, ohne dafür eine neue ID zu erzeugen.

Gezielte Offline-Reproduktion mit der echten `createTeamPlan`-Funktion und einer kontrollierten Uhr: Follower übernimmt Plan `same-plan`, Ablaufzeit 2000, Heiler `Priest1`. Bei Zeit 2500 sendet der Leader dieselbe ID mit Ablaufzeit 4000 und Heiler `Priest2`. Ergebnis: Follower bleibt bei Ablaufzeit **2000**, `target()` liefert **null**, Rolle bleibt **Priest1**. Der neue Leaderplan ist weiterhin gültig. Keine Spielaktionen.

Folge: Ein anhaltender gemeinsamer Plan kann beim Follower nach dessen anfänglicher TTL als Ziel ausfallen; geänderte Zuständigkeiten kommen nicht an. Frische und Rollen müssen auch für dieselbe Plan-ID übernommen werden, während Zielwechsel-Effekte nur bei tatsächlicher Änderung stattfinden. **Priorität: hoch; vor einem längeren gemeinsamen Livetest korrigieren.**

## Bewusst nicht nachzubauen

- Optionaler Updater, Cloud-Release-/Präsenzsteuerung, eigener Headless-Host.
- Telemetrieplattform, vollständiges Log-/Archivsystem und Object Storage. Kompakte Testprotokolle bleiben vorhanden.
- Shadow-/Replay-Testinfrastruktur, historische Freigabezeremonien, Evidence-/Zertifizierungsablage. Fachliche Entscheidungslogik wird hiervon getrennt betrachtet.
- Historische UI genau nachzubauen ist kein Funktionsziel; die bestehende lokale Werkstatt und Statusanzeige erfüllen die entsprechenden Bedienaufgaben. Fehlende fachliche Parameter aus D15 bleiben trotzdem offen.

## Korrigierter Entwicklungsstand

0.7.0 ist ein integrierter Vollbetriebs-Kandidat mit vielen vorhandenen Spielfunktionen, **keine nachgewiesen vollständige Vereinigung von v3/v4**. Bereits vorhandene Basiswege müssen nicht erneut gebaut werden. Für das Ziel vollständiger fachlicher Zusammenführung sind F01/F02/F03 und D01–D15 konkret abzuarbeiten; Überschneidungen werden gemeinsam behandelt, nicht als neue isolierte Bot-Versionen.

Sinnvolle Reihenfolge ohne neue Shadow- oder Freigabephasen:

1. Material-/Mengenintegration und Gear-Absicht bis bestätigtem Equip (F01/F02/F03, D08/D09).
2. Pull-/AoE, Fähigkeiten, Mark und Bewegungszusammenhalt (D01/D02/D04/D05/D13/D15).
3. Wirtschaftliche Disposition, reale Bestandsoptimierung und Bankdruck (D06/D07/D10).
4. Gemeinsame Aktionsauswahl, Reise-/Serviceentscheidungen und Wissensalter (D03/D11/D12/D14).

Der Auftrag dieses Audits ändert keine Runtime, persönlichen Profile oder laufenden Botdateien. Die drei Befunde wurden eingegrenzt, nicht still repariert. Ein späterer gemeinsamer Livetest bestätigt Zusammenspiel und tatsächlich verwendete Optionen; ein bestandener früherer Test bestätigt nicht automatisch diese noch fehlenden Entscheidungsabläufe.
