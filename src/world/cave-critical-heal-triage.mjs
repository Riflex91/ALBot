// W12/N12: read-only multi-aggro triage for the Priest's EXISTING
// single-target native heal. Never gives additional healing, movement,
// target, AoE or attack authority. Unknown observations preserve the
// legacy life-saving healing path rather than widening its capabilities.
const caveTriageFinite=n=>Number.isFinite(n);
const caveTriageClock=n=>Number.isSafeInteger(n)&&n>0;
const caveTriageDeny=(reason,scope={})=>({
 version:1,mode:'cave-critical-heal-triage',ready:false,
 canHeal:false,canMove:false,canAttack:false,canPull:false,canAoE:false,
 reason,attackerCount:0,preferred:null,signature:null,...scope
});
export function caveCriticalHealTriage(bot,{team,now=Date.now()}={}){
 const c=bot?.p?.c,names=team?.members;
 if(!bot?.running||bot.me?.role!=='farmer'||c?.ctype!=='priest'||
    !caveTriageClock(now)||team?.ready!==true||
    !Array.isArray(names)||names.length!==3||
    new Set(names).size!==3||names.filter(n=>n===c.name).length!==1||
    team.priest!==c.name||
    typeof team.run!=='string'||!/^[a-f0-9]{24}$/.test(team.run)||
    !Number.isSafeInteger(team.floor)||team.floor<0||team.floor>7||
    team.map!==`zone_${team.run}_${team.floor}`||
    c.map!==team.map||(c.in!==undefined&&c.in!==team.map)||
    c.cave?.run!==team.run)
  return caveTriageDeny('fresh-own-healing-trio-required');
 const scope={run:team.run,floor:team.floor,map:team.map};
 const all=bot.monsters?.();
 if(!Array.isArray(all)||all.length>512)
  return caveTriageDeny('complete-local-monster-view-required',scope);
 const targeted=all.filter(m=>m&&names.includes(m.target)&&
  m.dead!==true&&!(caveTriageFinite(m.hp)&&m.hp<=0));
 if(targeted.length<2)
  return caveTriageDeny('not-multiple-engaged-enemies',{
   ...scope,attackerCount:targeted.length});
 if(targeted.length>3)
  return caveTriageDeny('unbounded-engaged-enemies',{
   ...scope,attackerCount:targeted.length});
 const members=[],counts=Object.fromEntries(names.map(n=>[n,0]));
 for(const n of names){
  const m=n===c.name?c:bot.transport?.fresh?.(n);
  if(!m||m.name!==n||m.rip===true||
     m.map!==team.map||(m.in!==undefined&&m.in!==team.map)||
     !caveTriageFinite(m.hp)||!caveTriageFinite(m.max_hp)||
     m.hp<=0||m.max_hp<=0||m.hp>m.max_hp||
     !caveTriageFinite(m.x)||!caveTriageFinite(m.y)||
     (n!==c.name&&(
      m.running!==true||m.realm!==bot.p.realm?.()||
      !caveTriageClock(m.received)||m.received>now||
      now-m.received>3000)))
   return caveTriageDeny('current-team-health-unconfirmed',{...scope,member:n});
  members.push(m);
 }
 const ids=new Set(),raw=Object.fromEntries(names.map(n=>[n,{dps:0,peak:0}]));
 const monsterSignatures=[];
 for(const m of targeted){
  const meta=bot.p?.G?.monsters?.[m.mtype];
  if(m.type!==undefined&&m.type!=='monster'||
     typeof m.id!=='string'||m.id.length<1||m.id.length>100||
     ids.has(m.id)||typeof m.mtype!=='string'||!m.mtype||
     m.map!==team.map||(m.in!==undefined&&m.in!==team.map)||
     !caveTriageFinite(m.hp)||m.hp<=0||
     !caveTriageFinite(m.x)||!caveTriageFinite(m.y)||
     !meta||!caveTriageFinite(meta.attack)||meta.attack<=0||
     meta.attack>100000||!caveTriageFinite(meta.frequency)||
     meta.frequency<=0||meta.frequency>100)
   return caveTriageDeny('engaged-damage-evidence-unconfirmed',{
    ...scope,attackerCount:targeted.length});
  const dps=meta.attack*meta.frequency*1.5,peak=meta.attack*1.5;
  if(!caveTriageFinite(dps)||!caveTriageFinite(peak))
   return caveTriageDeny('incoming-damage-overflow',scope);
  ids.add(m.id);counts[m.target]++;
  raw[m.target].dps+=dps;raw[m.target].peak+=peak;
  monsterSignatures.push([m.id,m.target,m.mtype,m.hp,m.x,m.y,
   meta.attack,meta.frequency].join(':'));
 }
 for(const m of members){
  if(m.name!==c.name&&(!Number.isSafeInteger(m.threats)||
       m.threats!==counts[m.name])||
     m.name===c.name&&Number.isSafeInteger(m.targets)&&
       m.targets<counts[m.name])
   return caveTriageDeny('peer-aggro-count-mismatch',{
    ...scope,attackerCount:targeted.length,member:m.name});
 }
 const ranked=[];
 for(const m of members){
  const damage=raw[m.name];
  const floor=Math.max(.25*m.max_hp,damage.peak*1.5);
  const projected=m.hp-damage.dps*4;
  const seconds=damage.dps>0?(m.hp-floor)/damage.dps:null;
  if(![damage.dps,damage.peak,floor,projected].every(caveTriageFinite)||
     seconds!==null&&!caveTriageFinite(seconds))
   return caveTriageDeny('member-damage-overflow',{
    ...scope,attackerCount:targeted.length,member:m.name});
  ranked.push({name:m.name,hp:m.hp,maxHp:m.max_hp,
   currentFraction:m.hp/m.max_hp,incomingDps:damage.dps,
   projectedHp4s:projected,protectedHp:floor,
   timeToProtectionSeconds:seconds});
 }
 // Self preservation at critical HP always wins. Otherwise rank members
 // by time to the conservative protected floor and then by current HP.
 ranked.sort((a,b)=>
  Number(b.name===c.name&&b.currentFraction<=.35)-
   Number(a.name===c.name&&a.currentFraction<=.35)||
  (a.timeToProtectionSeconds??Infinity)-
   (b.timeToProtectionSeconds??Infinity)||
  a.currentFraction-b.currentFraction||
  a.name.localeCompare(b.name));
 const signature=[
  ...monsterSignatures.sort(),
  ...members.map(m=>[m.name,m.hp,m.max_hp,m.x,m.y,
   m.name===c.name?(Number.isSafeInteger(m.targets)?m.targets:'-'):m.threats].join(':')).sort()
 ].join('|');
 return {...caveTriageDeny('multi-aggro-priority-observed',{
  ...scope,attackerCount:targeted.length}),
  ready:true,ranked,preferred:ranked[0]?.name??null,signature};
}
export function createCaveCriticalHealTriage(bot,{now=()=>Date.now()}={}){
 function status(){
  const team=bot.caveTeam?.healStatus?.();
  return caveCriticalHealTriage(bot,{team,now:now()});
 }
 return {status};
}
