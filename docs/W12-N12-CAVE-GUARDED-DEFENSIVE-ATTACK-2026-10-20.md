# W12/N12 – Engagierte Cave-Teamverteidigung mit exakt geprüften Ranger-Basisangriffen

Stand: 20. Oktober 2026.

## Ausgangspunkt

PR #271 isolierte instanzgebundene `zone_<run>_<floor>`-Maps vor normalen Overworld-Farmwegen, neutralen Pulls und beliebigen Zielfreigaben. Der Cave-Teamadapter lieferte daraufhin einen rein lesenden, auf eine aktuelle Trio-Aufstellung und Priest-Nähe begrenzten Fokus auf Gegner, die bereits nachweislich Teammitglieder angreifen. Es gab noch **keine** instanzgebundene Angriffsaktion.

## Implementiert

- Neues eigenständiges `src/world/cave-defensive-combat.mjs` mit `caveDefensiveAttackPreflight` und `createCaveDefensiveCombat`. Der neue Executor **erlaubt Ranger-Basisangriffe ausschließlich gegen einen bereits eigenen Teamteilnehmer angreifenden Cave-Gegner**, nicht gegen neutrale Spawns, fremde Teamgegner oder Monster anderer Floors.
- Vor jeder Zulassung verlangt der Adapter die **frische, vollständige und dauerhaft an Run/Floor/Realm/Charakter gebundene** Trio-/Priest-Aufstellung von `caveTeamCoordination`. Die bekannte Priest-Abstandskontrolle, Mindestgesundheit, Map-/Floor-Konsistenz und aktuelle Teamheartbeats bleiben Voraussetzung. Ein pausierter Run, ein ungeklärter Exit oder eine abweichende Run-ID sind gesperrt.
- Nur ein aktiver eigener **Ranger** darf Basisverteidigung ausführen. Der Priest erhält keine zusätzlichen Angriffsaufträge. Die eigentliche `bot.entity(focusId)`-Beobachtung muss ein gegenwärtiges lebendes, nicht unverwundbares `type:'monster'`-Entity sein. Zielperson, Monster-ID, Instanz-Map, physische Angriffsreichweite, aktuelle positive `combatAssessment.canDefend`, bestehende Threat-/Boss-Sperren, `can_attack` und Cooldown werden erneut geprüft. Unverifizierbare Threat-Capability bleibt **keine** Angriffsfreigabe.
- Die Aktion läuft über den normalen bounded `Executor.run('cave.defense.basic',['attack','mana'],...)`. Dessen Guard wird bei Ausführung erneut geprüft; unmittelbar vor dem einzigen `attack`-Serveraufruf erfolgt **eine weitere vollständige Prüfung mit dem anschließend verwendeten aktuell aufgelösten Monsterobjekt**. Verändert sich Team, Run, Floor, Ziel oder Cooldown zwischen Planung und Dispatch, wird nicht angegriffen.
- In `farmer.tick()` bleibt die Overworld-Instanzisolation bestehen. Ihre Cave-Verzweigung darf jetzt ausschließlich den dedizierten defensiven Adapter aufrufen; sie wählt keine normalen Farmmonster, löst kein `change_target`, keine Skills/AoE und keine Farm-/Follow-/Kiting-Bewegung aus. Bereits vorhandene gewöhnliche Bewegungsaufträge werden weiter beendet.
- `ALBot.status().caveCombat` zeigt die lokale Guard-Diagnose und Zahl der über den Executor angenommenen Angriffsvorhaben. Ein angenommenes Vorhaben ist **keine bestätigte Schaden- oder Killquittung**. Es werden keine Game-Entity-Objekte in den Status übernommen.
- Der normale Farmer-Kampf außerhalb einer erkannten Cave bleibt unverändert. Die signierte Ingame-Runtime und persönliche Einstellungen bleiben getrennt und unangetastet.

## Testumfang und offene Roadmap

Neue Offline-Regressionsfälle testen Priest-Angreifer-Fokus, neutrale/irrelevante Gegner, veraltete Server-/Heartbeatdaten, verlorene Trio- oder Heilerunterstützung, unterschiedliche Runs/Floors, HP-Untergrenzen, Cooldown und Reichweite, fehlende/verneinende Gefährdungsprüfung, blockierende Wirtschafts-/Account-Aktionen sowie **einen verzögerten Executor-Dispatch mit zwischenzeitlich geänderter Monster-/Run- oder Priest-Evidenz**. Ein integrierter Farmer-Tick muss weiterhin ohne Overworld-Farmziel, Wegbewegung, Flächenskill oder neutrale Pulls bleiben.

**Noch offen**: instanzgebundene Priest-Heilung, echte sichere Bewegungs- und Fluchtplanung, Mehrgegner-Risikogrenzen, verifizierte Treffer-/Killbelege, zusammenhängender Expeditionscontroller, Loot-/Exit-Liveabnahme und Crypt-Instanzen. Diese Änderung behauptet keine reale Ingame-Abnahme und keine Freigabe für autonome neutrale Cave-Pulls.
