# W12/N12 – Cave-Notfallkoordination bei kritischer Mehrfachaggro

20. Oktober 2026. Inkrement nach PR #288.

## Ziel und Abgrenzung

Das Cave-Team besitzt eine begrenzte Abwehr gegen bis zu drei bereits
gebundene Gegner, eine konservative Ranger-Zielpriorität und eine
risikoorientierte Priest-Einzelheilung. Bei fehlender Überlebensreserve
fehlte bisher ein einheitlich sichtbarer **Notfallzustand**, der
gleichzeitig neue Angriffe und direkte Bewegungsansätze sperrt,
ohne den medizinischen Notpfad zu blockieren.

`src/world/cave-critical-response.mjs` stellt einen ausschließlich
beobachtenden Zustand für Ranger und Priest bereit:

- `bounded-multi-aggro`: Zwei/drei bestätigte Aggressoren,
  vollständige aktuelle Cave-Team-/Peer-Belege, 4-Sekunden-Rohschaden
  mit Faktor 1,5 und Reserve oberhalb des Maximums aus 35% HP und
  150% kumulierter Einzeltreffer-Spitze. Dieser Zustand **gibt selbst
  keine Angriffsberechtigung**, sondern belässt bestehende Ranger-
  `canDefend`-, Cooldown-, Threat- und kumulative Damage-Gates.
- `critical-hold`: Mitglied unter 70% HP oder in vier Sekunden
  unter dem geschützten HP-Boden. **Keine neuen Ranger-Angriffe,
  Priest-Positionierungs- oder Ranger-Direktschritte**; bereits
  laufende Direktschritte werden bei der Cave-Farmer-Abfrage gestoppt.
  Der normale, belegte native Priest-Einzelheal bleibt vorrangig.
- `unverified` beziehungsweise `emergency-unknown`: Aktuelles
  Trio, Zielzähler, Realm/Floor, Zahl der Monster, Gegner-/Schaden-
  definition oder Heartbeat ist ungeklärt. **Fail closed** für
  Offensive und die drei vorhandenen direkten Cave-Bewegungsowner.
  Der bewährte Heilpfad bleibt für bestätigte einzelne
  Verletzte verfügbar.
- `single-engagement` und `no-engagement`: Kein neuer
  globaler Bewegungs- oder Kampf-Guard über die bereits vorhandene
  lokale Cave-Berechtigung hinaus.

## Technischer Vertrag

Die Statusprüfung verlangt denselben belegten Cave-Run,
Originaltrio und frische Daten wie `caveTeam.healStatus()`, damit
auch verwundete Teammitglieder beurteilt werden können. Die
komplette lokale Monsterliste, vollständige engagierte Monster-
identitäten und positive offizielle `attack`-/`frequency`-Werte
sind für Mehrfachaggro nötig. Peer-\`threats\` müssen für
die zwei anderen Spieler den gezählten Angreifern entsprechen.
Unendliche oder widersprüchliche HP-Werte führen zu Sperre.

Die Aktionseinbindung ist streng:
- Der Cave-Farmer **versucht Priest-Heilung zuerst**, selbst wenn
  `holdOffense` wahr ist.
- Nur wenn nicht gehalten wird, können die bisherigen
  `cave-priest`, `cave-evade`, Ranger-`cave` und
  `cave.defense.basic`-Pfade über ihre eigenen Zulassungsgates
  geprüft werden.
- Der Ranger-Preflight überprüft den aktuellen Notfallstatus
  **vor jeder Angriffszulassung** und bindet dessen
  deterministische Monster-/Roster-Signatur an den bereits
  bestehenden Executor-Guard und die erneute native
  `attack`-Prüfung. Eine geänderte Gefahrenlage kann kein
  altes Angriffsrecht reaktivieren.
- Es gibt **keine neue Fähigkeit, AoE, Pull-Berechtigung,
  Raum-/Floor-Bewegung, Lootaktion oder Konto-Wertmutation**.
  Status und Telemetrie enthalten keine veränderbaren Spiel-Entities.
- Kein automatischer `town`, `smart_move`, Teleport oder
  Rückzug durch unbekannte Instanzkorridore.

## Restarbeiten und Abnahme

Es fehlen weiterhin ein geometrisch belegter Mehrfachgegner-
Fluchtweg, echte rollenübergreifende Bewegungsvoten,
koordinierter Abschluss von Cave-/Crypt-Encountern sowie der
durchgehende Ingame-Livetest. Eine 4-Sekunden-Rohschadensprognose
ist eine konservative Schätzung und keine Überlebensgarantie.

`test/roadmap-n12-cave-critical-response.test.mjs` deckt
gesunde defensive Situationen, kritische HP-/DPS-Fälle,
inkonsistente Heartbeats und Monster, verzögertes und natives
Angriffs-Dispatch sowie die Priorität lebensrettender
Priest-Heilung und den Stopp laufender Direktschritte ab.

Die persönliche `ALBotConfig`, bestehende Wertjournale,
Verlustgrenzen und separat signierte V2-Ingame-Runtime
bleiben unverändert.
