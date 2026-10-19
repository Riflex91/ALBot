# W13 – Empfängerjournal für Gearzusagen und physische Kapazität

Stand: 19.10.2026, Runtime `0.10.12-candidate`.

## Tatsächliche Lücke

Die W13-Transportschnittstelle nahm eingehende Gear-Angebote bislang vor
der tatsächlichen Inventar-Kapazitätsprüfung in die dauerhafte lokale
`albot:gear:<Empfänger>:allocations:receiving`-Liste auf.
War der Empfänger voll, folgte weder ein logistisches `accept` noch
ein `receive`-Journal, die gespeicherte Gearzusage blieb aber dennoch
aktiv. Der Empfänger-Allocator ersetzte vorhandene Zusagen mit derselben
ID und kürzte sein Journal mittels `slice(-15)`, womit eine
unabgeschlossene physische Zusage durch viele neue Annahmen aus dem
aktiven Verlauf verschwinden konnte.

## Umsetzung

- Bei Gearangeboten muss `quantity=1` und der tatsächlich
  verfügbare Eingangsslot bzw. eine kompatible Stapelkapazität
  erfolgreich geprüft sein, **bevor** die Gearzusage gespeichert wird.
  Bei fehlender Kapazität entsteht weder eine Gearzusage noch ein
  logistisches Empfangsjournal oder Bestätigungs-ACK.
- Eine bereits vorhandene, aktive Transfer-ID wird niemals durch ein
  neues Angebot mit anderem Sender, Session, Item oder Gearslot ersetzt.
  Diese Sperre gilt auch nach dem erneuten Lesen des Journalbestands.
- Es dürfen maximal 16 **aktive** Empfängerzusagen erhalten werden.
  Die 17. neue Zusage wird abgelehnt, statt eine der 16 vorhandenen
  anzutasten. Nachweislich abgelaufene Zusagen dürfen beim nächsten
  erfolgreichen, dauerhaften Speichern wegfallen.
- Das eingehende Angebot muss eine endliche, valide und im begrenzten
  TTL-Horizont liegende Expiry enthalten. Beschädigte oder doppelte
  persistierte Einträge werden als unbekannter Wertzustand behandelt:
  keine neue Gear-ACK, keine automatische Gear-Regel oder behauptete
  Quittung; die History wird nicht zu einer leeren Liste normalisiert.
- Ein fehlgeschlagener persistenter Schreibvorgang aktualisiert auch
  den flüchtigen Zusagenstand nicht. Die normale `send_item`-
  und Receive-Recovery bleibt unverändert.

## Tests und Grenzen

Neun neue Regressionen prüfen ACK- und Inventarkapazitätsreihenfolge,
einzelne statt partielle Gearzusagen, persistierte ID-Kollisionen nach
Neustart, volle und beschädigte Empfängerhistorien, Ablaufbelege
und fehlgeschlagene Schreibvorgänge.

Dieser Patch erzeugt **keine neuen Senderechte**, keine zusätzliche
Account- oder Gear-Transferfreigabe und keine serverseitige
Empfangsbestätigung. Der signierte Ingame-Release wird hier nicht
aktualisiert. Eine Ingame-Liveabnahme bleibt offen.
