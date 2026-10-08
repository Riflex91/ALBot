# Aktuelles Paket 0.6.0-full

Schema albot.full/v1 aus src/config/full.mjs erweitert den P3/P4-Vertrag ohne Updater. Die gebaute Standalone-Werkstatt enthält Runtimepaket und Katalog bereits; persönlicher Export bettet zusätzlich INITIAL_PROFILE ein. Der Exportbutton ist bei gültigem Profil sofort verfügbar. Alte A/B/C/P3P4-Profile werden mit erhaltenen Werten migriert; neue Autonomie benötigt passende freigegebene Regeln/Budgets. Der Generator bleibt schemaorientiert; keine zweite Werkstatt. Build npm ci → npm run build → npm run build:editor. [Vollbetriebsvertrag](VOLLBETRIEB.md).

# Fertigen Super-Bot an die vorhandene Werkstatt anbinden

Die Werkstatt implementiert den Konfigurationsvertrag. Der erste Runtime-Teilrelease für [Live A](LIVE-A.md) konsumiert eine ausdrücklich reduzierte Ansicht mit eigener Schema-ID `albot.live-a/v1`; nicht unterstützte Bereiche werden abgelehnt. Neue Runtime-Arbeit muss den gemeinsamen Vertrag erweitern, statt eine abweichende zweite Konfiguration zu erfinden. Kanonische Definition: [editor/lib/schema.mjs](../editor/lib/schema.mjs); generierte Datendatei: [editor/albot.settings.json](../editor/albot.settings.json). Fachprüfungen: [editor/lib/contract.mjs](../editor/lib/contract.mjs).

## 1. Auslieferung

Die Runtime ist ein klassisches selbststartendes JavaScript-Bundle. Die Werkstatt setzt unmittelbar davor `globalThis.ALBotConfig` auf das vollständige validierte Konfigurationsobjekt. Der kompakte Transport speichert wiederholte Feldnamen nur einmal und rekonstruiert das Objekt vor dem Runtime-Start. Die Runtime sieht gewöhnliche Objekte und Arrays; sie benötigt keinen Decoder und keine eigene Kenntnis der Exportkompression.

Die Runtime muss `ALBotConfig` lesen, validieren, kopieren und den eigenen Zustand davon trennen. Niemals beiläufig ihre eigenen Defaults über explizite Benutzerwerte schreiben. Fehlende/unbekannte/ungültige Einstellungen melden und die betroffene Arbeit nicht ausführen. Auch ein direkt im CODE-Editor manipuliertes Objekt ist erneut zu prüfen. Die Runtime-Erkennung folgt weiterhin [RUNTIME-VERTRAG.md](RUNTIME-VERTRAG.md).

Nach Fertigstellung und Prüfung der Laufzeit:

```sh
node editor/package-bot.mjs --runtime dist/albot.js --version 1.0.0 --out albot.package.json
```

Für ein neues kompatibles Schema zusätzlich `--schema pfad/albot.settings.json`. Der Packager prüft Syntax, Hash, Format und Bundlegröße mit den Schema-Vorgaben. Er prüft nicht, ob der Bot alle angegebenen Features tatsächlich implementiert. Das muss die jeweilige Implementierung sicherstellen. Bei absichtlich unvollständigen Schema-Vorgaben vorher ein geeignetes gültiges Release-Schema bereitstellen.

Format:

```json
{
  "format": "albot-package",
  "formatVersion": 1,
  "descriptor": {"format":"albot-settings","formatVersion":1,"schemaId":"albot.config/v1","schema":{}},
  "runtime": {"version":"1.0.0","schemaId":"albot.config/v1","contractVersion":1,"sha256":"64 Kleinbuchstaben/Hexziffern","code":"klassischer JavaScript-Bot"}
}
```

Das leere Schema im Formatbeispiel ist zur Darstellung verkürzt und nicht importierbar. Eine echte Datei benötigt das vollständige Schema. SHA-256 bezieht sich ausschließlich auf die UTF-8-Bytes von `runtime.code`; es schützt gegen Beschädigung, ist keine Signatur und kein Herkunftsnachweis. Die Werkstatt führt den Code nicht aus. Erst der Nutzer startet den Export im Spiel/Client.

## 2. Schemaformat 1

Bewusst begrenzte deklarative JSON-Schema-Teilmenge; kein Anspruch auf vollständige JSON-Schema-Kompatibilität.

- `type`: object, array, string, boolean, integer, number.
- `title`, `description`, `default`.
- object: `properties`, `required`, `additionalProperties:false`.
- array: `items`, `minItems`, `maxItems` (verpflichtend, höchstens 2.000), `uniqueItems`.
- Zahlen: `minimum`, `maximum`; Texte: `minLength`, `maxLength`.
- Stringauswahl: `enum`; `x-labels` ordnet Werten deutsche Anzeigetexte zu.
- `x-catalog: "items"` oder `"characters"` ergänzt Vorschläge ohne neue IDs zu verbieten.
- Neue Top-Level-Objekte/-Listen werden automatisch neue Bereiche. Verschachtelte Objekte werden aufklappbar, Listen erhalten Suche, Seiten, Kopieren, Reihenfolge und Löschen.
- Kein `$ref`, Code, regulärer Ausdruck, externer URL-Resolver, `oneOf`, HTML oder dynamisches Template. Unbekannte Schlüssel werden abgelehnt, nicht ignoriert.

