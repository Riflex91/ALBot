# ALBot 0.10.0-candidate – Restmodule und Abnahme

Stand: 12.10.2026. Aufbauend auf dem aktuellen Main `d33c1a2` und den Merchant-Ergänzungen aus 0.9.0. Branch `codex/autonomous-merchant-20261012`, [PR #32](https://github.com/Riflex91/ALBot/pull/32). Dieser Stand ergänzt ausführbare Module zu den vorher dokumentierten Restpunkten. Einrichtung und Liveabnahme folgen durch den Nutzer. Er ist kein Nachweis eines fehlerfreien Dauerbetriebs oder eines Bots für jede beliebige Instanz.

Für eine andere KI: zuerst diese Datei, dann [Einrichtung](EINRICHTUNG-0.10.0.md), [Bosskatalog](BOSS-KATALOG.md), `test/completion.test.mjs`, `test/autonomous-merchant.test.mjs` und die nachfolgend zugeordneten Module lesen. Alte Statusabschnitte in README, ROADMAP und AGENTS sind historisch. Keine Journale löschen, Kostenlimits erhöhen oder persönliche Profile überschreiben, um eine Blockade zu umgehen.

## Zuordnung der vorher offenen Restpunkte

| Restpunkt | Implementierung und tatsächlicher Umfang |
|---|---|
| 1. Gleichzeitige Itemzwecke | `production/purpose-allocation.mjs`, eingebunden in `production.mjs`: Ein gemeinsames Bedarfsbuch summiert parallele Rezept-, Gear-, Reagenzien- und Werkzeugziele. Vorhandene Outputs können nur einmal einem Ziel zugerechnet werden; exakte Level und Varianten bleiben geschützt. Rekursive Upgrade-/Compound-/Craft-Bedarfe berücksichtigen Rezeptmengen. Empfängerlieferungen geben nicht gleichzeitig Zutaten für andere Rezepte desselben Empfängers frei. |
| 2. Marktabsatz | `merchant/market-demand.mjs`, `market.mjs`, `controller.mjs`: Nur bestätigte Spiel-Trade-Ereignisse zählen als Absatzbeleg. Ab drei Beobachtungen prüft der Merchant Preis, Steuer, Verkaufswahrscheinlichkeit, Standplatz-Opportunitätskosten und freie Slots. Automatische Ein-Stück-Angebote haben Ablaufzeit und Rücknahme über den bestehenden Economy-Executor. Explizite Regeln und Reserven haben Vorrang. |
| 3. Mehrschritt-Mutationen | `production/mutation-plan.mjs`, `helpers.mjs`: Endlicher stochastischer Entscheidungsbaum mit vorhandenen Exemplaren, Dreiergruppen, verbrauchbaren Scrolls/Offerings, Verlustzweigen, Stopwert und Budget. Erhaltung bei Ultimate-Upgrade wird modelliert. Erschöpfte Suche erlaubt keine Aktion. Aktuelle Helferkandidaten und finaler Dispatch benötigen echte Servervorschauen. |
| 4. Bosskatalog/Gruppe | `combat/bosses.mjs`, `world/strategy.mjs`, `party/account.mjs`, `main.mjs`: 28 Referenzprofile, Rollenpräferenzen, Schutzphasen, physische Angreifer bei Reflexion, 1-HP-Treffer, Heilung, Burn/Frost, Rime-Shell, Adds und laufende Bereitschaftsprüfung. Vorhandene Skill-, Movement-, Heal-, Recovery- und Accountrotation führen die Aktionen aus. Einzelheiten im Bosskatalog. |
| 5. Lernen | `world/adaptive.mjs`, `combat/encounter.mjs`, `world/team-plan.mjs`: Gemessene Episoden, Fehleranteil, Bewegungsausfälle, kontextgebundene Zielgewichtung und Rücknahme positiver Vorschläge nach Fehlern. Gear-/Realm-/Definitionswechsel verhindern Übertragung alter Erfolgsannahmen. Speicherung beim Stoppen; ungültige oder nicht belegte Ergebnisse werden nicht als Erfolg verbucht. Vorhandenes Aktionslernen bleibt getrennt. |
| 6. KI-Anbindung | `cloud/advisor.mjs`, Worker und Heartbeat: Optional ein festes Workers-AI-Modell, höchstens ein Inferenzversuch pro UTC-Tag. Nur begrenzte JSON-Gewichte, keine Befehle, kein Code. Lokale frische Messungen, erlaubte Ziele und Risikoprüfung müssen jeden Vorschlag erneut bestätigen. Ohne Free-Freigabe bleibt KI aus. |
| 7. Progression | Bestehendes `world/progression.mjs` und Port für `get_progression()` bleiben integriert: frische, realmgleiche, validierte Hinweise, kleine Prioritätsänderungen und lokaler Fallback. Die neuen Bedarfs-, Boss- und Economy-Guards gelten auch bei diesen Prioritäten. Keine ungeprüfte Ausführung eines fremden Plans. |
| 8. Cloud-Langzeitbetrieb | B2-Rotation mit acht bestätigten Versionen pro Snapshot-Charakter; insgesamt höchstens vier dauerhaft registrierte Namen. Erst alte eigene Version löschen, dann Ersatz hochladen. Unbekannte Wirkung sperrt das Archiv. Wiederherstellung aktueller Lernaggregate über den Worker, explizit bei gestopptem Bot. Neue Ressourcen und Secrets; kein Altimport. |
| 9. Abnahme | Offline-Tests und Builds sind umgesetzt. Der neue Browser-/Headless- und Provider-Livetest ist ausdrücklich noch vom Nutzer durchzuführen; die konkrete Reihenfolge steht in der Einrichtung. |

**Eine ursprünglich gewünschte Funktion ist nicht automatisch umgesetzt:** kontoweite Abrechnungs-/Restquotenprüfung über alle drei Anbieter und andere Projekte. Eine einheitliche, verifizierbare API für sämtliche notwendigen Caps liegt nicht vor. Statt einen Nachweis zu erfinden, sperrt der Worker ohne manuell bestätigten Free-/Kontingentstatus und nach sieben Tagen ohne erneute Prüfung. Anbieter-Hartgrenzen bleiben Voraussetzung. Ein automatischer Hinweis auf niedrige Kosten ersetzt diese Prüfung nicht.

## Merchant: Entscheidung für ein Item

1. Aktuelle `G.items`-Definition, konkrete Aktion, Identität/Variante, Sperren, Itemzwecke, explizite Regeln und aktuelle Bestände prüfen. Nicht upgradebare Items erhalten kein erfundenes Plus. Compound verlangt drei gleiche zulässige Identitäten auf demselben Level.
2. Teamverbesserung, explizite Produktionsziele, Rezeptzutaten, konfigurierte Skillmaterialien, Werkzeuge, Schlüssel und funktionell geschützte Gegenstände vor Liquidation berücksichtigen. Unbekannte Spezialverwendung bedeutet Schutz, nicht automatisch Verkauf.
3. Alle gleichzeitigen Ziele reservieren. Die neue Verbrauchsallokation verwendet den direkt beobachteten lokalen Bestand; Bank-/Peerbestände gelten nicht als bereits verfügbare Verbrauchsmengen. Bestehende Account-/Bankkataloge helfen bei Beschaffung und Gearwahl. Diese Trennung ist konservativ: Sie kann vorübergehend zu viel reservieren, verhindert aber Doppelzusagen auf veraltete Bestände. Nach Abruf/Lieferung wird neu geplant.
4. Freigegebene Zielproduktion über vorhandenen Craft-/Upgrade-/Compound-/Exchange-/Kauf-/Farmplan ausführen. Budget, Kapazität, aktuelle Regeln und Empfangszusagen werden unmittelbar am Dispatch erneut geprüft.
5. Überschuss wirtschaftlich bewerten: Teamnutzenloses Equipment kann profitabel erhöht werden, wenn es technisch upgrade-/compoundbar ist. Mindestchance, Verlustbudget und Schutzregeln gelten auch bei hohem erwarteten Gewinn.
6. Für Verkauf zuerst den bestehenden belegten Live-Bid-Pfad prüfen. Automatisches Listing benötigt echte Umsatzbelege und erwarteten Mehrwert gegenüber NPC-Verkauf nach Steuer und Standplatzkosten. Ohne Beleg wird keine Nachfrage erfunden. Explizite List-Regeln bleiben unverändert nutzbar.
7. Bei Ablauf nur das eigene, unveränderte automatische Angebot zurücknehmen. Slot, Itemfingerprint, Preis und Angebotsart müssen stimmen. Rücknahme und Bestandszuwachs quittieren; danach Abkühlung und erneute Disposition statt endloser Neulistung.
8. Bankarbeitsplätze freihalten. Bei Druck nur nach Regeln freigegebenen Überschuss verwerten; keine Rezeptzutaten/Schlüssel/Teamitems opfern. Lässt sich keine sichere Entlastung durchführen, Diagnose und kontrollierter Wartezustand. **Gold benötigt keinen Inventar- oder Bankplatz.**

Die Bedarfsrekursion ist auf 64 Ziele, 256 Knoten und Tiefe 8 begrenzt. Zyklus oder Überschreitung sperrt betroffene Freigabe. Spezielle Quest-/Instanzabläufe ohne belegte API werden nicht durch generische Verkaufslogik geraten.

## Upgrade/Compound: genaue Modellgrenzen

- `autoHelpers` aktiviert den Vergleich vorhandener Helfer; `finiteHelpers` ergänzt Mehrschrittplanung. Die allgemeine Produktion, konkrete Aktion und zugehörigen Budgets müssen ebenfalls freigegeben sein.
- Aktuelle Kombinationen werden über Servervorschauen verglichen; höchstens 24 Kombinationen. Eingaben, Inventar, Item-/Helferdefinitionen, G-Version und Regeln binden die Vorschauen. Vor echter Mutation ist eine aktuelle Vorschau von maximal fünf Sekunden nötig.
- Der endliche Baum enthält Erfolg, Zerstörung oder nachgewiesene Erhaltung, Verbrauch der konkreten Helfervorräte sowie Verkauf als Stopaktion. Compound verbraucht drei Inputs. Erwarteter Netto-Endwert muss die Mindestmarge erreichen; ein später profitabler Level kann einen kurzfristig unattraktiven ersten Schritt rechtfertigen.
- Grenzen: bis Level 12, 42 Exemplare je Level, acht vorhandene Helfer je Slot, regulär acht Schritte und 12.000 Suchzustände. Unvollständige Suche führt zu Warten/Bank statt einer vermeintlich optimalen Mutation.
- Zukünftige, noch nicht direkt vorschau-fähige Schritte benutzen nur passende gewöhnliche Scrolls ohne Offering mit dem bestehenden Chancenmodell. Zukünftige Gebühren sind eine Modellannahme; jeder tatsächliche Schritt wird erneut geprüft. Seltene Helfer werden nicht mit geratenen Zukunftschancen bewertet.
- Die Optimierung gilt für die modellierten vorhandenen Ressourcen und NPC-Stopwerte. Sie ist keine globale Markt-/Beschaffungsoptimalität. Marktliquidität wird separat bewertet. Zufälliger Fehlschlag trotz zulässiger Chance bleibt ein erwartbares Spielrisiko und kein Beweis eines Softwarefehlers.

## Lernen und KI

Lokales Strategielernen speichert maximal 32 Aggregate. Eine Episode wird nur bei gemessenem Reward oder echtem Abbruch verwendet; Kontextwechsel während der Episode verhindert falsche Zuordnung. Ab drei Episoden kann der Fehleranteil die Zielgewichtung senken. Wiederholte Bewegungsfehler bewirken eine zeitlich begrenzte Abwertung.

KI erhält ausschließlich kleine numerische Aggregate und Kandidatenindizes. Zulässig sind höchstens fünf Gewichte zwischen 0,5 und 1,1, höchstens eine Stunde gültig. Der Client verlangt mindestens fünf eigene Episoden, passenden Kontext, erlaubtes Ziel und erfolgreiche lokale Risikoprüfung. Positive Gewichtung bei vorliegenden Fehlern wird abgelehnt. Fehler nach Übernahme entfernen den positiven Vorschlag. Sicherheitsgrenzen, Skills, Itemregeln, Budgets und ausführbarer Code sind nicht durch KI veränderbar.

Wiederherstellung lädt ausschließlich aktuelle Aggregate aus dem neuen Worker. Lokale vorhandene Evidenz gewinnt; falscher Kontext oder alte Daten werden ignoriert. Wertjournale, offene Transaktionen, KI-Vorschläge und Zugangsgeheimnisse werden nie aus einem Backup reaktiviert. B2 ist ein begrenztes Archiv; der automatische Restore-Endpunkt liest den jüngsten Worker-Checkpoint, nicht beliebige B2-Objekte.

## Verifikation und noch erforderliche Außenprüfung

Die Testdateien prüfen unter anderem parallele Rezeptbedarfe, Helferknappheit, Mehrschrittgewinn, Suchabbruch, späte Dispatchänderungen, Listing-Rücknahme, Bossreflexion/Frost/Burn/Shell, Lernrollback und Kontextwechsel, JSON-Vorschlagsgrenzen, gemeinsame Cloudquote, B2-Rotation und unklare Uploadwirkung. Worker-Providerzugriffe sind dabei Mocks.

Die maßgebliche finale Testzahl, Buildgröße und CI stehen oben in ROADMAP. Noch nicht nachgewiesen sind der neue gemeinsame Spiel-Livetest, die tatsächliche Einrichtung der neuen Providerprojekte, deren kontoweite Kostenfreigabe und langfristige Boss-/Marktergebnisse. Die Einrichtung enthält dafür eine Abnahmematrix. Neue Spielmechaniken und unklare Wertwirkungen bleiben absichtlich gesperrt.
