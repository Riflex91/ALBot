# Teamlauf vom 6. Oktober 2026

**Nicht bestanden.** Vier Browserberichte von Bot 0.1.1-live-a, etwa 20:49–20:51 Uhr Europe/Berlin. Kein Headless-Nachweis. Die Dateien enthalten jeweils die letzten 256 Ereignisse; ältere Einträge wurden begrenzt verworfen. Aussagen über Aktionen beziehen sich deshalb auf den erhaltenen Ausschnitt.

| Charakterrolle | Laufzeit ungefähr | CM-Speicherfehler im erhaltenen Ausschnitt | Erhaltene Aktionsanfänge |
|---|---:|---:|---|
| Ranger 1 / Leader | 99 Sekunden | 141 | 47 × loot |
| Ranger 2 | 131 Sekunden | 138 | 48 × loot |
| Ranger 3 | 134 Sekunden | 136 | 49 × loot |
| Merchant | 135 Sekunden | 134 | 50 × loot |

Bei allen vier Instanzen scheitert der Checkpoint mit `QuotaExceededError`. Der offizielle Browser-Aufruf `send_cm` verwendet für lokale Charaktere `send_local_cm` und damit localStorage; auch diese Schreibvorgänge scheitern. Ohne frische Statusmeldungen hält die Farmer-Logik bei aktiviertem `waitForTeam` an. Dies passt zu unveränderten Positionen, HP/MP und leeren Zielen in sämtlichen erhaltenen Samples. Der konkrete Wartegrund war im alten Sampleformat nicht enthalten; ab 0.1.2 wird er mitgeschrieben.

Alle Berichte enden geordnet mit `Entladen`, ohne offene Aktionen oder unbekannte Inventarmutation. Das belegt Start, Scheduler, Berichtsexport und geordnetes Ende, aber keinen funktionierenden Teamkampf. Ein zurückgekehrter Loot-Aufruf belegt weder einen Kill noch erhaltene Beute. Lieferung, Fokusziel und funktionierende CM-Zustellung sind nicht nachgewiesen.

Unabhängiger Konfigurationsfehler: Beide Trankregeln verlangen `hpot1`. Im exportierten Merchant-Inventar liegen insgesamt 27.101 `hpot0`, aber keine `hpot1`. Die Lieferung ist damit auch bei freiem Storage nicht möglich. Keine automatische Ersetzung von Item-IDs: Nutzerregeln bleiben maßgeblich.

## Korrektur und gezielte Wiederholung

- Bot 0.1.2 fordert `performance_trick()` beim Laden im Browser automatisch an, auch bei ausgeschaltetem Bot-Autostart und UI. Ein bereits spielender Loop wird nicht doppelt gestartet. Headless überspringt den Aufruf. Pause beendet den Spiel-Audio-Loop nicht. Testberichte enthalten `performanceTrick.state`: `requested` bedeutet Aufruf erfolgt, nicht bewiesene Audiofreigabe. `already-playing` bedeutet, dass die Spiel-Audioinstanz bereits Wiedergabe meldete. Browser-Autoplay kann einmalige Benutzerinteraktion erfordern.
- Für den nächsten Browserlauf freien Website-Speicher verwenden, beispielsweise ein separates frisches Browserprofil und alle vier Spielseiten darin. Alte Spielseiten vorher ausloggen. Dies erhält den bisherigen Speicher zur späteren gezielten Untersuchung. Keine pauschale Löschung vorhandener CODE-/Botdaten. Falls selbst das frische Profil wieder vollläuft, zuerst den verursachenden Speicherverbrauch untersuchen.
- Vor dem Lieferteil müssen alle vier Berichte `checkpointMode: persistent` zeigen und die Teamkommunikation funktionieren. `performance_trick` repariert keinen vollen Speicher. Der Bot umgeht fehlende Liefer-Checkpoints weiterhin nicht.
- Entweder passende `hpot1` bereitstellen oder **beide** Regeln in der Werkstatt bewusst auf `hpot0` ändern. Für eine kleine Lieferung Zielbestand beim Empfänger auf aktuellen Bestand plus 5 und Batch/MaxDelivery auf 5 setzen. Der bestehende persönliche Profilinhalt wurde nicht verändert.
- Neues Bundle auf allen vier Charakteren laden, Browser-Audio nötigenfalls einmal durch Interaktion freigeben und kurz Teamkampf/Fokusziel sowie genau eine kleine Lieferung beobachten. Vorher-/Nachher-Bestände auf beiden Seiten prüfen und Logs exportieren. Headless-Nachweis separat mit demselben Bundle; kein gleichzeitiger Login desselben Charakters.

