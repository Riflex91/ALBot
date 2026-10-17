# Issue #95 – Phase 3, 4 und 5: Implementierung und Abnahme (17.10.2026)

## Grundlage: Browser-Livetest EUII, 16:39–16:48 UTC

Alle vier Charaktere meldeten frische Heartbeats auf EUII; 0 Inventarsperren. Ranger1/Ranger2/Priest: 97/113/105 normale Angriffe, Ranger1/2 zusätzlich 104/29 \`3shot\`; DEX/DEX/INT-Elixiere waren jeweils tatsächlich angelegt. Merchant: nur ein Pursuit-Ereignis, keine Transfer-Timeouts, sieben Seashells am Ende. Merchant-Frame: Durchschnitt 91,52 ms, Maximalwert 2912 ms, p99 aus dem Export im Bereich von Sekunden; \`cpuUsage=unavailable\`. Als Ursache für die hohen Framezeiten ist damit noch KEIN einzelnes Modul bewiesen. Ranger1/2 JSON-Ringberichte mit 2278/216 ausgelassenen früheren Events – vollständige JSONL-Streams für echte Live-Abnahme nutzen.

## Phase 3 – Native Skill-Wake-Hints

\`src/core/skill-wakeups.mjs\`: Bereits durch die Game-Runtime bereitgestellte \`next_skill\`-Zeitpunkte dürfen ein klassisch beobachtetes Cooldown bis höchstens 750 ms von wiederholtem \`is_on_cooldown\`-Polling ausnehmen. Ändert sich der Zeitpunkt, gilt der Cache sofort als ungültig. Einziger bereits bestehender Frame-Timer darf bis zur bestätigten nächsten Fälligkeit vorgezogen werden, nie schneller als 2x der eingestellten \`combatTickMs\`-Frequenz, niemals parallel. Die eigentlichen Skillregeln, Ressourcengates, Executor-Guard und Spiel-API-Freigabe bleiben autoritativ. Ohne verwertbare native Zeitangaben bleibt die ursprüngliche Tick-Frequenz unverändert. Diagnostik liefert Skip-Zähler und Wake-Latenz, **keine neu gemessene CPU-Quote**.

**Offene vollständige Phase-3-Abnahme:** tatsächliches \`next_skill\`-Schema und Browser-/Headless-Benchmarks, p95/p99 und Wake-Differenzen aus längeren parallelen Läufen belegen; Pingrate und Aktionsrate vergleichen.

## Phase 4 – Kontoübergreifende Evidenzübersicht

\`src/items/account-stock-ledger.mjs\`: Sachlich getrennte Quellen für lokale und frische Session-/Realm-bezogene Peer-Inventare, geschützte/reservierte Itemvarianten, ausgerüstete Gegenstände (nie als versendbare Inventarmenge) und physisch sichtbare, nachgewiesene Bank-Packs. Vollständigkeit wird nur für wirklich geprüfte Quellen behauptet. Abgeschnittene Heartbeats, ungeprüfte Bank-Packs, offene Journale oder Sitzungssprünge sperren eine positive Gesamtbehauptung. Der Nachweis ist ausdrücklich **read-only / authority:none / executable:false**; Verkäufe, teilweiser Stackverkauf und Transfers benötigen die bisherigen serverbestätigten Aktionsjournale und ihre Regeln.

**Offene vollständige Phase-4-Abnahme:** unabhängige Server-Transferquittungen, Reconciliation über Restart/Epochen, autorisierte Reservierungen gegen bestätigten Gesamtbestand und tatsächliche Teilverkaufbelege. Das neue Shadow-Ledger erteilt dafür KEINE neuen Rechte.

## Phase 5 – Bestätigter Trankabgang und vorgezogene Versorgung

\`src/merchant/potion-receipts.mjs\`: Der Farmer erhöht Session-/Realm-gebundene Verbrauchszähler nur bei tatsächlich im lokalen Inventar beobachteter Mengenabnahme **nach bestätigter Trankaktion**. Diese kleinen Zähler reisen mit dem normalen Transport-Heartbeat. Der Merchant vergleicht Zähler über mindestens 30 Sekunden bei gleicher Session; abnehmende Zähler, unfrische aktuelle Statuspakete und offene Journale sind nicht beweiskräftig. Die alte Bestandsdelta-Prognose bleibt separat Shadow-only.

Wenn für alle ausgewählten aktiven Farmer die Sitzung und die Zeitfenster belegbar sind und mindestens drei bestätigte Anwendungen eines Tranktyps binnen des Fensters dessen geschätzte Reichweite unter 180 Sekunden bringen, startet die vorhandene persistierte Team-Tranktour **frühzeitig**. Bestandszielwerte, Goldbudgets, NPC-Kaufregel, Bankentnahme, vor-Ort-Lieferung, Empfängerbindung und Journale bleiben unverändert. Ohne einen solchen Beleg bleibt das bisherige Schwellwertverhalten wirksam.

**Offene vollständige Phase-5-Abnahme:** Verbrauchszähler bei Restart, Trankkäufe und tatsächliche, empfängergebundene Mehrzwecktouren live nachweisen; externe Verkäufe/Transferverluste unabhängig von Verbrauch bestätigen; ETA-/Stoppreihenfolge und Versorgungsvorteil empirisch messen. Ein Client-Inventarabgang ist kein unabhängiger Server-Verbrauchsbeleg.

## Abnahmebedingungen

- \`npm test\`: Regression für native Wake-Gates, bounded Frame-Timing, Lager-/Ausrüstungsnachweis und Session-feste Trankverbräuche.
- \`npm run build\` und \`node scripts/sync-personal-code.mjs --check\`.
- Windows-/Linux-CI, Versions- und Bundle-Prüfung, personalisierte Konfiguration byteidentisch und Workflow \`contents:read\`.
- Keine vollständige Phasen-Checkbox in Issue #95 ohne die genannten Live-/Headless-Nachweise.
