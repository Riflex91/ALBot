# Merchant-Livekorrekturen 0.8.3-full

## Befund aus dem gemeinsamen Browserlauf

Vier Logs mit Start 8. Oktober 2026, 18:49 UTC (20:49 Uhr Berlin), Runtime 0.8.2-full. Der Merchant stoppt um 20:51:47 Uhr Berlin mit einem offenen gold.receive-Journal für Ranger1, Menge 100.000, Ausgangsbestand 19.556.603. Ranger1 erhielt die Zusage, hat aber kein gold.dispatched und keinen gold.send-Aufruf im Log; sein Bestand bleibt 332.838. Der Empfängerbestand blieb ebenfalls unverändert. Zwei vorherige Goldtransfers von Ranger2 und Ranger3 sind auf beiden Seiten bestätigt.

Ein paralleler Itemauftrag kann nach einem Goldangebot entstehen: Gold reserviert den gemeinsamen Logistikzustand, neue Itemangebote berücksichtigten diese Reservierung nicht. Anschließend wartet Gold auf den Itemauftrag, während der Merchant auf Gold wartet. Die konkrete interne Itemreservierung wird im alten Rangerbericht nicht ausgegeben; die Überschneidung ist als Codefehler reproduziert und mit einer gezielten Logikprüfung abgesichert. Kein Nachweis eines verlorenen Goldtransfers in diesem Ausschnitt.

Der Merchant hat vor dem Stopp bereits einen Ring eingelagert, 1.000 MP-Tränke gekauft, an Ranger2 ausgeliefert und 100 Anniversary Gifts empfangen. Es handelt sich nicht um eine vollständig ausgefallene Bank-/Economy-API. Von 42 Slots sind am Ende 39 belegt. Produktions-/Marktbesorgungen und Nachschubwege verdrängen die Reinigung; Teilentnahme benötigt freie Arbeitsplätze. Die Regeln ordnen überwiegend Bank an, nur Snowball Verkauf. Für Ringsj, HP-Amulette und HP-Gürtel ist Bank die wirtschaftliche Entscheidung, kein automatisch freigegebenes Compound. Upgrade-Scrolls haben den Spieltyp uscroll, der bisher im Schutz des Arbeitsvorrats fehlte.

## Reparaturen

Neue Itemangebote, Itemannahmen und Logistikreisen beginnen nicht während einer Goldreservierung. Ein Goldauftrag im Zustand offered/accepted, bei dem noch kein send_gold aufgerufen wurde, kann beim Ablauf oder Stoppen eine sitzungs- und auftragsgebundene goldCancel-Nachricht senden. Ein passender Empfänger darf die Empfangsabsicht nur bei unverändertem Goldbestand und ohne beobachteten Empfang abschließen. Ein bereits versandter oder beobachteter Transfer bleibt abgleichpflichtig. Fehlende Abbruchnachricht, Neustart und alte Journale werden nicht blind als erfolgreich behandelt; alte Journale bleiben erhalten.

Bei knappen Arbeitsplätzen bekommen bereits freigegebene Bank-/Verkaufsaktionen in der Merchant-Auftragsauswahl Vorrang vor normalen gehaltenen Markt-/Produktionsaufträgen. Offene Ressourcen, Wertjournale und laufende Reisen werden weiterhin respektiert. Upgrade-Scrolls (uscroll) bleiben ohne explizite anderweitige Regel im Arbeitsvorrat.

## Konfiguration und Wiederanlauf

Das persönliche Profil bleibt unverändert: partialBank=true, autostart=true, minChance=0.9, autoSellMaxValue=100 und bestehende Gold-/Verlustbudgets. Globale Upgrade-/Compound-Schalter bedeuten kein wahlloses Verarbeiten aller Items. Explizite Itemregeln können Aktionen und Ziellevel festlegen, unterliegen aber weiter Schutz, Reserven und der globalen Mindestchance. Keine riskanteren Chancen oder höheren Verkaufslimits ohne Benutzerauftrag setzen.

Das Update bestätigt keine alte Empfangssperre automatisch. Für genau diesen Lauf belegen die Logs unveränderte Bestände und fehlenden Versand. Nach Abgleich der aktuellen Bestände im pausierten Merchant-Kontext ALBot.acknowledgeInventory(); ALBot.start(); verwenden. Bei abweichenden Beständen zuerst neue Logs prüfen. Dies ist eine manuelle Bestandsbestätigung, keine erneute Überweisung und kein Löschen anderer Journale.

168 Prüfungen bestanden unter Windows, einschließlich Gold-/Item-Überschneidung, Abbruch ohne Dispatch, falscher Sitzung, bereits beobachtetem Gold, kritischem Arbeitsraum und Upgrade-Scrollvorrat. Bundle und Werkstatt gebaut; keine Spielaktionen, Logins oder Shadow-Tests. Neue gemeinsame Livebestätigung und Linux-Livebetrieb stehen aus. Merchant-Tickdauer im vorliegenden Lauf: Mittel 4,96 ms, Maximum 122 ms; diese Messung beweist keine ruckelfreie Darstellung.
