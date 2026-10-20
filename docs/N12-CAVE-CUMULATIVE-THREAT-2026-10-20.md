# W12/N12 – kumuliertes Cave-Gegnerbudget für Ranger-Verteidigung

Stand: 20.10.2026. Inkrement nach #279. Kein neuer Neutralpull,
keine neue Bewegungsfreigabe und **keine autonome Cave-Flucht**.

## Fachlicher Befund

Ein Ranger durfte bisher bei nachweislich bereits engagiertem Gegner
über `combatAssessment.canDefend(m)` einen einzelnen Basisangriff
starten. Eine zwischen Planung und Netzwerkdispatch zusätzlich
aufgetauchte Cave-Aggro war nicht durch einen eigenen, an die
Instanz gebundenen Gegnergesamtbeleg abgesichert. Der gewöhnliche
Kampf-Schadensschätzer ist weiterhin zuständig; die neue Prüfung
ersetzt ihn nicht, sondern ist ein zusätzliches konservatives Gate.

## Beweisregeln

- Ausgangspunkt ist das vorhandene aktuelle `caveTeam.status()`:
  genau das lebende und verbundene Original-Trio, bestätigter
  Run/Floor/Realm, naher Priest und bisherige mindestens 70 % HP.
- Ein **einzelner** bereits gebundener Angreifer behält den bestehenden
  Prüfpfad, erhält jedoch eine Identitätssignatur, damit eine
  spätere zweite Aggro nicht während eines geplanten Angriffs
  unbemerkt hinzukommt.
- Bei **zwei oder drei** sichtbaren Teamangreifern wird pro
  Teammitglied die Zählung mit dem frischen Peer-Heartbeat
  (`threats`) abgeglichen. Beschädigte/fehlende Monster-,
  Mengen-, Map-, Floor-, Ziel- oder Accountbelege sperren.
  Mehr als drei gleichzeitige Aggressoren sperren.
- Für **alle** beteiligten Monster müssen positive, endliche
  Server-Definitionen für `attack` und `frequency` vorliegen.
  Der Schadenshorizont beträgt vier Sekunden, pro Gegner wird
  vorsichtig `attack * frequency * 1.5` pro Sekunde
  berücksichtigt. Keine optimistische Rüstungs-, Dodge-, Heil-,
  Potion-, Taunt- oder Zukunftskill-Anrechnung.
- Der zu erwartende Rest-HP-Wert muss über dem größeren Schutzboden
  aus 35 % der maximalen HP und 150 % der kumulierten
  modellierten Einzelhitspitze liegen. Fehlende Meta-Daten,
  zu wenig verbleibendes Überlebensbudget oder unsichere
  Summen **verbieten den weiteren Ranger-Basisangriff**.
- Bestehende `combatAssessment.canDefend`, Threat-, Boss-,
  Reichweiten-, Cooldown- und Host-Guards bleiben zusätzlich
  bestehen. Das neue Budget erteilt selbst keine Angriffserlaubnis.
- Vor Executor-Dispatch und unmittelbar vor dem nativen
  `attack` wird das komplette Budget wieder geprüft; die
  sortierte Gegner-ID/Zielsignatur darf nicht driften. Ein
  neues Monster, eine Zieländerung oder ein veralteter
  Heartbeat bricht einen bereits geplanten Angriff ab.
- Die eigentliche Cave-Heilung wird nicht blockiert. Beim
  negativen Budget bleibt die Cave-Farmer-Isolation erhalten:
  kein gewöhnlicher Overworld-Rückzug, kein unbekannter
  Direkt-/Smart-Move, kein neuer Pull. Sichere künftige
  Flucht- und Encounterpfade benötigen eigene Geometrie-
  und Servernachweise.

## Verifikation und Grenzen

`test/roadmap-n12-cave-cumulative-threat.test.mjs` prüft
zwei Gegner, kumulativ unsichere Treffer gegen den Priest,
abweichende Peer-Threat-Zahlen, beschädigte Monster, unvollständige
Definitionen, mehr als drei Aggressoren, Drift vor Dispatch
und neu auftauchende Gegner während eines Einzelangriffs.

Dieses Vier-Sekunden-Fenster ist ein **konservatives lokales
Eingangsschadens-Budget**, kein Beweis tatsächlicher
Trefferverteilung, Attack-Timer, Respawns, Bossmechaniken oder
Überlebensgarantie. Der Abschluss der Cave-/Crypt-Expedition,
Gruppenheilung, sichere Fluchtplanung sowie das echte Ingame-
Livetestprotokoll stehen weiterhin aus. Persönliche ALBotConfig,
Markt-/Verlustbudgets, Journale und separat signierter Release
bleiben unverändert.

## Integration mit signiertem Release 0.17

Das inzwischen nach main gemergte allgemeine Multi-Pull-Sicherheitsmodul
(PR #280) und sein signierter Release Sequence 17 bleiben erhalten.
Dieser W12/N12-Cave-Guard ist ein separates, zusätzliches Gate; er ersetzt
weder die globale Mehrfach-Pull-Prüfung noch die bestehende
Gefahrennavigation. Die Cave-Grenze vermeidet weiterhin unbekannte
Flucht- oder Navigationsschritte. Der neue Cave-Code ist erst nach eigener
Release-Signierung im Ingame-Bootstrap verfügbar.
