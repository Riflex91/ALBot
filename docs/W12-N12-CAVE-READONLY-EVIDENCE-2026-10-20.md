# W12/N12/G06/G07 – Read-only-Cave-Belegadapter (20.10.2026)

## Verifizierte Serverquelle

Die Adventure-Land-Quellen am fixierten Stand
`kaansoral/adventureland_mongodb@2148cf25d01060f54bcab01dfa7c2cf5b7baf374`
unterscheiden klar:

- `cave_info()`: die öffentlich aufrufbare Lese-API gibt **nur**
  `visit` aus der `cave_request('info')`-Antwort zurück.
  `visit.available`, `resets`, `home`, `server_time` und eine
  optionale `resume`-Angabe sind **kein** Eintritts-/Ausführungsbeleg.
- `player.cave`: der Server publiziert für den tatsächlich
  zugeordneten Charakter den gegenwärtigen Cave-Run mit `run`,
  `floor`, `remaining_ms`, `paused`, `roster`, gemeinsamen
  `gold`-/`amber`-Börsen und den **aktuellen**
  `choice.options`. Der Run-Key ist ein 24-stelliger Hexwert;
  die Fußbodenmap lautet `zone_<run>_<floor>`.
- `generated_disconnect` versetzt die Außenfigur zurück nach
  `main`, speichert aber unter Umständen den **wiederaufnehmbaren**
  Run; ein Disconnect beweist ausdrücklich **keinen** Cave-Exit.
- Auf Abstimmungen stehen `cost` und `amber` als getrennte
  Währungen. Die Snapshot-Pause hält den Server-Run-Clock an;
  die Restzeit darf clientseitig nicht frei heruntergezählt werden.

## Umsetzung

`src/world/cave-evidence.mjs` bietet einen konservativen
Belegparser und einen sitzungs-/realmgebundenen Adapter:

- Prüft Besuchsberechtigung inklusive Server-Uhrzeit, Resetfenster,
  Serverkennung und dokumentierter Resume-ID.
- Prüft einen **gegenwärtigen**, auf eigene Cave-Map, eigenen aktiven
  Teilnehmer und Run/Floor gebundenen Server-Snapshot. Inventare
  oder accountweit geschätzte Zustände liefern keine Berechtigung.
- Behält originale Teams (maximal drei) und Pausen-/Restzeitbelege
  bei, prüft verfügbare Auswahloptionen und Gold-/Amber-Kosten
  getrennt und erkennt fehlende/inkonsistente Serverbelege.
- Das gewöhnliche Runtime-Sampling und `ALBot.status().cave`
  lösen **keine** Spiel-API-Anfrage aus.
- Nur der ausdrücklich aufrufbare read-only-Befehl
  `ALBot.refreshCaveVisit()` ruft `cave_info()` auf, höchstens
  einmal je 60 Sekunden und ohne parallele Wiederholungen. Antworten
  aus älteren Sessions/Realms dürfen keine neuen Berechtigungen
  hinterlassen. Bei fehlender API oder unklarer Antwort gilt
  `visit:null`.
- Sämtliche Cave-Statusbelege tragen `executable:false` sowie
  `canEnter:false`, `canResume:false`, `canVote:false`
  und `canExit:false`. Es gibt **keine** neue automatisierte
  Ein-/Wiedereintritts-/Vote-/Loot-/Exit-Mutation.

## Tests und Restgrenzen

`test/roadmap-n12-cave-evidence.test.mjs` prüft Rechte,
abwesende oder remote Resumes, Pausen, ursprüngliche Teilnehmer,
Instanzverwechslung, abgestimmte Gold-/Amber-Preise, bösartige
oder unvollständige Daten, Sessionwechsel, API-Abwesenheit und
Sperren gegen parallele/stumme Wiederholungen.

W12/N12 bleibt bis zu tatsächlich abgesicherter öffentlicher
Eintrittsberechtigung, begrenzter Gruppengröße, instanzgebundenem
Combat/Vote/Recovery, Nera-Respawn und belegtem finalen Exit
**offen**. Diese Version ist ausdrücklich keine vollständige
Cave-Implementierung und kein Ingame-Livetest. Die vorhandene
Release-Signatur, persönlichen Einstellungen und Wertjournale
bleiben unverändert.
