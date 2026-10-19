# 0.14.0-candidate – Priest Monsterhunt travel ownership (19.10.2026)

## Live-log evidence

During approximately five minutes of the 0.11.0-candidate Priest trace, five confirmed Town teleports and two Monsterhunt NPC visits were recorded, but no successful Monsterhunt interaction. The Priest repeatedly switched to follower travel before completing the visit. Both Rangers were left without regular new attacks while the squad was separated.

## Fix

- A personal Monsterhunt journey owns ordinary movement until Daisy's authoritative quest-state change or explicit timeout/interruption.
- Farmer's early leader-march branches now ignore the shared march while strategy.busy is true. This prevents the previous early return from bypassing the later busy guard.
- The core movement admission fence rejects normal follow/farm/world/cohesion/quest-escort/economy/logistics travel while a Farmer quest is busy, but preserves quest travel and emergency combat/kite movement.
- Existing authoritative Monsterhunt status observation, NPC interaction, deadlines, safety gates, combat readiness, personal settings, and 30-minute rotation policy stay unchanged.
- Regression fixture covers Town and remaining foot travel, and resumption of follow only after quest state clears.

## Verification

CI and signed-channel publication must establish generated runtime parity, green offline tests, ECDSA P-256 signature, SHA-256 digest, actual runtime byte count, and +0.1 minor version advancement. No in-game live acceptance is claimed by these offline checks.

## Signierter Release-Nachweis

- PR #246 ist mit grüner Linux-/Windows-CI nach main gemergt (Commit `39a261611eb55cc7b79ec4ef2123b41bc36942c3`).
- Veröffentlicht als Sequence 14 / `0.14.0-candidate` im bestehenden ECDSA-P-256-Releasekanal, Workflow 39324359244.
- Release `sha256=3ed5c6a0277c14aefe0847b940f256fc2230566fa4ba53063bb4da499502f91a`, `bytes=765913`; Runtime-Blob auf main und Release-Branch ist byteidentisch.
- Die bestehende Loader-Konfiguration und die persönliche ALBotConfig wurden nicht geändert. Neues Manifest wird beim nächsten CODE-Neustart bezogen. Der erfolgreiche NPC-Besuch muss im Spiel separat bestätigt werden.
