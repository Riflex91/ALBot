# W13 – Gearzusagen an eine aktuell verifizierte Empfängersitzung binden

Stand: 19.10.2026; Entwicklungsstand `0.10.12-candidate`.

## Ausgangsbefund

Der vorhandene `createGearAllocation`-Pfad prüfte vor Gear-Reservierung
und Dispatch zwar Item-/Slot-Fingerprints, Ziel und
`peer.session`. Er verlangte jedoch nicht ausdrücklich, dass die
nach dem Empfängernamen nachgeschlagene aktuelle Heartbeat-Identität
wirklich diesem Empfänger gehört, noch aktiv und lebend ist und sich im
gleichen Realm befindet. Ein zuvor lebendiger Peer konnte zwischen
Planung und Dispatch sterben, offline gehen oder den Realm wechseln;
eine bereits persistierte Gear-Reservation ist in diesem Fall keine
selbstständige Lieferfreigabe.

## Implementierte Integrationsprüfung

`verifiedRecipient(to, session)` verlangt für neue Gear-Zusagen und
vor Gear-Reservierungen den exakten Namen, `running===true`,
`rip===false`, aktuellen Realm und eine nichtleere, bestätigte
Empfängersession. Der delayed Dispatch-Guard überprüft dieselben
Merkmale und die bereits bestehende Equip-/Item-Fingerprintbindung.
Ein gespeicherter `reserved`-Datensatz kann nach einem Realmwechsel
nicht wiederverwendet werden, selbst wenn derselbe Prozesssession-String
beobachtet wird.

Keine Zusage wird bei fehlender Evidenz automatisch gelöscht oder
als geliefert quittiert. Die bestehenden Transaktionsjournale,
Empfänger-ACKs, vollständigen Inventar-/Itemvariantenbedingungen
und die unabhängigen Logistik-Guards bleiben unverändert. Normale
`send_item`-Lieferungen ohne Gearzusage erhalten keine neue
Ausführungsberechtigung.

## Testnachweise und Grenzen

Drei neue Regressionen prüfen falsche Empfängernamen,
tote/offline/realmwechselnde Charaktere, geänderte Sessions
sowie offenbleibende dauerhafte Gear-Claims. Die älteren
Testfixtures werden um die tatsächlichen Heartbeat-Felder ergänzt.
Der Patch verhindert unzureichende Zusage-/Dispatch-Evidenz, er
beweist keinen erfolgreichen Itemtransport. Eine Ingame-Abnahme
steht aus. Kein signierter Release, keine Loaderänderung.