Die Schema-ID bezeichnet die Semantik. Additive Erweiterung unter derselben ID ist möglich: fehlende Felder werden als sichtbarer Änderungsvorschlag mit Defaults ergänzt. Bestehende Felder dürfen nicht mit anderer Bedeutung umgedeutet werden. Bei inkompatibler Änderung neue ID und dokumentierte Migration bereitstellen. Ein neues Schema kann mit denselben generischen Controls genutzt werden; tatsächlich neue Feldtypen benötigen eine Werkstattänderung.

Für `albot.config/v1` bleiben alle vorhandenen Felder und Typen verpflichtend. Die Werkstatt prüft zusätzlich die bekannten Fachregeln. Für andere Schema-IDs greift die generische Validierung; neue Fachbedingungen müssen weiterhin von der Runtime geprüft werden. Die spezielle Item-Regelvorschau ist nur für den bekannten v1-Vertrag aktiv.

## 3. Zuordnung und Semantik

| Konfigurationsbereich | Zuständiger Botbereich |
|---|---|
| general | Start/Stop, Scheduler, Transport, Browser-UI, Updater |
| characters | Roster, Rolle, Realm, Rotation, eigene Reserve und Farmziele |
| farming | Überleben, Loot, Zielbewertung, Reise, Kiting, Aggro |
| party | Leader/Merchant, Gruppe, Heilung, Buffs, AoE, Auren |
| skills | Präzise Skillregeln und ihre Bedingungen |
| merchant | Versorgen/Abholen, Stand, Bank, faire Aufgaben, Nebenaktivitäten |
| items | Gemeinsame Auswahl-/Mengen-/Preis-/Verarbeitungsregeln |
| production | Ziele, Beschaffung, Verarbeitung, Gear und Verlustbudget |
| world | Bosse, Events, Quests, Realms, Risiko und kleine Lernwerte |
| rules | Deklarative bedingte Aufträge |

Globale Module-Schalter sind harte Obergrenzen: eine Itemregel `upgrade` aktiviert nicht heimlich das abgeschaltete Upgrade-Modul. Konkrete Benutzerregeln haben innerhalb der freigegebenen Module Vorrang vor Optimierung. Charakterregeln dürfen keine anderen Charaktere übernehmen. Unklare Wertaktionen nicht wiederholen, unabhängig von einem übergeordneten Pauseprofil.

Itemphasen: `acquisition` = buy, marketBuy, wishlist, retrieve, farm; `production` = upgrade, compound, exchange, craft; `inventory` = sonstige Aktionen. keep wirkt über alle Phasen. `ruleRank` gewichtet Charakter mit 100, Rolle mit 10 und jeden angegebenen Varianten-/Situationsfilter mit 1; ein begrenzter Levelbereich zählt ebenfalls 1. Danach höhere explizite Priorität. Gleichrangige überlappende widersprüchliche Entscheidungen sind Konfigurationsfehler. Die Runtime muss dieselbe Auswahl verwenden, statt pro Controller eigene Keep/Sell-Listen zu führen.

`keep` plus `teamReserve` schützt den Bestand vor Überschussaktionen. `targetCount` steuert den gewünschten Nachschubbestand. Optional trennt `requestBelow` den Auslösepunkt vom Zielbestand: bei `requestBelow > 0` wird Bedarf erst bei oder unter dieser Restmenge gemeldet; `0` verwendet weiterhin den Zielbestand als Schwelle. `maxCount` ist die gewünschte Obergrenze; daraus folgt keine implizite Vernichtung. Preislimits pro Stück, `goldBudget` je Auftrag, Verlustbudgets nach Bereichsbezeichnung. Globales und lokales Budget gelten gleichzeitig; strengere Schranke gewinnt. Scroll/Offering leer: automatischer passender Scroll, kein Offering. Ein eingegebenes Offering darf nur bei passender Live-Voraussetzung verwendet werden.

Für allgemeine Bedingungen sind `hpRatio` (eigener HP-Anteil), `targetHpRatio` (HP-Anteil des aktuellen Gegners) und `mpRatio` Zahlen von 0 bis 1; freeSlots/gold/enemyCount/itemCount sind Zahlen, map/task Text und rip ein boolescher Wert. Der Konfigurationswert wird als Text gespeichert und entsprechend dem Messwert geparst. Text/bool unterstützen eq/neq. Mengenbedingungen binden ihre Item-ID. Alle/all oder mindestens eine/any; leere aktivierte Verhaltensregeln sind ungültig. Skills ohne Zusatzbedingungen verwenden die normale Klassen-/Cooldown-/Zielprüfung. Allgemeine Aktionen erzeugen geprüfte Aufträge, keinen beliebigen Code.