Keine Shadow-Tests. P3–P6 bleiben bis zum erfolgreichen Nachweis der betroffenen Live-A-Abläufe offen.

## Zweiter Browser-Teamtest mit 0.1.2-live-a

Der nächste vom Nutzer gelieferte Vierer-Lauf beseitigt den ursprünglichen Storage-Blocker: alle vier Berichte zeigen `checkpointMode: persistent`; im Browser wurde `performance_trick` angefordert. Alle drei Ranger bewegen sich im `main`-Goo-Gebiet und melden wiederholt `Kampf: goo`. Damit sind Browser-Teamkommunikation und echter Farmbetrieb grundsätzlich nachgewiesen; Headless bleibt separat offen.

Im Kampf treten auf allen drei Rangern wiederholt `attack: not_there` auf. Ranger 1 und Ranger 3 melden außerdem `loot: openning`. Diese Fehler passen zu normalen Rennen zwischen Guard und tatsächlichem Spielaufruf: ein gemeinsam fokussierter Goo kann vor dem eigenen Angriff verschwinden, und Loot kann bereits geöffnet werden. `0.1.3-live-a` normalisiert ausschließlich diese beiden bekannten Gründe als transiente Aktion, verwirft bei `not_there` das alte Ziel und zählt die Ereignisse in `actionStats`; andere Attack-/Lootfehler bleiben echte Incidents.

Der Merchant erreicht den Bereich der Farmer, aber im Bericht entsteht keine bestätigte Inventarlieferung. Ursache im Code von `0.1.2-live-a`: `travel()` berücksichtigt den gemeldeten Bedarf, die anschließende Offer-Auswahl lief jedoch wieder linear über das eigene Inventar. War das erste passende Supply-Item beim Empfänger bereits am Zielbestand, konnte dieses unbeantwortete Angebot den nächsten benötigten Artikel bis zum Timeout blockieren und anschließend erneut zuerst gewählt werden. `0.1.3-live-a` verlangt deshalb bereits vor dem Angebot einen frischen positiven `need`-Eintrag für exakt diese Item-ID, begrenzt die Menge auf den Bedarf und führt den Retry-Cooldown pro Empfänger/Item statt nur pro Empfänger.

Die zweite Auswertung zeigte außerdem, dass Skillbedingungen mit `hpRatio` den eigenen Charakter messen. Damit gegnerbezogene Regeln nicht versehentlich dieselbe Semantik verwenden, ergänzt `0.1.3-live-a` den separaten Messwert `targetHpRatio` und benennt `hpRatio` in der Werkstatt ausdrücklich als eigenen HP-Anteil.

### Gezielte Wiederholung für 0.1.3

- Browser-Team mit demselben Setup erneut starten und prüfen, dass die drei Ranger weiter normal farmen; `not_there`/`openning` dürfen unter `actionStats` als transient erscheinen, aber nicht mehr die Incidentliste fluten.
- Einen Empfänger mit vollem HP-Trank-Zielbestand und bewusst zu niedrigem MP-Trank-Bestand verwenden. Erwartete Kette: Merchant erkennt MP-Bedarf → fährt hin → bietet MP an → Empfänger akzeptiert → `send_item` → beidseitige Mengenänderung → Receipt/Done. Der volle HP-Bestand darf kein MP-Angebot mehr blockieren.
- Bericht auf `logistics.offersSent`, `acceptsReceived`, `sendsStarted`, `receiptsReceived`, `doneSent` sowie `timeouts` prüfen. Bei normaler erfolgreicher Einzellieferung sollen die ersten fünf Zähler fortschreiten und `timeouts` für diesen Auftrag 0 bleiben.
- Danach denselben Build headless ausführen. Erst Browser-Wiederholung plus Headless-Nachweis schließen Live A ab.

Keine Shadow-Tests. P3–P6 bleiben bis zum erfolgreichen Nachweis der betroffenen Live-A-Abläufe offen.
