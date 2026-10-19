# W13 – Persistente Gear-Claim-Audit ohne vorschnelles Entsperren

Stand: 19.10.2026; Folge von PR #189.

## Ausgangssituation

Die bestehende Teamlogistik kann bei einem verlorenen `send_item`-Quittungssignal einen Auftrag als **unbestätigt** archivieren, statt den Serveraufruf blind zu wiederholen. Die zugehörige Gearzusage im Merchant-Ledger bleibt zu Recht `unresolved`. Das vorhandene `inspectPairedItemTransfer` wertet korrespondierende Inventarveränderungen ausdrücklich nur als Diagnostik; selbst gepaarte Deltas sind **keine** unabhängige Serverquittung. Eine ausgerüstete passende Waffe allein belegt ebenso wenig, dass genau die offene Transfer-ID sie geliefert hat.

## Dieses Inkrement

- `ALBot.status().gearAllocationRecovery` und der vollständige Testreport zeigen eine **read-only** Auswertung der bisherigen dauerhaften `reserved`- und `unresolved`-Gearzusagen: Transfer-ID, Empfänger, Itemvariante, Gear-Slot, noch getragene gleiche Itemmenge, verifizierte aktuelle Realm-/Empfängersession, passender Equip-Snapshot und ein eventuell früher protokolliertes Empfangsquittungs-Flag.
- Selbst wenn ein Empfänger die passende Waffe tatsächlich ausgerüstet hat und der Sender keine Kopie mehr trägt, bleibt `requiresManualReview:true`, `canClearClaim:false`, `canResend:false`. Es wird kein zusätzlicher `send_item`-Befehl und keine Reconciliation-Schreibaktion ausgelöst.
- **Claim-Fensterverlust verhindert:** Ein 64-Einträge-Limit darf alte `unresolved`- oder `reserved`-Zusagen nicht abschneiden. Bei normaler Historienkürzung werden ausschließlich abgeschlossene Einträge verworfen; alle offenen Zusagen bleiben erhalten. Übersteigt der offene Bestand selbst 64 Einträge, wird **keine** neue Gearzusage zugelassen (`unsafeHistory/blockedNewGear`), anstatt die ältesten unbekannten Verpflichtungen stillschweigend zu vergessen. Gleiches gilt für beschädigte Persistenzdaten.
- **Dauerhafte Zustandswechsel:** Auch nach sichtbar ausgerüsteter Ware wechseln Sender-Claim (`delivered → equipped`) und Empfänger-Eingang (`accepted → equipped`) nur nach erfolgreichem Speichern. Eine fehlgeschlagene Schreibaktion lässt den vorherigen in-memory Bestätigungsstatus erhalten.

Der Audit zeigt maximal 32 der aktuell offenen Claims pro Abfrage, während der sichere Hauptzähler alle offenen erfasst. Er löscht keine Bestände oder Historien und erteilt keine neuen Senderechte. Vor einem automatischen Entsperren ungeklärter Gearzusagen müsste **ein eindeutiger, dauerhaft zugeordneter Abschlussbeleg für genau die Transfer-ID** (nicht nur ähnliche Sender-/Empfängermengen) vorhanden sein. Eine solche neue Servergarantie ist derzeit **nicht belegt**; automatische Freigabe ist deshalb ausdrücklich **nicht** implementiert.

## Tests und Grenzen

Offline-Regressionsfälle decken übergroße Historien, beschädigte Speicherung, Live-Session-/Realm-Drift, geschützte Originalzusagen, Empfänger-Gear-Zustand, frühere Empfangshinweise, ausfallende Speicherwrites und weiterhin unterbleibende Resends ab. Kein echter Spiel-Transfer und kein signierter Bootstrap-Release.
