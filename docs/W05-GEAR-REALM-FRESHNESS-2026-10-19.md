# W05/W08 – Realm- und Frischebindung der Gear-Fairness (19.10.2026)

## Befund

Die bestehende automatische Gear-Aufholpriorität war ein
**Planungssignal**, keine Kauf- oder Transferberechtigung.
`crossRoleGearPriority` verwarf zwar zu alte Snapshots, verwendete
aber trotz des dokumentierten Realm-Schutzes Profile aus anderen
Realms als Stärkerückstand-Referenz. `gearCatchUpPriority` ließ
selbst sehr alte, unvollständige oder ungültige Klassenprofile in
den Aufholbonus einfließen. Außerdem setzte `createGear.refresh()`
das Gear-Beobachtungsdatum bei jedem erneuten Heartbeat auf den
aktuellen Zeitpunkt, selbst wenn das Gear-Snapshot selbst unverändert
alt war.

## Umsetzung

- Beide Aufholfunktionen akzeptieren nur vollständig adressierte,
  gleich-realmige Profile mit belegtem Gearzeitpunkt, höchstens
  sieben Tage alt, nicht aus der Zukunft und mit gültigen
  Slot-Leveln.
- Bei der Gleichklassenprüfung werden exakt die 15 kanonischen
  Ausrüstungsslots gewertet; fremde/dynamische Felder erhöhen
  die Vergleichsdeckung nicht.
- Ein Remote-Heartbeat wird für die Profilaktualisierung
  ausschließlich verwendet, wenn die eigene `gear.realm`-Kennung
  mit dem Peerrealm und dem aktuellen Realm übereinstimmt.
  Fehlende Remote-Realm-Nachweise werden nicht automatisch aus
  der eigenen Realm-Kennung ergänzt.
- Das gespeicherte `at` ist der tatsächliche Gear-Snapshot-Zeitpunkt,
  nicht der Zeitpunkt des letzten Heartbeats. Unveränderte alte Gearinfos
  werden damit nicht künstlich verjüngt.

Die Priorität verändert weiterhin **nur automatisch generierte**
Gearziele; explizite Itemprioritäten, Zuteilungsbelege,
Schutz-/Equipguards, Budgets und Mutations-Mindestchancen
bleiben unverändert. Es werden keine Geartransfers ausgelöst
oder gespeicherte Zusagen automatisch aufgelöst.

## Nachweise und Restgrenzen

Neue Offline-Regressionen prüfen Fremdrealm, veraltete und
ungültige Eigen-/Peerprofile sowie zusätzliche nichtkanonische
Slots. Der Vergleich bleibt ein heuristisches Rollenmodell
und ist **keine** Live-Abnahme oder vollständige
accountweite Gearallokation. Signierter Bootstrap/Release
und persönliche Konfiguration bleiben unverändert.
