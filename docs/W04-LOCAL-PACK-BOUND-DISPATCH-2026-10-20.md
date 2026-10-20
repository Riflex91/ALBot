# W04 – Lokale Bankpack-Grenze bis zum verzögerten Reservestaging-Dispatch

Stand: 20. Oktober 2026.

## Befund

Das bereits vorhandene W04-Reservestaging nutzt die gesonderten
persistierten `single`-/`partial`-Entnahmejournale für die
beobachtete Banktransaktion. Der endliche `scanBankDispositionWindow`
weist Bankpacks mit mehr als 42 Slots zurück. Zwischen fertigem Scan
und dem verzögerten Server-Dispatch kann sich jedoch ein anderes
lokales Pack verändern. `observedLocalReserveStock` hatte zwar
sichere Stack-Mengen und Varianten geprüft, nicht aber die Länge
jedes **weiteren aktuell sichtbaren lokalen Bankpacks**.

Ein danach unplausibles 43-Slot-Pack durfte so als physischer
Überschussbeleg für ein weiterhin unverändertes adressiertes
Quellpack herangezogen werden. Das ist keine valide Freigabe.

## Korrektur

- Die für Bank-Reservestaging maßgebliche lokale Mengenprüfung
  verweigert die gesamte Deckung, sobald irgendein **lokales**
  sichtbares Pack mehr als 42 Slots aufweist.
- Dieselbe Prüfung erfolgt bei der initialen Planung, vor einer
  vollständigen Einzelentnahme **und** vor der ersten partiellen
  Entnahme bei unverändertem ursprünglichem Quellslot.
- Normale lokale 42-Slot-Packs und leere Packs bleiben zulässig.
  Fremdmap-/Offsite-Bankpacks werden weiterhin nicht als
  lokale Deckung gezählt und deshalb auch nicht als lokale
  Packgrenzen bewertet.
- Unverändert: Schutzboden und Zweckreservierungen, der vorhandene
  persistente Dispatchnachweis, Split-/Return-Recovery, Journalkonflikte,
  keine spekulative Wiederholung, keine neue Verkaufsberechtigung.

## Nachweis

Regressionen in `test/roadmap-w04-bank-disposition.test.mjs`
prüfen die Änderung eines fremden lokalen Packs nach fertiger
Planung (Full und Partial), unveränderte adressierte Quellstapel,
Rückkehr zu gültigen 42-Slot-Daten sowie Abgrenzung einer
explizit anders gemappten Offsite-Bank.

Es handelt sich um eine konservative Eingriffssperre, nicht um
eine neue autonome Folge oder die vollständige W02/W04-Abnahme.
Keine signierte Ingame-Veröffentlichung und keine Live-Bankquittung.
