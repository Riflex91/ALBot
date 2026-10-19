# W13 – offene Gearzusagen gegen physische Bestandskopien absichern

Stand: 19.10.2026, Ergänzung nach PR #188.

## Vorherige Lücke

Merchant-Gearziele werden durch `allocation.reserve` persistent als `reserved`, nach ungeklärtem Transfer als `unresolved`, nach bestätigter Sender-/Empfängerquittung als `delivered` gesichert. Bisher prüfte die neue Reservierung nur die aktuelle Itemkopie und Job-ID. Eine **frühere ungeklärte Zusage derselben kanonischen Itemvariante** konnte dieselbe einzelne, noch sichtbare Inventarkopie nicht hinreichend gegen eine neue Zuteilung sperren. Außerdem war `reserve(j)` mit `return true` bei inzwischen verschwundenem Gearziel für einen **bereits mit Gearziel angenommenen** Job nicht sicher.

## Neue durchgehende Kontrolle

- `unclaimedGearUnits(rows,items,item,{excludeId})` ermittelt die aktuell physisch **ungesperrten** identischen Itemeinheiten, abzüglich aller persistenten `reserved`- und `unresolved`-Claims gleicher Itemvariante. Beschädigte Mengen/fehlender physischer Bestand werden konservativ als nicht verfügbar behandelt. `delivered` blockiert keine tatsächlich vorhandene **weitere** Kopie.
- Das vorhandene `allocation.offer()` erlaubt keine neue Zusage, wenn für diese Variante keine unbelastete physische Einheit existiert. So konkurrieren zwei Farmer nicht um dieselbe letzte Kopie; bei mindestens zwei wirklichen Kopien kann eine weitere zugesagt werden.
- `allocation.reserve()` bindet Gear-Dispatch an ein **jetzt gültiges** passendes Gearziel und dieselbe Empfänger-Session, den konkreten Gear-Slot, Item-Fingerprint, akzeptierten früheren Equip-Fingerprint und die unverändert noch unbelastete physische Einheit. Das erneute Persistieren desselben Jobs erfordert identische Empfänger- und Slotdaten, Itemvariante und Menge.
- `allocation.guard()` überprüft diese Bindung unmittelbar vor dem `send_item`-Dispatch. Vor der ersten Reservation ist ein geprüfter, live unbelasteter Job zulässig; **nach** persistierter Reservation bleibt ausschließlich dieselbe belegte Transfer-ID erlaubt. Ein verlorenes Gearziel, geänderte Session/Equip-Snapshot, anderer Realm oder eine verdrängte Itemkopie verweigert die Ausführung.
- Die bisherige zweiphasige Logistik mit `allocation.accept/reserve/guard/settle`, Empfängerquittung, `beginValue/endValue`, Benutzerregeln und Kapazitätsprüfung bleibt die einzige Ausführungsautorität. Ungeklärte Wertjournale werden **nicht** durch heuristische Zeitabläufe, verlorene Heartbeats oder bloß vermuteten Erfolg quittiert.

## Grenze

Das Inkrement schließt **Doppelzusagen bei bekannter persistenter Gear-Claim-Lage**. Es ist keine vollständige accountweite Rewardverteilung, kein erzwungenes Recovery eines `unresolved`-Belegs und keine Verifikation in einer realen Adventure-Land-Sitzung. Das signierte Bootstrap-Release bleibt unverändert.
