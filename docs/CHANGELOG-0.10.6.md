# 0.10.6-candidate – Logprüfung und neuer Goldschutz

## Ergebnis der aktuellen Logs

Geprüft wurden `test-My_Merchant-2026-10-14T18-53-45-187Z-part001.json` und `albot-teamcheck-My_Merchant-2026-10-14T19-02-16-043Z.json`. Start 20:53:45 Uhr, Pause 21:00:12 Uhr, Export 21:02:12 Uhr, jeweils Europe/Berlin. Tatsächlich ungefähr 6 Minuten 27 Sekunden aktiver Betrieb mit Version 0.10.5-candidate.

| Funktion/Korrektur | Beleg und Grenze der Aussage |
|---|---|
| Verkäufe | 7 `sell` mit Ergebnis `confirmed`. Die pauschale frühere Verkaufssperre besteht in diesem Lauf nicht. |
| Upgrades | 12 `upgrade` mit Ergebnis `confirmed`. Das bestätigt abgeschlossene Versuche, nicht zwölf erfolgreiche Levelsteigerungen. |
| Exchange | 6 bestätigte Aktionen; weitere Exchanges wurden durch das alte Stunden-Verlustbudget gesperrt. |
| Getrennte Budgetkonten | `spent=0`, `supplySpent=0`, `loss=125480`, `productionExposure=125480`. Keine Versorgungskäufe in diesem Ausschnitt; ihre korrekte Trennung ist deshalb im Liveausschnitt nicht positiv nachgewiesen. |
| Account-Produktionszuteilung | Ein früher Upgrade-Versuch wurde zurückgestellt; spätere Upgrades liefen. Eine durchgehend ausreichende Zuteilung war noch nicht gegeben. Der neue Modus ersetzt diese Geldgrenzen. |
| Compound/Zielzuteilung | Kein Compound im Log. Offline geprüft, aber anhand dieser Logs nicht live abgenommen. |
| Level-Catch-up | Auswahlgrund ist ausdrücklich Levelausgleich. `transition=null`, `lastRotation=null`; frühester Wechsel laut Status erst ungefähr 21:24:05 Uhr. Der Lauf endete vorher. |
| Ablehnungsgründe/Fensterwechsel | Kein `accountSwap` in diesem Ausschnitt. `merchant.switchBlocked` bezeichnet eine Lieferempfänger-Sperre und ist kein Charakterwechsel. Kein neuer Livebeleg für Fensterwechsel. |
| Commit, Partyaufnahme, Gruppenankunft nach Tausch | Kein Tausch, daher kein solcher Beleg. Merchant war in der bestehenden Party My_Ranger1. |
| Goldabholung | 3 Goldannahmen und 3 Goldquittungen. Farmerseitige Abschlussbelege fehlen in den hier gelieferten Merchantlogs. |
| Farmer-Itemübergabe | Ein ringsj-Angebot wurde bei 4 freien Slots durch den laufenden Kapazitätsplan zurückgestellt. Kein bestätigter Empfang in diesem Ausschnitt. Neue Vorbereitung schafft vor Goldfahrten zusätzliche freigegebene Kapazität. |
| Bank | 4 bestätigte Einlagerungen, 6 Reclaims, 3 Goldbewegungen, eine Retrieval- und eine Merge-Retrieval-Aktion. Das beweist Aktivität, nicht dauerhaft ausreichende freie Bankkapazität. |

Die Screenshotmeldung „Stündliches Verlustbudget ausgeschöpft“ bezieht sich auf konservativ verbuchte Itemexposition. Beispiel: bereits 125.480 Exposition plus weiterer Exchange-Input von 144.000 überschreiten 250.000. Das ist kein Nachweis, dass tatsächlich 85 % des Accountgoldes verloren gingen.

Zusätzlicher Teleportfehler: `travel.town` und `gear.equip` starteten beide um 20:56:52.119 Uhr. Um 20:57:07.190 Uhr wurde Town als Timeout beendet. Im offiziellen Spielserver setzt der Equip-Handler `player.c={}` und beendet damit laufende Kanäle. Diese Kollision ist nun vor Einreihung und nochmals unmittelbar vor Dispatch gesperrt. Die Merchant-Auftragswahl hält außerdem einen gerade begonnenen Town-Kanal fest, statt im selben Frame zu einer anderen Aufgabe zu wechseln. Das ist eine aus Ablauf und Servercode abgeleitete Ursache; die neue Liveabnahme steht aus.

## Neues Verhalten

Das gelieferte persönliche Profil verwendet `merchant.budgetMode="account-loss"`. Der alternative Modus `bounded` bleibt für andere Profile verfügbar.

Im neuen Modus sperren frühere Stunden-, Regel-, Ziel-, Account-Anteils- und 24-Stunden-Varianten-Geldbudgets die Produktion nicht mehr. Das gilt auch für automatische Produktionsplanung, Helper-Geldgrenzen und kumulative Bankerweiterungsbudgets. Historische Ledger bleiben als Auditdaten erhalten. Explizite Stück-/Preisgrenzen, Itemschutz, Keep-/Teamreserven, Produktionszuteilung, erlaubte Ziellevel, Mindestchancen, physische Kapazität, tatsächlich zahlbare Kosten einschließlich gebundener Handelszusagen und offene Wertjournale gelten weiter. Ein nicht freigegebener oder unmöglicher Vorgang wird deshalb nicht allein durch den neuen Budgetmodus ausführbar.