## 4. Freigabe des fertigen Bot-Pakets

Vor Auslieferung jede konfigurierbare Aktion an ein tatsächlich implementiertes Modul binden. Kein Feld darf wirkungslos als angeblich unterstützt durchgereicht werden. Für Teilreleases die unvollständigen Module ausdrücklich aus dem ausgelieferten Schema entfernen und eine passende andere Schema-ID verwenden; die vollständig geplante v1-Konfiguration nicht stillschweigend nur teilweise ausführen.

Die bestehenden drei Live-Testpunkte der Roadmap bleiben ausreichend. Keine Shadow-Phase. Als zusätzliche Exportprüfung das endgültige Paket mit einem realistischen umfangreichen Profil zusammenstellen und unter 1.048.576 UTF-8-Bytes bleiben. Das Entwicklungsziel bleibt 900 KiB. Konfigurationen für alle 638 mitgelieferten Item-IDs mit jeweils Farmer- und Merchant-Regel sind durch den kompakten Export berücksichtigt.


## Live-B-Paket

`dist/albot.package.json` liefert ab 0.2.0-live-b das Schema `albot.live-b/v1`. Zuerst Paket, dann passendes Profil laden. Der Formulargenerator braucht keine neue Sonderoberfläche. Neue Profile haben `general.autostart: true`; explizite Werte in gespeicherten Nutzerprofilen werden nicht heimlich überschrieben. Historische A-Profile werden über `scripts/export-live-b.mjs` gezielt erweitert; dieser Übergang setzt nach Nutzerwunsch Autostart true und erzeugt einen neuen Ordner.

`maxActions` ist eine neue Economy-Regelgrenze pro CODE-Instanz. Die Bankgold-Einstellung betrifft Bankbesuche. Nicht integrierte Felder (u. a. Merrit, Fishing/Mining, Ponty, Task-Halte-/Starvationzeiten, Recipe-/Fallback-Auswahl) bleiben im vollständigen geplanten Schema, werden aber im B-Paket weggelassen. Vollständiger Umfang ist weiterhin Roadmap, kein Funktionsversprechen des Teilrelease.

## Live-C-Paket

Ab `0.3.0-live-c` enthält das aktuelle Paket `albot.live-c/v1`. Dieselbe Werkstatt zeigt durch Paketimport zusätzlich Welt-, Account-, Merchant-Nebenaufgaben und allgemeine Verhaltensregeln. `autoUpdate`, `updateChannel` und das freie `recipe`-Feld bleiben ausgeschlossen. Unterstützte Skill-IDs bleiben die explizite sichere Skillliste; Paladin-Aura und Magiport haben eigene Fachoptionen.

Ein A/B-Profil zuerst mit `scripts/export-live-c.mjs` migrieren. Importreihenfolge: aktuelles C-Paket, danach C-Profil. Kein automatisches Verwerfen fremder Felder; nicht unterstützte aktivierte Updater-/Rezeptalias-Werte verhindern die Migration. Der optionale dokumentierte B-Testübergang entfernt ausschließlich bekannte temporäre Testregeln. Der Formulargenerator bleibt unverändert.

Task-Namen: `farm`, `boss`, `event`, `supply` bzw. eine explizite Merchant-Aufgabe `fishing`, `mining`, `merrit`, `bank`. Item-Regeln mit `task` wirken nur im passenden Kontext. `fallback=bank` erstellt eine geschützte Bankaktion für den Merchant, `notify` erhält den Bestand und meldet fehlende Voraussetzungen. Fallback zählt zur Economy-Aktionsgrenze der ursprünglichen Regel.

„Risikoprofil“ ist eine begrenzte Schaden-/Gruppen-HP-Heuristik, keine Garantie gegen jede Bossfähigkeit. „Lernen“ ist begrenztes XP-Ranking mit deterministischem Grundrang, keine KI-Plattform oder vollständige Markt-/Reiseoptimierung. „Quests“ meint Monsterhunt; „Saisonbelohnungen“ den Anniversary-Ablauf. Details und Grenzen: [INTEGRATIONSSTAND.md](INTEGRATIONSSTAND.md).

## P3/P4 0.5.0

Aktuelles Paket: albot.p3p4/v1. Neue Ziellogik, Vorrang expliziter Regeln, Budgets, Rezept-/Itemdaten, Unterbrechung und Schema-Migration sind vollständig in [P3-P4.md](P3-P4.md) beschrieben. Öffentliche ALBot-API und Headless-Fähigkeiten bleiben gleich. Neue Berichtsbereiche: gearTargets, market, performance; production ergänzt autonomy/blocked. Alte A/B/C-Schemaerkennung bleibt erhalten. Werkstatt kann alte Profile in P3/P4 übernehmen; fehlende Felder erhalten Vorgaben, aktive Updater und unbekannte Felder werden abgelehnt. Explizite Auswahl beim Paketwechsel erhält bestehende Einstellungen. Der gemeinsame Test steht aus: [P3-P4-LIVE.md](P3-P4-LIVE.md).
