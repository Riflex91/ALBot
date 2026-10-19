# W06 / G09 – Keine Phantom-Farmaufträge für unbelegte Materialien

Datum: 19.10.2026. Entwicklungsbasis: `0.10.13-candidate`.

## Ist-Befund

Die bestehende Merchant-Produktionsplanung nutzt mehrere endliche
Beschaffungsarten: eigene Bestände, Bank, NPC, Crafting, Upgrade,
Compound, Exchange, freigegebenen Markt und Farmarbeit. Die
nachgelagerte `materialSources()`-Prüfung verlangt bereits
konkret erlaubte Monster mit positivem Drop, gültiger Eventphase
und Questberechtigung.

Die reine `planProduction()`-Entscheidung fügte bei
`allowed.includes('farm')` jedoch **bedingungslos** einen
`farm`-Schritt hinzu, sofern eine generelle `permit`-Regel
dies erlaubte. In nicht autonomen Profilen ohne zusätzlichen
Scoring-Gate entstand so ein unvollziehbarer Materialauftrag
für Items, die die freigegebenen Monster gar nicht droppen.
Dies bedeutete eine mögliche blockierende Phantomaufgabe,
nicht notwendigerweise einen wirklich ausgeführten Angriff.

## Umsetzung

- `declaredFarmDropSources()` prüft G-Monster-Droptabellen
  einschließlich der bereits unterstützten `open`-Untertabellen
  auf **positive**, zum genauen Zielitem passende Dropraten.
  Ohne Beleg gibt es keine `farm`-Planstufe.
- Konkrete vom Bot bereits genehmigte Monsterlisten werden
  aus `allowedMonsters()` an die Produktionsplanung übergeben.
  Ein Drop eines **anderen**, nicht erlaubten Monsters
  begründet keinen neuen Farmauftrag.
- Bei rein eventgebundenen Drops muss das Event anhand des
  bestehenden Livezustands aktiv sein; questgebundene Monster
  verlangen die bestehende Questberechtigung.
- Hat ein Item keinen belegten erlaubten Farmweg, wird der
  Plan explizit mit `Kein belegter erlaubter Monster-Drop`
  abgewiesen. Ein daneben gültiger, endlicher Market-Buy
  bleibt als selbständige Option verfügbar. Eine bereits
  explizit freigegebene NPC-, Bank- oder Craftroute bleibt
  unberührt.
- Levelhöhere mutierte Items gelten nicht als gewöhnliche
  Monster-Drops der Grundversion.
- Der eigentliche Farmer erhält **keine** neuen Monster-,
  Reise-, Loot-, Kauf- oder Tauschberechtigungen.
  Die nachgelagerten Quellen-/Quota-/Kampfguards bleiben
  zusätzlich bestehen.

## Nachweise und Grenzen

Neun Regressionen prüfen einen tatsächlich belegten Drop,
unbelegbare Materialien, Eventfristen, Questberechtigungen,
begrenzt erlaubte Monsterlisten, verschachtelte Droptabellen,
unreproduzierbare höherlevelige Ziele und beschädigte Metadaten.

G09-Stapel- und Mehrstufentausch, vollständige Markt-/Item-
Beschaffung für nicht reproduzierbare Materialien sowie
Live-Abnahme bleiben offen. Kein neuer signierter Release,
keine Änderung persönlicher Regeln.
