# 0.13.0-candidate – Priest Monsterhunt travel ownership (19.10.2026)

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
