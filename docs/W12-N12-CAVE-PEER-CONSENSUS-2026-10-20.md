# W12/N12 – Konservative Cave-Gruppenkonsens-Vorschau (20. Oktober 2026)

## Quellgrundlage und Grenzen

Verglichen mit `kaansoral/adventureland_mongodb@2148cf25d01060f54bcab01dfa7c2cf5b7baf374`,
insbesondere `node/logic/cave_of_many_dreams.js:cave_snapshot()`:

- Der offizielle Server liefert `choice.danger` aus
  `encounter.group === 'bad'`, ferner `choice.kind`,
  Originalroster, `choice.votes` nach Namen und getrennte
  `cost`-/`amber`-Beträge je Option.
- `danger:false` bedeutet **nur, dass dieses Serverflag nicht
  gesetzt ist**, und ist keine beweisbare Garantie für einen
  ungefährlichen Ausgang oder positiven wirtschaftlichen Nutzen.
- Stimmen der anderen Charaktere sind beobachtete
  Serverinformationen, **kein Auftrag**, eine Abstimmung
  durchzuführen. Auch bei Konsens kann der Server den Vote wegen
  seiner nicht öffentlich sichtbaren `vote.voters`-Liste ablehnen.

## Umsetzung

- Der bisherige Cave-Parser validiert optional die offiziellen
  `choice.danger`- (nur Boolean) und `choice.kind`-Felder und
  bewahrt sie im read-only Snapshot auf. Fehlen sie, wird
  `danger:null` gesetzt; das darf niemals als `false` gelten.
- Neues `src/world/cave-consensus.mjs`:
  `planCaveGroupVote()` ist eine deterministische, ausschließlich
  **diagnostische** Vorschau. Sie verlangt aktuelle,
  maximal drei Sekunden alte Serverbelege, einen identischen
  dauerhaft erfassten eigenen Run, einen offenen pausierten Vote
  mit mindestens fünf Sekunden Restfrist und ein lesbares
  Vote-Journal ohne ausstehenden oder ungeklärten Versand.
- Für die Vorschau müssen **exakt drei ursprüngliche,
  derzeit aktive/nicht getrennte Teilnehmer** nachgewiesen sein,
  die beiden anderen Charaktere müssen bereits dieselbe,
  noch angebotene, verfügbare Option gewählt haben, und die
  eigene Stimme muss noch fehlen. Jede Abweichung oder ein
  fehlendes Teammitglied resultiert in **keiner Empfehlung**.
- Unbekanntes oder gesetztes Server-Gefahrenflag ergibt
  `unknown-encounter-risk` bzw. `server-danger-flagged`
  und **keinen** Kandidaten. Selbst bei `danger:false`
  wird zusätzlich die bisherige unabhängige
  `caveVotePreflight(optionId)` geprüft.
- Ressourcenpolitik prüft **Gold und Amber getrennt** und hält
  optionale Mindestreserven zurück. Standardgrenzen
  `maxGoldCost:0`/`maxAmberCost:0`: Ohne ausdrücklich
  übergebene Budgetgrenzen wird **keine kostende Option**
  empfohlen. Negative, gebrochene, unendliche oder unsicher große
  Werte werden abgewiesen.
- `ALBot.status().caveConsensus` zeigt die konservative
  Null-Ausgaben-Vorschau. `ALBot.caveConsensusPreview(policy)`
  kann über explizite `maxGoldCost`, `maxAmberCost`,
  `minGoldReserve`, `minAmberReserve` andere Szenarien
  **simulieren**, ohne die Botkonfiguration zu speichern.

## Sicherheitsgrenze

**Für jeden Output gelten `executable:false`,
`canVote:false`, `autoVote:false`,
`serverVerified:false`, `requiresJournal:true`.**
Ein positiver Status trägt lediglich
`candidateForReview:true` und die belegten
Choice-/Options-/Run-/Peer-/Kosteninformationen.
Er löst weder `prepareCaveVote` noch `requestCaveVote`,
`cave_reply()`, Gold-/Amber-Ausgaben, Kämpfe, Loot oder
Navigation aus. Der bestehende explizite One-Shot-Vote-Executor
und sein persistentes Journal bleiben unverändert.

Neue Regressionen decken Trio-Einigkeit, Abweichungen, Offline-
oder fehlende Mitglieder, selbst bereits abgegebene Stimmen,
gesperrte und unbekannte Optionen, Gefahr/fehlende Gefahr,
Kosten-/Reservegrenzen, Zeitablauf, Run-/Exit-/
Storage-Journalinkonsistenzen und den No-Side-Effect-Vertrag ab.

**Offen** bleiben eine fachlich qualifizierte
Risiko-/Nutzenberechnung unterschiedlicher Cave-Entscheidungen,
eine wirklich autorisierte koordinierte automatische Stimmabgabe,
Cave-Gruppencombat, Loot-/Exit-Liveabnahme und der Crypt-Lebenszyklus.
Diese Stufe ist keine autonome Cave-Entscheidungs-KI.
