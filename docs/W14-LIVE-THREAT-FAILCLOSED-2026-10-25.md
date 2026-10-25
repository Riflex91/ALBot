# W14 Hazard: Unlokalisierte lebende Gegner nicht als freie Routen behandeln
Stand: 25.10.2026 – **Offline-Kandidat, keine Ingame-Freigabe**

## Vorherige Sicherheitslücke

`threatRegions` verwarf lebende aggressive Monster, sobald `x` / `y`, `map` oder `hp` nicht die erwartete Form hatten. Ein Monster kann jedoch außerhalb seiner statischen Spawnzone wandern. Fehlende dynamische Ortsdaten sind dann keine Negativbeobachtung. Außerdem erzeugten `speed:NaN` oder `range:NaN` einen dynamischen Radius `NaN`; `segmentThreatFree` konnte den Vergleich `distance < NaN` nicht als Gefahr erkennen. Die Gefahr wurde unabsichtlich als sichere Strecke klassifiziert.

## Korrektur

Für ein aktuell als aggressiv oder aktiv zielend gemeldetes Monster wird die Karte geprüft. Bei unbekannter Karte oder innerhalb der untersuchten Karte fehlenden/ungültigen Orts-, HP-, Speed- oder Reach-Daten gibt `threatRegions` nur `ok:false` zurück. Die Bestimmung bleibt auf höchstens 512 Sichtbeobachtungen beschränkt. Ein belegbar totes Monster (`dead===true` oder `hp===0`) und ein belegbar auf einer anderen Karte befindlicher Gegner stellen dagegen keine dynamische Gefahr dieses Kartenabschnitts dar.

Die zentrale Segmentprüfung `segmentThreatFree` weist unvollständige oder ungültige Rechtecke/Kreise ab. Diese Prüfung erfolgt beim Hazard-Itinerary-Planen und beim bereits laufenden Itinerary vor dem nächsten physischen Move. Es entsteht keine neue Bewegungsfreigabe, keine Navigation durch `smart_move` und kein neuer Server-RPC.

## Tests und Freigabegrenzen

`test/20261024-hazard-portal-itinerary.test.mjs`: bekannte Live-`prat`-Position außerhalb statischer Spawnfläche, fehlende/NaN/Infinity-Koordinaten, HP und Map; ungültige Geschwindigkeiten und Ranges; nicht-arrayförmige bzw. überlange Liste; ungültige dynamische Kreise und statische Rechtecke. Der entscheidende Sicherheitsvertrag lautet: Unklare Gefahr führt zu Routenverweigerung, niemals zu einer vermeintlich sicheren Route.

Die tödliche `level1`-Durchquerung aus dem 24.10.-Vorfall und die Drafts #485/#487 bleiben gesonderte, noch **nicht** live abgenommene Arbeit. W14 setzt weiterhin beaufsichtigte echte Routenversuche, Team-Healing-Protokolle, Recovery-Belege, Portalankunft und null wiederholte unbeaufsichtigte Todesfälle voraus. CI-Erfolg ist kein W14-Livenachweis.
