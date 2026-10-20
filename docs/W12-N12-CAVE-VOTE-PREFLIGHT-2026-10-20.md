# W12/N12 – Sichere Cave-Abstimmungsvorprüfung (20. Oktober 2026)

## Offizielle Serververträge

Abgeglichen gegen den fixierten Adventure-Land-Quellstand
`kaansoral/adventureland_mongodb@2148cf25d01060f54bcab01dfa7c2cf5b7baf374`:

- `js/runner_functions.js` definiert `cave_reply(choice, option)` als Aufruf von `parent.cave_request('vote', {choice, option})`.
- `node/logic/cave_of_many_dreams.js` veröffentlicht über `cave_snapshot()` eine Run-ID, Serverzeit, Pausenstatus, Gold/Amber, Originalroster und eine Choice mit ID, Deadline, `resolved`, Stimmen nach Charakternamen und Optionen inklusive Gold-/Amber-Kosten sowie `unavailable`.
- Der Server lehnt veraltete Choice-IDs, fehlende Mitgliedschaft in der serverinternen `voters`-Liste, bereits abgegebene Stimmen, geschlossene Fristen und unbekannte Optionen gesondert ab. **Die interne `voters`-Liste wird im öffentlichen Snapshot nicht übertragen.** Selbst eine positive lokale Prüfung beweist folglich keine serverseitige Stimmberechtigung.

## Umsetzung

- `verifiedCaveSnapshot()` prüft jetzt auch die optionalen Serverfelder `choice.deadline` und `choice.votes`. Namen müssen aus dem Originalroster stammen und jede Stimme muss eine tatsächliche aktuelle Options-ID enthalten. Beschädigte Angaben verwerfen den Snapshot statt Abstimmungsrechte zu erfinden. Ältere Clients ohne diese Felder bleiben nur als **read-only Run-Beobachtung** kompatibel; ihre Abstimmungsbelege werden als unvollständig markiert.
- Neues reines Modul `src/world/cave-vote.mjs` mit `caveVotePreflight()`. Die passive Funktion verlangt eine aktuelle eigene Cave-Instanz, ein **separates persistiertes** `observed-run`-Journal mit derselben Run-ID, Realm und Charakter, eine höchstens drei Sekunden alte Serverzeit, aktiven eigenen Teilnehmer, pausierten Run, offene und mehr als zwei Sekunden gültige Abstimmungsfrist, bekannte Stimmenlage und eine ausdrücklich gewählte, angebotene Option. Sie prüft gesperrte Optionen sowie Gold- **und** Amber-Deckung getrennt.
- Verfügbare, aber zu teure Optionen werden nur diagnostiziert, niemals automatisch gewählt. Bereits abgegebene Stimmen und laufende/ungeklärte Exits blockieren.
- `ALBot.status().caveVote` zeigt den aktuellen Lese-/Vorprüfungsstand und den Grund einer Sperre. `ALBot.caveVotePreflight(optionId)` prüft eine **ausdrücklich benannte** Option ohne API-Aufruf.
- `executable:false`, `canVote:false`, `serverVerified:false` und `requiresJournal:true` gelten **immer**, auch bei `localConditionsMet:true`. Das ist keine Game-API-Autorisierung und keine automatische oder manuelle `cave_reply()`-Mutation.

## Nachweise und Grenzen

Neue Offline-Regressionen prüfen Originalstimmen, unbekannte Mitglieder oder Optionen, Deadline/Serverzeit, Pausenstatus, eigene bereits abgegebene Stimme, Gold-/Amber-Kosten, fremde/noch nicht persistierte Run-IDs, Exit-Unsicherheit und das völlige Ausbleiben von `cave_reply()`-Aufrufen beim Status.

W12/N12 bleibt offen: Für tatsächliche Abstimmungen wird ein **eigenes dauerhaftes Vor-Dispatch-Vote-Journal** und nachherige Server-/Snapshot-Abgleichung benötigt; ebenso fehlen autonome Instanzkämpfe, Wegführung, Loot, koordinierte Gruppenentscheidungen und Ingame-Liveabnahme. Signierte Ingame-Runtime und persönliche Einstellungen werden nicht verändert.
