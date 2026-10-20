# W12/N12 – Persistentes Cave-Vote-Journal und einmaliger API-Dispatch

Stand: 20. Oktober 2026.

## Verifizierter Spielvertrag

Im fixierten Adventure-Land-Serverstand
`kaansoral/adventureland_mongodb@2148cf25d01060f54bcab01dfa7c2cf5b7baf374`
ist `cave_reply(choice, option)` ein asynchroner RPC
`cave_request('vote', {choice,option})`. Die Serverantwort enthält
`choice`, `vote`, `resolved` und gegebenenfalls ein Ergebnis.
Der aktuelle Cave-Snapshot liefert eine separat überprüfbare
`choice.votes[charaktername]`-Beobachtung.

Eine Serverquittung belegt nicht unbedingt bereits den aktuellen
physischen Abstimmungsstand; ein unterbrochener RPC darf nicht
automatisch ein zweites Mal gesendet werden. Außerdem ist die
serverinterne `vote.voters`-Liste nicht öffentlich. ALBot darf
deshalb auch bei erfolgreich validierten lokalen Belegen keine
garantierte serverseitige Stimmberechtigung behaupten.

## Umsetzung

- Neues, **separates** dauerhaftes Journal
  `albot:cave-vote:<charakter>`, strict gelesen über den
  bestehenden fehlererkennenden Cave-Rohspeicher-Port. Der Port
  erlaubt dafür ausschließlich den neuen benannten Cave-Vote-Key
  zusätzlich zum bisherigen Cave-Lifecycle-Key. Ein beschädigtes
  JSON, nicht lesbarer Speicher, fremder Charakter/Realm und
  Concurrent-Storage-Drift blockieren ohne `cave_reply`.
- `ALBot.prepareCaveVote(optionId)` erzeugt nur bei positivem
  lokalem, read-only `caveVotePreflight` einen dauerhaften
  `prepared`-Datensatz mit Charakter, Realm, Session, Run,
  Choice-ID, Option-ID und Ablaufzeit; **kein** API-Aufruf.
- `ALBot.requestCaveVote()` prüft unmittelbar vor dem einzigen
  `cave_reply(choice,option)` dieselbe frische konkrete Abstimmung,
  freie Value-/Movement-/Account-Ressourcen, das Cave-/Vote-Journal
  und die echte Host-API. Der Executor reserviert die Aktion als
  `value:true`. **Vor dem Serveraufruf** wird der Datensatz
  mit Read-after-Write-Beweis als `dispatch-unknown` persistiert.
  Selbst bei Timeout, Throw, Server-Ablehnung oder Bot-Neustart
  bleibt er gesperrt: **nie blind wiederholen**.
- Validierte positive Serverantworten mit genau denselben IDs
  werden optional separat in `reply` gespeichert. Sie sind noch
  kein bestätigter eigener Serverstimmeneintrag und entriegeln
  die nächste Wahl nicht.
- Erst `choice.votes[ eigenerName ] === optionId` im frischen,
  selben Run-/Choice-Snapshot mit passendem eigenem
  `observed-run`-Cave-Journal bestätigt die Stimme
  (`vote-observed`). Nach Neustart kann dieser Snapshot
  einen vorher unbestätigten Versuch versöhnlich nachweisen,
  ohne die API erneut aufzurufen.
- Eine **andere** neue Choice im selben Cave-Run kann nach
  gesicherter vorheriger Stimme ausdrücklich neu vorbereitet
  werden. Das Journal bewahrt eine begrenzte, nicht
  wiederverwendbare Historie der bereits bestätigten Choice-IDs;
  unbekannte/alte IDs werden nicht automatisch erneut gewählt.
- Nur ein **nicht versandtes**, noch nie bestätigtes
  Prepared darf mit `ALBot.discardPreparedCaveVote()`
  derselben Session gelöscht werden. Nach späterem
  vollständig bestätigten Cave-Exit darf allein die
  interne Lifecycle-Abschlussroutine das gleichnamige
  Vote-Journal für exakt dieselbe Run-ID zurückziehen.
  Fehlgeschlagene Löschvorgänge bleiben gesperrt.

## Abgrenzung

`ALBot.status().caveVoteJournal` liefert
`state`, `reason`, `blocked` und einen begrenzten Beleg.
`ALBot.status().caveVote` und `ALBot.caveVotePreflight(optionId)`
bleiben absichtlich reine Diagnose:
`canVote:false`, `executable:false`,
`serverVerified:false` und `requiresJournal:true`.
`requestCaveVote() === true` bedeutet nur **Executor-Annahme**,
nicht erfolgreiche Abstimmung.

Diese PR baut **keine** automatische Gruppenwahl, kein autonomes
Cave-Combat, keine Lootlogik oder Crypt-Automatisierung ein. Die
signierte Ingame-Runtime ist weiterhin der getrennte,
unveränderte Kandidatenkanal. Echte Ingame-Livetests fehlen noch.