Der neue finanzielle Notstopp betrachtet ausschließlich echtes Gold: Gold aller eigenen Charaktere einschließlich Offlinecharakteren plus Bankgold. Itemwerte und erwartete Inputverluste zählen nicht dazu. „Rapid“ ist hier als rollendes Zeitfenster von 15 Minuten festgelegt. Der Referenzwert ist der höchste vollständig belegte Gesamtgoldstand innerhalb dieses Fensters. Beispiel: Referenz 10.000.000 Gold, aktuell höchstens 1.500.000 Gold ⇒ mindestens 85 % Verlust. Zwei getrennte vollständige Beobachtungen unter der Grenze lösen eine persistente Sperre aus. 1.510.000 Gold lösen sie nicht aus.

Unbekannte Charakter-/Bankstände werden ausdrücklich als unbekannt behandelt. Bei unvollständigen Daten werden weitere Aktionen nicht durch ein Ersatzbudget gesperrt; der Bot meldet `account.gold-loss-unavailable`. **In dieser Zeit ist die 85-%-Prüfung nicht vollständig möglich.** Ein frischer Banknachweis gilt 120 Sekunden. Er stammt von einem tatsächlichen Bankbesuch; laufende Journale und Goldtransfers verhindern widersprüchliche Summen. Goldtransfers haben zusätzlich mindestens 30 Sekunden Beobachtungs-Sperrfrist. Die Prüfung garantiert daher keinen sofortigen Stop während einer solchen Übergabe oder einer Datenlücke.

Die vom Benutzer bestätigten aktuellen Offlinewerte sind im Profil als Startwerte hinterlegt: My_Mage, My_Priest, My_Rogue und My_Warrior jeweils 0 Gold. Eine später live beobachtete Balance ersetzt den Startwert; beim folgenden Logout wird dieser zuletzt beobachtete Betrag gespeichert. Ein neuer unbekannter Offlinecharakter wird nicht automatisch als goldlos angenommen.

Nach einem ausgelösten Notstopp propagiert der Merchant die Sperre an seine Botfenster. Diese pausieren den Betrieb, sobald sie die Meldung erhalten. Laufende Wertjournale bleiben erhalten. Eine Code-Neuladung hebt die persistente Sperre nicht auf. Pausierte Fenster senden weiterhin ausschließlich Statusmeldungen, damit eine manuelle Prüfung und Freigabe möglich bleiben.

Vor einer neuen Goldfahrt versucht der Merchant alle gerade ausführbaren sicheren Stapelzusammenführungen, erlaubten Ganzstapel-Einlagerungen und freigegebenen Verkäufe. Er fährt nicht bereits los, nur weil vier freie Slots vorhanden sind. Jede Bereinigung wird über die bestehenden Wertjournale abgeglichen; während der Vorbereitung wird keine andere normale Merchantaufgabe im selben Frame begonnen. Wenn keine weitere erlaubte Bereinigung ausführbar ist, kann die Goldfahrt stattfinden. Geschützte Items oder eine volle Bank werden nicht durch willkürliche Verkäufe umgangen. Items, die noch keine Verkaufs-/Bankfreigabe haben, bleiben erhalten.

## Verwendung und Prüfung

1. `ALBot-0.10.6-Spielbot.js` im CODE-Slot des Merchants **und aller aktiven Farmer** speichern und starten. Alle müssen dasselbe neue Profil/Protokoll verwenden. Für Catch-up auch das neue CODE im zu wechselnden Browserfenster speichern; der vorhandene Fensterwechsel verwendet den gespeicherten CODE-Slot.
2. Die bisherige CODE-Datei sichern. Keine alten Inventarjournale oder Budgetdaten pauschal löschen.
3. `ALBot.accountGoldStatus()` zeigt `snapshot.complete`, den Gesamtwert, eine eventuelle Datenlücke und den Auslöser. Für einen ersten vollständigen Banknachweis den Merchant regulär an der Bank arbeiten lassen.
4. Neue Logs sollten `merchant.goldPickupReady` vor einer Goldfahrt sowie normale Bank-/Verkaufsaktionen der Vorbereitung zeigen. Geschützte Slots werden dabei erhalten.
5. Den Levelausgleich länger als die vorhandene 30-Minuten-Mindesthaltezeit beobachten. Erwartete Belege: neuer `accountSwap`, passender frischer Incoming-Heartbeat, endgültiger Teamcommit, `account.party-joined`, anschließend `account.group-arrived`. Ein fehlender Tausch in einem sechsminütigen Lauf ist kein Fehlerbeweis.

Nach einem echten Goldnotstopp zuerst Ursache und Goldstände prüfen. Alle betroffenen Fenster pausiert lassen; bei Bedarf Bank manuell aufsuchen, damit die Bankbeobachtung frisch ist. Erst dann im Merchant-CODE `ALBot.acknowledgeAccountGoldLoss()` ausführen. Die API verweigert Freigabe bei laufendem Merchant oder unvollständigem Goldnachweis. Sie setzt einen neuen belegten Referenzwert und verteilt die Freigabe; danach die Botfenster wieder starten. Niemals zum Test echtes Accountgold vernichten.

## Validierung

770/770 Offline-Tests bestanden. Neue Regressionen prüfen 85-/84,9-%-Grenze, rollenden Peakablauf, persistente Sperre, unvollständige Werte, Transfer-Sperrfrist, Offlinewerte nach Logout, pausierte Teilnehmer, kontrollierte Freigabe, alte Budgetüberschreitungen einschließlich echter irreversibler Dispatches, Town-/Equip-Kollision und zusätzliche Inventarbereinigung vor der Goldroute. Runtime, persönliche Quellcode-Datei und eigenständige Werkstatt wurden gemeinsam neu gebaut. Kein Eingriff in laufende Spielcharaktere; die neue Liveabnahme steht aus.
