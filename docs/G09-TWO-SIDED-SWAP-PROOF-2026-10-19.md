# G09 – Beidseitiger Beleg beim expliziten 1:1-Itemtausch

Stand: 19.10.2026, Entwicklungsruntime `0.10.13-candidate`.
Kein neuer signierter Release und keine selbständig gestartete Marktmission.

## Tatsächliche Integrationslücke

Der vorhandene, ausdrücklich freigegebene `trade_swap`-Pfad prüfte
schon den exakten Eingang (Item/Level/Variante), Listing-RID,
physischen Zahlungsschutz, Budget und die beobachtete
Inventarveränderung. Beim **ausgehenden** Item wurde die vom
fremden Listing verlangte `want`-Seite jedoch nur anhand von
Name, Level, Property und Menge geprüft. Zusätzliche
Stat-/Titelbedingungen oder nicht unterstützte `want`-Felder
konnten somit unbemerkt bleiben.

Außerdem besaß der vorgemerkte Swap keine gesonderte
Laufzeit-/Realm-Bindung, und zwischen erstem `guard` und
tatsächlichem `trade_swap` konnte die sichtbare Listing-Evidenz
altern, ohne dass der Aufruf selbst die komplette Freigabe
ein weiteres Mal prüfte.

## Umsetzung

- `exactSwapPaymentWant` vergleicht die aktuell angebotene
  Gegenleistung auf **beiden** physischen Seiten. Ein `want`
  muss Name, Level, Menge 1, Stat-Typ, Property und Titel des
  tatsächlich freigegebenen Zahlungsitems erfüllen.
  Nicht modellierte Want-Selektoren werden nicht stillschweigend
  ignoriert.
- Der Kandidat bindet konkret die Bot-Prozesssession und Realm.
  Vor einem `trade_swap`-Aufruf werden aktuelle Shop-RID,
  Partneridentität/-nähe, beide Varianten, Regel, Quota,
  Reservierung, verfügbares Inventar und der ursprüngliche
  Realm-/Sessionkontext erneut geprüft. Ein widerrufener
  Beleg erzeugt **keinen** Serveraufruf.
- Bekannte eigene Teampartner/Farmer werden nicht als
  unabhängige Fremdmarktverkäufer behandelt.
- Beschädigte Inventarvarianten oder nicht lesbare
  Ziel-/Überschussmengen beenden die Planung konservativ.
  Sie erzeugen keinen unbegrenzten Zahlungsüberschuss.
- Es bleiben **nur** separat autorisierte, nicht stapelbare
  1:1-Tausche ohne spekulative Reise oder eigene
  automatische Angebotserstellung erlaubt.

## Nachweise und Grenzen

Sieben neue Regressionen prüfen geänderte Want-Selektoren,
korrekt passende stat-/titelgebundene Zahlungen,
Session-/Realmwechsel, nachträgliches Listingdrift
zwischen Guard und Call, eigene Accounts sowie
beschädigte Stock-/Quotaabfragen.

Der Patch erweitert bewusst **nicht** auf Stapel-, Mengen-,
Mehrschritt- oder nicht modellierte Itemtauschfolgen.
Eine offizielle `trade_swap`-Response allein ist weiterhin
keine Wertquittung: physischer Itemabgang/-zugang muss
im bestehenden Economy-Journal beobachtet werden.

Keine Änderung an persönlichen Regeln, Scheduler,
Release-Signatur oder Bootstrap-Kanal; die Ingame-Liveabnahme
bleibt offen.
