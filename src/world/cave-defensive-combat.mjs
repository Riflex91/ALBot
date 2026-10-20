import {caveCumulativeThreatBudget} from './cave-cumulative-threat.mjs';
// W12/N12: a Cave Ranger may defend an ALREADY engaged teammate with
// one basic attack only. All instance, roster, Priest, threat and range
// evidence is revalidated immediately before the game API call.
// No neutral pull, skill/AoE, movement, target-change or retry queue.
// A complete cumulative threat budget is required for multi-aggro.
const caveDefenseDeny=(reason,extra={})=>({
 version:1,mode:'guarded-cave-defense-basic',
 ready:false,canAttack:false,canPull:false,canMove:false,canUseSkills:false,
 reason,...extra
});
const caveDefenseFinite=n=>Number.isFinite(n);
export function caveDefensiveAttackPreflight(bot,{
 now=Date.now(),hostChecks=true
}={}){
 const c=bot?.p?.c,p=bot?.p;
 if(!bot?.running||bot?.me?.role!=='farmer'||
    c?.ctype!=='ranger'||c.rip===true||
    bot.cfg?.party?.enabled!==true||
    bot.cfg?.party?.waitForTeam!==true)
  return caveDefenseDeny('eligible-live-ranger-required');
 if(bot.journal||bot.inventoryBlocked||bot.lifecycleChanging||
    bot.account?.rotationPending?.()||
    bot.bank?.pending||bot.logistics?.reserved||
    bot.gold?.reserved||bot.teamTravel?.blocked)
  return caveDefenseDeny('another-action-or-value-journal');
 const team=bot.caveTeam?.status?.();
 if(team?.ready!==true||!team.focus?.alreadyEngaged||
    !team.focus.id||!team.run||
    !Number.isSafeInteger(team.floor)||team.floor<0||
    team.map!==`zone_${team.run}_${team.floor}`)
  return caveDefenseDeny('verified-engaged-team-focus-required',{
   teamReason:team?.reason??'unavailable'});
 const scope={run:team.run,floor:team.floor,map:team.map,
  focusId:team.focus.id,victim:team.focus.victim};
 const budget=caveCumulativeThreatBudget(bot,{team,now});
 if(budget.ready!==true)
  return caveDefenseDeny('cave-cumulative-threat-unverified',{
   ...scope,riskReason:budget.reason,
   attackerCount:budget.attackerCount,
   riskMember:budget.member??null});
 if(!Number.isSafeInteger(now)||now<=0||c.map!==team.map||
    (c.in!==undefined&&c.in!==team.map)||
    c.cave?.run!==team.run)
  return caveDefenseDeny('own-current-floor-required',scope);
 // Resolve the actual currently visible entity at the action boundary.
 // A target id in another instanced floor is NOT the same enemy.
 const m=bot.entity?.(team.focus.id);
 if(!m||m.type!=='monster'||m.id!==team.focus.id||
    !caveDefenseFinite(m.hp)||m.hp<=0||m.dead===true||
    m.invincible===true||m.rip===true||
    m.map!==team.map||(m.in!==undefined&&m.in!==team.map)||
    m.target!==team.focus.victim||
    !team.members?.includes(m.target)||
    !caveDefenseFinite(m.x)||!caveDefenseFinite(m.y))
  return caveDefenseDeny('verified-live-engaged-monster-required',scope);
 if(!caveDefenseFinite(c.range)||c.range<12||c.range>1500||
    !caveDefenseFinite(c.x)||!caveDefenseFinite(c.y)||
    Math.hypot(c.x-m.x,c.y-m.y)>Math.max(5,c.range-12))
  return caveDefenseDeny('no-ranged-basic-attack-position',scope);
 // The established live threat capability model must positively approve
 // this exact enemy. An absent evaluator is UNKNOWN, not assumed safe.
 if(bot.combatAssessment?.canDefend?.(m)!==true||
    bot.threats?.permitted?.(m)===false||
    bot.bosses?.canAttack?.(m)===false)
  return caveDefenseDeny('threat-capability-not-approved',scope);
 if(hostChecks){
  try{
   if(p.call('can_attack',m)!==true||
      p.call('is_on_cooldown','attack')!==false)
    return caveDefenseDeny('basic-attack-not-ready',scope);
  }catch{
   return caveDefenseDeny('basic-attack-host-unavailable',scope);
  }
 }
 return {...caveDefenseDeny('engaged-defense-ready',scope),ready:true,
  canAttack:true,range:c.range,monster:m,
  attackerCount:budget.attackerCount,threatSignature:budget.signature};
}
export function createCaveDefensiveCombat(bot,{now=()=>Date.now()}={}){
 let attempts=0,last=null;
 function proof(hostChecks=true){
  return caveDefensiveAttackPreflight(bot,{now:now(),hostChecks});
 }
 function status(){
  const r=proof(false);
  // Never expose a mutable game entity through status or telemetry.
  const {monster,...safe}=r;
  return {...safe,attempts,last};
 }
 function tick(){
  const first=proof();
  if(!first.ready||typeof bot.exec?.run!=='function')return false;
  const {run,floor,focusId,victim,threatSignature}=first;
  const guard=()=>{
   const latest=proof();
   return latest.ready===true&&latest.run===run&&
    latest.floor===floor&&latest.focusId===focusId&&
    latest.victim===victim&&
    latest.threatSignature===threatSignature;
  };
  const invoke=()=>{
   // Re-resolve and reverify the SAME live entity at the literal
   // network boundary; do not fetch a different object after validation.
   const liveProof=proof();
   if(!liveProof.ready||liveProof.run!==run||
      liveProof.floor!==floor||liveProof.focusId!==focusId||
      liveProof.victim!==victim||
      liveProof.threatSignature!==threatSignature)
    throw Error('Cave defense proof changed before attack');
   return bot.p.call('attack',liveProof.monster);
  };
  const accepted=bot.exec.run('cave.defense.basic',['attack','mana'],
   guard,invoke,{delay:300,timeout:8000});
  if(accepted){
   attempts++;
   last={run,floor,focusId,victim,at:now()};
   bot.event?.('cave.defense.basicRequested',last);
  }
  return accepted;
 }
 return {status,tick};
}
