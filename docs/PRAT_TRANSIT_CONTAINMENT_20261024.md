# 2026-10-24 prat-corridor loss containment

## Incident and scope
Live EU II logs at 17:32–17:33 UTC demonstrate three deaths of My_Priest,
My_Ranger1 and My_Ranger2 on `level1`. Ranger2 had selected a `cgoo`
farm objective on `level2s`, changed to `bee` while already inside
`level1`, and farm/follow/kite/regroup owners repeatedly exchanged control.
At least two deaths occurred in the official `prat` spawn rectangle
[-308,629,0,762]. Source: eight incident log exports and
`docs/INCIDENT-2026-10-24-PRAT-TRANSIT-SAFETY-REVIEW.md` on draft PR #485.

Official game engine references:
- https://github.com/kaansoral/adventureland_mongodb/blob/main/js/runner_functions.js
  - `smart_move` explicitly does NOT certify monster-safe paths; collision
    BFS and asynchronous path calculation alone do not ensure safe transit.
- https://github.com/kaansoral/adventureland_mongodb/blob/main/design/monsters.js
  - `prat` is naturally aggressive, attack 320, frequency 1.6, speed 12,
    charge 86, lifesteal 120.
- https://github.com/kaansoral/adventureland_mongodb/blob/main/design/maps.js
  - `level1` has two `prat` packs, five each.

## Safeguard
When the actual game data proves that `level1` hosts naturally aggressive
`prat`, autonomous farmer movement is restricted to a single
`can_move_to`-certified, direct, same-map segment whose full geometry stays
outside every recognized aggressive spawn (70 extra units) and outside
recognized live hostile-monster attack regions. A farmer already exposed
can attempt only a bounded 70-unit strictly safer direct retreat segment.
No `smart_move`, map-hop inference, distant NPC chase, or cross-map
follow/farm/quest/retreat is automatically certified.

The central movement dispatcher, dispatch precondition, and movement poll
all enforce this policy for ordinary farmer owners; previously running
unowned native movement is interrupted. Separately safety-bounded Cave and
N05 scout movement retain their dedicated admission logic. Team-plan
selection and validation use the same conservative physical proof; a
death on a hostile/uncertified map stops unattended farmer respawn even
without a remaining farm plan or movement owner.

## Operational limits (RELEASE-BLOCKING)
- This is **containment**, not a general safe pathfinder. It sacrifices
  distant farming, town/portal shortcuts, cross-map quests, and many normal
  long-range routes for farmers whenever this incident signature is loaded.
  Merchant control is unchanged.
- Direct `can_move_to` only proves collision-free geometry. Hostile
  spawns and live monster positions are based on available game definitions
  and observation. Unobserved roamers, delayed spawns, ranged attacks,
  server timing and lag can still injure/kill. No claim of zero deaths.
- A character stranded in `level1` may need operator-supervised rescue
  or relocation; do **not** start unattended farming there.
- The hard-stop is activated by affirmative official `prat` evidence.
  It is **not** a complete solution to other newly introduced dangerous maps.
- Do not sign the runtime or mark this as verified in-game based only on
  offline tests. The signed release channel remains unchanged.

## Verification and release criteria
1. Review `test/20261024-physical-farmer-transit.test.mjs` plus the entire
   existing regression suite, not just the 2026-10-24 tests.
2. Verify the exact source/head SHA and generated `bot.js`, dist and
   personalized CODE are consistent. Linux and Windows PR checks both green.
3. Run controlled low-risk **live** assessment of merchant supply, three
   farmer follower cohesion, no cross-map prat dispatch, preserved healing,
   verified escape and death-stop. Inspect complete test and teamcheck logs.
4. Rework the approved physical portal corridor route executor in a
   separate change if normal cross-map farming is to be restored.
5. Only then consider merge and separately protected cryptographic signing.

Current PR: https://github.com/Riflex91/ALBot/pull/487 (draft; unsigned).
Older graph-only alternative: https://github.com/Riflex91/ALBot/pull/485
(draft, not approved for merge).
