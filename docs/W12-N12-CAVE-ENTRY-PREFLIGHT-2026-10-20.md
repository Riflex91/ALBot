# W12/N12 – konservative Cave-Eintritts- und Resume-Vorprüfung (20.10.2026)

## Offizielle Quelle und fachliche Unterscheidung

Verglichen mit `kaansoral/adventureland_mongodb@2148cf25d01060f54bcab01dfa7c2cf5b7baf374`:

- `generated_party(player)` umfasst **sämtliche gegenwärtigen** Spieler
  derselben echten Party auf dem Server; die konfigurierte ALBot-Farmergruppe
  ist dafür kein Vollständigkeitsbeleg. Der Server akzeptiert bei neuem
  Eintritt nur 1–3 Teilnehmer, die lebendig, unbelastet, begehbar,
  auf `main` und höchstens 160 Einheiten vom Cave-Keeper
  `(816,1200)` entfernt sind; weitere Serverchecks betreffen
  das Generated-Protocol, den Account und tatsächliche Wartezeiten.
- `open_generated_zone` priorisiert `generated_return_run` vor
  einer neuen Erstellung. Ein fremdserverseitiges `resume` ist keine
  Berechtigung für den lokalen `cave_enter()`.
- `generated_return` verwendet `generated_admission(player,[player])`.
  Eine wiederaufnehmende Figur benötigt also **nicht** die vollständige
  frühere Party als lokale Neueintrittsgruppe.
- `visit.available` und `visit.resume` sind read-only-Hinweise,
  nicht die asynchrone Serverquittung einer tatsächlich gestarteten Aktion.
  Ein nach Disconnect nicht mehr sichtbares `character.cave` beweist
  **keinen** endgültigen Exit.

## Implementierung

`src/world/cave-admission.mjs` führt die lokale, deterministische
Vorprüfung **ohne Spielaktionen** durch und unterscheidet:

1. `new`: frischer `cave_info`-Beleg (`observedAt` höchstens
   30 Sekunden alt), ausdrücklich verfügbares Tageskontingent,
   kein offener Resume-/ungeklärter vorheriger Run, vollständiger
   lokal beobachteter Partybestand mit 1–3 ausgewählten Figuren und
   sichere momentane Keeper-Positionen.
2. `resume`: derselbe, vom Server gemeldete Run auf dem lokalen
   Realm; nur der rückkehrende Charakter benötigt die lokale
   Keeper-Vorprüfung, unabhängig von weiter existierenden Partymitgliedern.
3. `remote-resume`: servergebundene Resume-ID für **anderen**
   Realm; ausschließlich Diagnose, kein lokaler Neueintritt.

Ungültige/mangelnde Uhrzeit, Teilnehmeridentitäten, vollständige
Partyaufzeichnung, HP, Ruhestatus, lokale Position, nachgewiesene
Zielanzahl, fremde/vierte Partymitglieder oder ein unbestätigter
vorheriger Run blockieren die lokale Vorprüfung.

`ALBot.status().cave.entryPreflight` liefert
`mode`, `reason`, `localConditionsMet` und optionale Run-/Rosterbelege.
**Selbst ein lokaler Erfolg bleibt `executable:false`,
`serverVerified:false` und `requiresJournal:true`.**
Die bereits vorhandenen öffentlichen API-Gates
`canEnter/canResume/canVote/canExit:false` bleiben unverändert.
Es gibt weiterhin weder automatische Cave-Eintritte noch einen
wiederholten, journallosen Mutationsaufruf.

## Abnahme und Grenzen

Neue Regressionen in `test/roadmap-n12-cave-entry-preflight.test.mjs`
decken Solo-/Party-Neueintritt, explizite Tagesberechtigung,
Local-/Remote-Resume, stale Zeitstempel, vorigen ungeklärten Run,
Uhrsprung, Zustand am Keeper, eine unbekannte vierte Figur,
abweichende Gruppen- und Instanzbelege sowie die Unabhängigkeit der
read-only-Abfrage vom passiven Botstatus ab.

Dies ist ein nachweisbarer N12-**Planungsbaustein**; für den
tatsächlichen `cave_enter()`-Aufruf braucht es einen langlebigen,
vor Dispatch geschriebenen und nach Serverquittung rekonstruierbaren
Run-/Accountversuchsvertrag. Auch Cave-Combat, Vote, Nera-Respawn,
Loot, Return, Exit, Test- und Signaturkanal verbleiben ausdrücklich
als getrennte Roadmap-Aufgaben.
