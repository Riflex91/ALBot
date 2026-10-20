import {runtimeConditionGate,currentConditionEvidence} from '../core/action-admission.mjs';
import {distance,samePlace} from '../core/policy.mjs';
import {outgoingDamageEstimate} from './damage-model.mjs';
import {assessQuestDetachment} from './quest-detachment.mjs';

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
// A follower may assist ONE already selected leader farm target, even before
// the monster starts attacking back. This is not an independent neutral pull:
// identity, approved species, shared plan, realm, freshness and distance must
// all agree. Missing or stale evidence fails closed.
export function leaderAssignedFarmTarget(character,leader,monsters,{
 plan,realm,teamNames=[],maxDistance=280,now=Date.now()
}={}){
 const leaderPlan=leader?.farmPlan?.id??leader?.march?.plan;
 if(!leader?.running||leader.rip||!leader.target||!plan?.id||
    plan.id!==leaderPlan||plan.realm!==realm||
    leader.realm!==realm||!plan.target||
    (Number.isFinite(plan.expires)&&plan.expires<=now)||
    !Number.isFinite(leader.received)||leader.received>now||
    now-leader.received>4000||
    !samePlace(character,leader)||
    ![character?.x,character?.y,leader.x,leader.y].every(Number.isFinite))
   return null;
 return (monsters??[]).find(m=>m?.id!=null&&
   String(m.id)===String(leader.target)&&
   m.mtype===plan.target&&m.hp>0&&!m.dead&&
   (!m.target||teamNames.includes(m.target))&&
   samePlace(character,m)&&samePlace(leader,m)&&
   Number.isFinite(m.x)&&Number.isFinite(m.y)&&
   distance(character,m)<=maxDistance&&
   distance(leader,m)<=maxDistance)??null;
}
// The ordinary leader-only neutral-pull gate is relaxed for a verified
// one-hit attack at the CURRENT shared farm spawn. For aimed-AoE casts,
// every selected monster must independently pass this proof.
// Unknown avoidance, damage, mechanic, or peer state fails closed.
function verifiedFollowerSpawnTarget(actor,monster,{plan,leader,peers,
 realm,game,now=Date.now(),maxDistance=140}={}){
 const meta=game?.monsters?.[monster?.mtype];
 const ownedPlan=leader?.farmPlan?.id??leader?.march?.plan;
 if(!actor||!monster||monster.type!=='monster'||monster.dead||monster.rip||
    monster.target||monster.invincible||!Number.isFinite(monster.hp)||
    monster.hp<=0||!meta||meta.boss||meta.cooperative||meta.stationary||
    meta.respawn_as||meta.spawns||meta.explosion||meta.aura||
    Object.keys(meta.abilities??{}).length>0||
    !plan?.id||!plan.target||plan.target!==monster.mtype||
    !Number.isFinite(plan.expires)||plan.expires<=now||
    plan.realm!==realm||ownedPlan!==plan.id||
    !leader?.running||leader.rip||leader.realm!==realm||
    !Number.isFinite(leader.received)||leader.received>now||
    now-leader.received>4000||!Array.isArray(peers)||!peers.length||
    !samePlace(actor,plan)||!samePlace(monster,plan)||
    !samePlace(leader,plan)||!Number.isFinite(actor.x)||
    !Number.isFinite(actor.y)||!Number.isFinite(monster.x)||
    !Number.isFinite(monster.y)||distance(actor,plan)>85||
    distance(leader,plan)>maxDistance||
    distance(actor,monster)>maxDistance||
    !Number.isFinite(actor.hp)||!(actor.max_hp>0)||
    actor.hp/actor.max_hp<.85||
    !Number.isFinite(actor.mp)||!(actor.max_mp>0)||
    actor.mp/actor.max_mp<.15)return null;
 if(!peers.every(peer=>peer?.running&&!peer.rip&&
    peer.realm===realm&&samePlace(peer,plan)&&
    Number.isFinite(peer.received)&&peer.received<=now&&
    now-peer.received<=4000&&Number.isFinite(peer.x)&&
    Number.isFinite(peer.y)&&distance(peer,plan)<=maxDistance&&
    Number.isFinite(peer.hp)&&peer.max_hp>0&&
    peer.hp/peer.max_hp>=.85&&Number.isFinite(peer.mp)&&
    peer.max_mp>0&&peer.mp/peer.max_mp>=.15&&
    !peer.inventoryBlocked&&!peer.journal&&!peer.reserved))
   return null;
 const target={...meta,...monster,
  armor:monster.armor??meta.armor,
  resistance:monster.resistance??meta.resistance,
  avoidance:monster.avoidance??meta.avoidance,
  evasion:monster.evasion??meta.evasion,
  reflection:monster.reflection??meta.reflection};
 // Reject unknown or nonzero dodge/evasion/reflection for both policies;
 // neither a certain hit nor a bounded short fight may be invented.
 if(![target.avoidance??0,target.evasion??0,target.reflection??0]
    .every(x=>Number.isFinite(x)&&x===0)||
    target.s?.fullguard||target.s?.fullguardx||
    !Number.isFinite(target.armor??0)||
    !Number.isFinite(target.resistance??0))return null;
 return target;
}
// An exact one-hit bound remains the fastest and strictest follower case.
export function verifiedFollowerOneShot(actor,monster,options={}){
 const target=verifiedFollowerSpawnTarget(actor,monster,options);
 if(!target)return null;
 const estimate=outgoingDamageEstimate(actor,target,{
   skill,uncertainty:.25,fearFactor:.9});
 // The estimate already includes a 25% damage haircut; the additional
 // 20% margin tolerates modest unmodelled damage variation.
 return estimate.valid&&estimate.damage>=monster.hp*1.2?
  {damage:estimate.damage,hp:monster.hp,margin:estimate.damage/monster.hp}:null;
}
// A weak spawn need not be a guaranteed one-shot to be safe for a nearby
// healthy Farmer. Require conservatively bounded hits, cast time and
// *individual* HP exposure, in addition to all shared one-shot team gates.
// Aggregate simultaneous team threat admission is checked in encounter.
export function verifiedFollowerBoundedSpawn(actor,monster,options={}){
 const target=verifiedFollowerSpawnTarget(actor,monster,options);
 if(!target||!Number.isFinite(actor?.frequency)||actor.frequency<=0)
  return null;
 const meta=options.game?.monsters?.[monster.mtype];
 if(!Number.isFinite(meta?.attack)||meta.attack<0||
    !Number.isFinite(meta?.frequency)||meta.frequency<=0)return null;
 const estimate=outgoingDamageEstimate(actor,target,{
   uncertainty:.25,fearFactor:.9});
 if(!estimate.valid||!(estimate.damage>0))return null;
 const hits=Math.ceil(monster.hp/estimate.damage);
 const seconds=hits/actor.frequency+0.5;
 if(!Number.isSafeInteger(hits)||hits<1||hits>4||
    !Number.isFinite(seconds)||seconds>6)return null;
 // Worst-case every monster hit lands, with explicit burst uncertainty;
 // no damage avoidance, uncast buffs, healing or crit credit is taken.
 const exposure=(seconds+1)*meta.attack*meta.frequency*1.6;
 if(!Number.isFinite(exposure)||!(actor.hp-exposure>=actor.max_hp*.65))
  return null;
 return {hits,seconds,damage:estimate.damage,exposure,
   hp:monster.hp,marginHp:actor.hp-exposure-actor.max_hp*.65};
}

