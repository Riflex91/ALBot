// W12/N12: bounded cumulative Cave threat budget, read-only. A second
// attacker cannot inherit a single-enemy Ranger combat permission.
// Do NOT credit future kills, potions, dodge, taunts or unobserved healing.
const caveBudgetFinite=n=>Number.isFinite(n);
const caveBudgetClock=n=>Number.isSafeInteger(n)&&n>0;
const caveBudgetDeny=(reason,extra={})=>({
 version:1,mode:'cave-cumulative-threat',ready:false,canAttack:false,
 reason,attackerCount:0,...extra
});
export function caveCumulativeThreatBudget(bot,{
 team,now=Date.now()
}={}){
 const names=team?.members;
 const c=bot?.p?.c,realm=bot?.p?.realm?.();
 if(team?.ready!==true||!Array.isArray(names)||names.length!==3||
    new Set(names).size!==3||!names.includes(c?.name)||
    typeof team.run!=='string'||!/^[a-f0-9]{24}$/.test(team.run)||
    !Number.isSafeInteger(team.floor)||team.floor<0||team.floor>7||
    team.map!==`zone_${team.run}_${team.floor}`||
    !caveBudgetClock(now)||c?.map!==team.map||
    (c.in!==undefined&&c.in!==team.map)||c.cave?.run!==team.run)
  return caveBudgetDeny('current-cave-trio-required');
 const scope={run:team.run,floor:team.floor,map:team.map};
 // Read the complete local monster view, rather than only the focused
 // opponent. Targeted, malformed entities are not silently discarded.
 const monsters=bot.monsters?.();
 if(!Array.isArray(monsters)||monsters.length>512)
  return caveBudgetDeny('local-monster-list-unavailable',scope);
 const targeted=monsters.filter(m=>m&&names.includes(m.target)&&
  m.dead!==true&&!(caveBudgetFinite(m.hp)&&m.hp<=0));
 if(targeted.length<1||targeted.length>3)
  return caveBudgetDeny('unbounded-engaged-count',{
   ...scope,attackerCount:targeted.length});
 const ids=new Set(),targetCounts=Object.fromEntries(names.map(n=>[n,0]));
 for(const m of targeted){
  if(typeof m.id!=='string'||m.id.length<1||m.id.length>100||
     ids.has(m.id)||typeof m.mtype!=='string'||m.mtype.length<1||
     !caveBudgetFinite(m.hp)||m.hp<=0||
     m.map!==team.map||(m.in!==undefined&&m.in!==team.map)||
     !caveBudgetFinite(m.x)||!caveBudgetFinite(m.y))
   return caveBudgetDeny('engaged-monster-evidence-invalid',{
    ...scope,attackerCount:targeted.length});
  ids.add(m.id);
  targetCounts[m.target]++;
 }
 const signature=targeted.map(m=>m.id+':'+m.target).sort().join('|');
 // Even one enemy has an identity signature so a queued one-on-one
 // attack cannot silently become an attack in a new multi-aggro situation.
 if(targeted.length===1)return {
  version:1,mode:'cave-cumulative-threat',ready:true,canAttack:true,
  reason:'single-engaged-monster-existing-guards',
  attackerCount:1,signature,...scope};
 // Peer counters represent a separate source of observed aggro. If any
 // additional attacker is missing from the local snapshot, stop attacking.
 const roster=[];
 for(const name of names){
  const member=name===c.name?c:bot.transport?.fresh?.(name);
  if(!member||member.name!==name||member.rip===true||
     member.map!==team.map||(member.in!==undefined&&member.in!==team.map)||
     !caveBudgetFinite(member.hp)||!caveBudgetFinite(member.max_hp)||
     member.max_hp<=0||member.hp<=0||member.hp>member.max_hp||
     member.hp/member.max_hp<.7||
     (name!==c.name&&(
      member.running!==true||member.realm!==realm||
      !caveBudgetClock(member.received)||member.received>now||
      now-member.received>3000)))
   return caveBudgetDeny('multi-aggro-member-evidence-unavailable',{
    ...scope,attackerCount:targeted.length,member:name});
  if(name!==c.name&&(!Number.isSafeInteger(member.threats)||
     member.threats!==targetCounts[name]))
   return caveBudgetDeny('peer-aggro-count-mismatch',{
    ...scope,attackerCount:targeted.length,member:name});
  // The local targets field can count native server engagements. When
  // provided, a smaller number than actually seen is contradictory.
  if(name===c.name&&Number.isSafeInteger(member.targets)&&
     member.targets<targetCounts[name])
   return caveBudgetDeny('own-aggro-count-mismatch',{
    ...scope,attackerCount:targeted.length,member:name});
  roster.push(member);
 }
 const incoming=Object.fromEntries(names.map(n=>[n,{dps:0,peak:0}]));
 const monsterDefs=bot.p?.G?.monsters;
 for(const m of targeted){
  const meta=monsterDefs?.[m.mtype];
  // No class-specific mitigation or healing credit is assumed. These
  // raw numbers are intentionally HIGHER than expected mitigated damage.
  if(!meta||!caveBudgetFinite(meta.attack)||meta.attack<=0||
     meta.attack>100000||!caveBudgetFinite(meta.frequency)||
     meta.frequency<=0||meta.frequency>100||
     !caveBudgetFinite(meta.attack*meta.frequency*1.5))
   return caveBudgetDeny('multi-aggro-damage-definition-missing',{
    ...scope,attackerCount:targeted.length,monster:m.mtype});
  incoming[m.target].dps+=meta.attack*meta.frequency*1.5;
  incoming[m.target].peak+=meta.attack*1.5;
 }
 const members=[];
 for(const m of roster){
  const damage=incoming[m.name],windowDamage=damage.dps*4,
   postWindow=m.hp-windowDamage,
   protectedHp=Math.max(.35*m.max_hp,damage.peak*1.5);
  if(![damage.dps,damage.peak,windowDamage,postWindow,protectedHp]
     .every(caveBudgetFinite))
   return caveBudgetDeny('multi-aggro-damage-overflow',{
    ...scope,attackerCount:targeted.length,member:m.name});
  members.push({name:m.name,incomingDps:+damage.dps.toFixed(2),
   forecastDamage4s:+windowDamage.toFixed(2),
   postWindowHp:+postWindow.toFixed(2),
   protectedHp:+protectedHp.toFixed(2)});
  if(postWindow<protectedHp)
   return caveBudgetDeny('multi-aggro-survival-budget-exhausted',{
    ...scope,attackerCount:targeted.length,
    member:m.name,signature,members});
 }
 return {version:1,mode:'cave-cumulative-threat',
  ready:true,canAttack:true,reason:'bounded-multi-aggro-without-heal-credit',
  attackerCount:targeted.length,signature,...scope,members};
}
