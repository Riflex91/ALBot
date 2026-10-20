# N12/W12 – konservative direkte Cave-Gruppenkohäsion

Stand: 20. Oktober 2026. Nächster begrenzter Implementierungsschritt nach
PR #274: Das Team kann bei bestätigter, monsterfreier Cave-Instanz einen
kurzen Ranger-Direktschritt in Richtung des **sichtbaren eigenen Priests**
ausführen. Dies ist **kein Navigationsmesh, kein smart_move und keine
vollständige autonome Cave-Expedition**.

## Sicherheitsvertrag

- Nur ein laufender Farmer/Ranger in exakt demselben Cave-Run, Floor,
  Realm und der lokalen instanziierten Map darf einen Schritt vorbereiten.
- Eigene Cave-Sichtprobe höchstens drei Sekunden alt, durable
  `observed-run`-Beleg, aktives unverändertes ursprüngliches Trio,
  `party.waitForTeam`, frische Peer-Heartbeats, lebende Mitglieder
  mit mindestens 70 % HP und aktuell direkt sichtbarer Priest.
- Die Priestposition muss im Heartbeat und im live aufgelösten Entity
  innerhalb von 12 Pixel übereinstimmen. Kein Schritt, wenn der Ranger
  bereits höchstens 130 Pixel entfernt oder mehr als 240 Pixel entfernt
  ist; alle ausgewählten Mitglieder bleiben höchstens 280 Pixel vom
  Priest entfernt.
- Sichtbare lebende oder mengenmäßig unbekannte Cave-Monster auf
  derselben Instanz-Ebene und Monster, die irgendein Teammitglied
  angreifen, blockieren den Schritt vollständig. Kein Neutralpull.
- Ein Schritt bewegt höchstens 35 Pixel und darf nur mit ausdrücklich
  positivem `can_move_to(x,y)` auf derselben Map erfolgen.
  `movement.local(...,'cave',admission)` erhält eine an Run/Floor,
  Priest und unveränderte Koordinaten gebundene Funktion, die unmittelbar
  vor dem tatsächlichen nativen `move` alles erneut prüft.
- Auch der gemeinsame Movement-Executor begrenzt Cave-Hops auf 45 Pixel,
  prüft `can_move_to` erneut und **darf niemals** auf
  `smart_move`, Blink oder Town zurückfallen. Fremde/native
  Bewegung und Wertaktionen haben Vorrang. Bestehende Cave-Routen
  werden bei verlorenen Belegen oder neuen Monstern abgebrochen.
- Im Farmer-Tick bleiben Priest-Heilung und bereits erlaubte engagierte
  Ranger-Verteidigung vorrangig. Die Cave darf weiterhin keine
  Overworld-Farmroutine, AoE, offene Gegnerpulls oder unabhängige
  Karte-zu-Karte-Reise ausführen.

## Abnahme und Grenzen

Gezielte Regressionstests erzwingen positive Direktfreigabe,
Monstersperren, Realm-/Floor-/Roster-/Priest-/Session-Drift, fehlende
native Wegfreigabe, Dispatch-Races, Konkurrenz mit anderen
Bewegungsaufträgen und Nichtverwendung von `smart_move`.

Bekannte Restgrenzen: Nicht beobachtbare Monsterspawns und dynamische
Hindernisse können nicht mathematisch ausgeschlossen werden. Deshalb
sind die Schritte auf direkte, kurze, native-seitig bestätigte,
monsterfreie Bereiche begrenzt. Es fehlt weiterhin ein entwickelter
Kartenmesh-/Pathfinding-Vertrag für Cave-Floors, eine automatische
Fluchtstrategie bei Mehrfachaggro, Gruppencombat, Encounterwahl,
Lootabschluss, vollständige Crypt-/Cave-Runs und echte Ingame-Liveabnahme.
Ein `move`-Promise ist keine bestätigte physische Ankunft; die
bereits vorhandene Movement-Observation bewertet sie separat.
Keine automatische Signierung oder Änderung persönlicher Werte,
Risikolimits oder Konfiguration.
