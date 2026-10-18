import {distance,samePlace} from '../core/policy.mjs';

// Neutral pulls require live, healthy, colocated participants. Defensive
// combat against an existing attacker remains allowed independently.
// Keep the follower rendezvous trigger aligned with the stricter neutral-pull
// clearance. A 180-unit follow threshold with 140-unit pull clearance leaves
// a 140..180 dead zone in which neither character moves nor can pull.
export function neutralPullDistance(cfg){
 const value=cfg?.party?.followDistance;
 return Math.min(140,Math.max(1,Number.isFinite(value)?value:140));
}
export function followerReassemblyDistance(cfg){
 const value=cfg?.party?.followDistance;
 return cfg?.party?.waitForTeam===true?
  Math.max(1,neutralPullDistance(cfg)-20):
  Math.max(1,Number.isFinite(value)?value:140);
}
// Followers can have no eligible target while the leader is fighting at the
// edge of their own visibility. Rejoin the CURRENT leader before repeatedly
// reporting 'Suche Farmziel'. This grants NO permission to attack a neutral
// monster; movement stays within the verified party on the same instance.
export function followerCombatRendezvous(follower,leader,{
 followDistance=140,hasEligibleTarget=false,storageHeld=false,
 hasActiveMovement=false
}={}){
 if(!leader?.running||leader.rip||!leader.target||
    hasEligibleTarget||storageHeld||hasActiveMovement||
    !samePlace(follower,leader)||![follower?.x,follower?.y,leader.x,leader.y].every(Number.isFinite))
  return {move:false,reason:'not-rendezvous-eligible'};
 const d=distance(follower,leader);
 const radius=Math.min(30,Math.max(20,Math.floor(followDistance/5)));
 // Keep the actual assembly target tighter than the old 120..140 range,
 // otherwise the two followers can remain idle throughout a leader pull.
 // A 55–85 unit stale-focus deadzone made otherwise healthy followers
 // stand watching the Leader attack outside their own visible entity list.
 // Rally tightly, then let the ordinary verified target gates take over.
 const trigger=Math.min(60,Math.max(35,followDistance*.3));
 return {move:d>trigger,reason:d>trigger?'leader-in-combat-out-of-reach':'already-near-leader',
  radius,distance:d};
}
export function neutralPullReadiness(bot){
 const {cfg,p,me}=bot;
 if(cfg.party?.enabled===false||cfg.party?.waitForTeam!==true)
  return {ready:true,reason:'no-team-hold'};
 if(me.name!==bot.leader)return {ready:false,reason:'follower-cannot-pull'};
 const names=bot.farmers??[];
 if(!names.length)return {ready:false,reason:'missing-roster'};
 const maxDistance=neutralPullDistance(cfg);
 for(const name of names){
  if(name===me.name)continue;
  const peer=bot.transport?.fresh?.(name);
  if(!peer?.running||peer.rip||peer.realm!==p.realm()||
    peer.inventoryBlocked||peer.journal||peer.reserved)
   return {ready:false,peer:name,reason:'peer-not-ready'};
  if(!samePlace(p.c,peer)||!Number.isFinite(peer.x)||
    !Number.isFinite(peer.y)||distance(p.c,peer)>maxDistance)
   return {ready:false,peer:name,reason:'peer-not-assembled'};
  if(!Number.isFinite(peer.hp)||!Number.isFinite(peer.max_hp)||
    peer.max_hp<=0||peer.hp/peer.max_hp<(cfg.farming.pullHp??.8)||
    !Number.isFinite(peer.mp)||!Number.isFinite(peer.max_mp)||
    peer.max_mp<=0||peer.mp/peer.max_mp<.15)
   return {ready:false,peer:name,reason:'peer-recovering'};
 }
 return {ready:true,reason:'assembled'};
}