// Unlike a broad multi-pull allowance this authorizes only explicit aimed
// 3shot/5shot monster IDs, all of which independently meet the same
// one-hit proof. An ordinary area spell with bystanders is NOT eligible.
export function verifiedFollowerAoeOneShot(actor,targets,{
 skillId,skill,...options
}={}){
 const max=skillId==='3shot'?3:skillId==='5shot'?5:0;
 const min=skillId==='3shot'?3:skillId==='5shot'?4:Infinity;
 if(!Array.isArray(targets)||targets.length<min||targets.length>max||
    !skill||!Number.isFinite(skill.damage_multiplier)||
    skill.damage_multiplier<=0||skill.hostile!==true)return null;
 const ids=targets.map(m=>String(m?.id??''));
 if(ids.some(id=>!id)||new Set(ids).size!==ids.length)return null;
 const proofs=targets.map(m=>verifiedFollowerOneShot(actor,m,{
    ...options,skill}));
 if(proofs.some(p=>!p))return null;
 return {targets:targets.length,ids,damage:proofs.reduce((n,p)=>n+p.damage,0),
   minimumMargin:Math.min(...proofs.map(p=>p.margin))};
}
export function neutralPullReadiness(bot){
 const {cfg,p,me}=bot;
 if(bot.account?.rotationPending?.())return {ready:false,reason:'account-rotation-draining'};
 if(!runtimeConditionGate(p.c,p.G,'attack',['attack']).allowed)return {ready:false,reason:'actor-condition-blocked'};
 if(cfg.party?.enabled===false||cfg.party?.waitForTeam!==true)
  return {ready:true,reason:'no-team-hold'};
 const detachment=assessQuestDetachment(bot);
 const puller=detachment?.puller??bot.leader;
 if(me.name!==puller)return {ready:false,reason:'follower-cannot-pull'};
 const names=detachment?.active??bot.farmers??[];
 if(!names.length)return {ready:false,reason:'missing-roster'};
 const maxDistance=neutralPullDistance(cfg);
 for(const name of names){
  if(name===me.name)continue;
  const peer=bot.transport?.fresh?.(name);
  if(!peer?.running||peer.rip||peer.realm!==p.realm()||
    peer.inventoryBlocked||peer.journal||peer.reserved)
   return {ready:false,peer:name,reason:'peer-not-ready'};
  if(!runtimeConditionGate(currentConditionEvidence(bot,peer),p.G,'attack',['attack']).allowed)return {ready:false,peer:name,reason:'peer-condition-blocked'};
  if(!samePlace(p.c,peer)||!Number.isFinite(peer.x)||
    !Number.isFinite(peer.y)||distance(p.c,peer)>maxDistance)
   return {ready:false,peer:name,reason:'peer-not-assembled'};
  if(!Number.isFinite(peer.hp)||!Number.isFinite(peer.max_hp)||
    peer.max_hp<=0||peer.hp/peer.max_hp<(detachment?Math.max(.9,cfg.farming.pullHp??.8):(cfg.farming.pullHp??.8))||
    !Number.isFinite(peer.mp)||!Number.isFinite(peer.max_mp)||
    peer.max_mp<=0||peer.mp/peer.max_mp<(detachment?.3:.15))
   return {ready:false,peer:name,reason:'peer-recovering'};
 }
 if(detachment&&(p.c.hp/Math.max(1,p.c.max_hp)<Math.max(.9,cfg.farming.pullHp??.8)||
    p.c.mp/Math.max(1,p.c.max_mp)<.3||bot.recovering||
    bot.monsters().some(m=>m?.hp>0&&!m.dead&&m.target&&bot.teamNames.includes(m.target))))
  return {ready:false,reason:'detached-team-not-ready'};
 return {ready:true,reason:detachment?'two-farmer-conservative': 'assembled',
  detachment};
}
