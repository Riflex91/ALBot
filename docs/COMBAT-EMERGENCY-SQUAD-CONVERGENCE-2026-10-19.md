# ALBot 0.16.0-candidate – Notfall-Sammeln und Teamkampf

## Reproduziertes Live-Fehlerbild (19.10.2026, USIV / mansion)

Aus den vom Nutzer exportierten Testlogs:
- 3 selektierte Farmer (My_Ranger1, My_Ranger2, My_Priest), gemeinsame Party, frische gegenseitige Heartbeats.
- Insgesamt 726 Bewegungsanforderungen und nur 21 normale Angriffe; davon 718 `owner=kite`.
- Alle drei ohne `teamPlan.current`, ohne `plan.selected`, ohne geplanten Farmbereich.
- Gefährliche Rat-Aggro, teils andere nicht verifizierte Angreifer; eigene Ausweichbewegungen gewinnen gegen die Wiedervereinigung.
- Die Teamplanung kehrte bei aktivem `combatAssessment.emergency().active` vor jeder Planberechnung zurück.

## Korrektur (kontrolliert und nicht-kämpfend)

1. `team-plan.tick()` friert bei aktivem Notfall einen **gültigen** Farmplan ein, lässt aber die Wahl/Übernahme eines sicheren gemeinsamen Ziels zu, wenn kein gültiger Plan existiert. Bestehende Kampf- und Pull-Freigaben bleiben unverändert.
2. `safeSquadConvergenceStep()` erzeugt ausschließlich kurze direkt begehbare Schritte zu **frisch bestätigten**, lebenden eigenen Teammitgliedern auf demselben Realm und derselben Map/Instanz. Ranger orientieren sich an einem aktuellen Priest, der Priest am Leader.
3. Die aktuelle Position (`real_x/real_y` falls verfügbar) aller beobachteten Angreifer bestimmt die Sicherheitsabstände; der Regroup-Schritt darf tatsächlichen Angreifern nicht deutlich näher kommen oder durch eine vorher freie hostile Zone laufen.
4. Der Bewegungs-Owner `regroup` bleibt während eines laufenden Schritts stabil und wird nicht durch normalen Orbit neu beplant; bei fehlender sicherer Route greift weiterhin die defensive bisherige Kiting-/Retreat-Logik.
5. Keine zusätzliche Angriffsfreigabe, keine Abschwächung von `neutralPullReadiness()`, `safeTarget()`, `estimateThreatCapability()` oder der Heiler-/Wertaktionssperren.

## Offline-Nachweis und noch offener Spieltest

- Neue Regressionen: aktuelle/abgelaufene Teamanker, Map-/Instanztrennung, sichere Annäherung trotz eigener Rat-Aggro, gesperrte Wege, tatsächliche Monsterkoordinaten.
- Die Linux-Branch-Builds bauen Runtime, Editor und personalisierten Vergleichscode; Testlauf und vollständige PR-CI dokumentieren die jeweiligen Ergebnisse.
- Der reale Dreierteam-Test mit dieser **neuen** signierten Runtime ist noch nicht durchgeführt. Erfolg erst bestätigen, wenn `party.emergencyConvergence`, `plan.selected`/Adoption, fallende Gruppenabstände und gemeinsame `attack`-Ergebnisse in frischen Live-Logs gemessen werden.
- Das Bootstrap-Manifest bleibt signiert. Die bestehende Loader-URL, öffentliche Schlüsselidentität und die persönliche `globalThis.ALBotConfig` werden nicht ersetzt.
