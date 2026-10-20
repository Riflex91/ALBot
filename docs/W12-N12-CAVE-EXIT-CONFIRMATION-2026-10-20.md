# W12/N12 – Persistenter Cave-Exit und bewiesene Journalfreigabe (20.10.2026)

## Offizielle Serversemantik

Geprüft gegen `kaansoral/adventureland_mongodb@2148cf25d01060f54bcab01dfa7c2cf5b7baf374`:

- `js/runner_functions.js`: `cave_exit()` delegiert asynchron an `cave_request('exit')`.
- `node/logic/cave_of_many_dreams.js`: Der Server setzt die Cave-Börse ab, führt `generated_exit(player,'exit')` aus und liefert `{exited:true}` **nur** bei tatsächlich verarbeiteter Exit-Aktion.
- `node/logic/generated_maps.js`: `generated_exit` markiert den Teilnehmer als verlassen, liefert das Cave-Endereignis und transportiert nach `main`. Dagegen bewahrt `generated_disconnect` eine mögliche Run-Wiederaufnahme und löscht nur den lokalen Cave-Zustand. Ein unsichtbarer Run bedeutet daher **nicht** automatisch Ende oder Erstattung.

## Implementierte Exit-Transaktion

- Neue **nur explizite** Aktion `ALBot.requestCaveExit()` verlangt einen zuvor physisch beobachteten, eigenen Run, konsistente Character-/Realm-/Map-Bindung, freie Executor-Ressourcen, echten `cave_exit`-Port und die existierenden Inventory-/Bank-/Account-/Travel-Sperren.
- **Vor dem einzigen** `cave_exit()` persistiert sie `phase:'exit-dispatch-unknown'`, `exitAt`, `exitSession` und `exitRun` im unveränderten strengen Cave-Journal. Weder ein Timeout noch eine Fehlerrückgabe oder ein Neustart löst einen automatischen Wiederholungsversuch aus. Fortgesetzte Cave-Samples setzen den Versandstatus nicht zurück.
- Eine gültige positive `{exited:true}`-RPC-Rückgabe wird separat als `exitReply` gespeichert. Der Datensatz bleibt damit zunächst **gesperrt**. Ein bloßer Socket-Abbruch oder ein `map:'main'` zählt nicht als Ausstiegsquittung.
- **Separate, ausdrücklich aufrufbare Freigabe** über `ALBot.confirmCaveExit()`: Erforderlich sind ein dauerhafter positiver Exit-Reply-Beleg, aktuelle eigene `main`-Position ohne Cave-State, kein pending Executor oder Valuejournal **und ein neuer, nach der Exit-Quittung beobachteter authentifizierter** `cave_info()`-Beleg, dessen Serverzeit nicht vor der Quittung liegt und dessen `resume` **null** ist. Das Tageskontingent `available` darf weiterhin `false` sein und wird nicht umgedeutet. Erst dann wird das Journal explizit und read-after-write-kontrolliert gelöscht.
- Ein persistierter erfolgreicher Reply kann auch **nach einem CODE-Neustart** mit frischen Serverinformationen nachträglich abgeglichen werden, ohne `cave_exit()` zu wiederholen. Ein unbekannter, nicht quittierter Exit bleibt nach Neustart gesperrt. Kein automatisches Exit, kein automatischer Journal-Clear, keine neue Cave-Eintrittsfreigabe beim Erhalt der RPC-Quittung allein.
- **Erst nach erfolgreichem dauerhaften Journal-Clear** wird auch der flüchtige `lastObservedRun`-Beleg des Cave-Readers für genau dieselbe Run-ID zurückgezogen. Ein fremder Run bleibt als Widerspruch gesperrt; die bei einer späteren Neueintrittsprüfung weiterhin erforderliche frische `cave_info`-Berechtigung kann dadurch aber korrekt angewendet werden.
- Die herkömmliche `ALBot.status().cave`-Anzeige mit `canExit:false` bleibt eine konservative **passive** Aussage; die neuen expliziten Methoden besitzen ihre eigenen Executor-/Journal-Guards.

## Tests und weiter offen

`test/roadmap-n12-cave-exit-lifecycle.test.mjs` prüft Exit-Beschränkung auf beobachtete Instanz, Einmalversand, persistiertes Pre-Dispatch-Journal, echte Serverquittung, die voneinander unabhängigen Post-Exit-Belege, Run-Konflikte, wechselnde Floors, unzureichende und veraltete Cave-Info, Error-/Timeout-Recovery, Persistenzfehler, Neustart mit/ohne Quitttung und die Wert-/Executor-Sperren.

**Nicht abgeschlossen:** vollständige selbstständige Cave-/Crypt-Expeditionen, Gruppencombat, Votes, Loot und echtes Live-Abnahmeprotokoll. Die signierte Ingame-Runtime und persönliche Konfiguration bleiben unverändert.
