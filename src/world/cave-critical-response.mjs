// W12/N12: read-only Cave response gate. A wound or a disputed
// multi-aggro damage budget never becomes a new offensive permission.
// This module does not route, attack, heal, revive, or move characters.
const caveResponseFinite=n=>Number.isFinite(n);
const caveResponseTime=n=>Number.isSafeInteger(n)&&n>0;
const caveResponseRun=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s);
const caveResponseBlocked=(reason,extra={})=>({
 version:1,mode:'cave-critical-response',ready:false,
 state:'unverified',critical:false,holdOffense:true,
 canAttack:false,canHeal:false,canMove:false,canPull:false,canAoE:false,
 attackerCount:0,signature:null,members:[],reason,...extra
});
export function caveCriticalResponsePreflight(bot,{now=Date.now()}={}){
 const c=bot?.p?.c;
 if(!bot?.running||bot.me?.role!=='farmer'||
    !['ranger','priest'].includes(c?.ctype)||
    c.rip===true||bot.cfg?.party?.enabled!==true||
    bot.cfg?.party?.waitForTeam!==true||!caveResponseTime(now))
  return caveResponseBlocked('active-cave-farmer-required');
 // healStatus deliberately permits injured members. Normal combat
 // readiness rejects HP <70% and cannot describe a critical situation.
 const team=bot.caveTeam?.healStatus?.();
 const names=team?.members;
 if(team?.ready!==true||!caveResponseRun(team?.run)||
    !Number.isSafeInteger(team.floor)||team.floor<0||team.floor>7||
    team.map!==`zone_${team.run}_${team.floor}`||
    !Array.isArray(names)||names.length!==3||
    new Set(names).size!==3||!names.includes(c.name)||
    !Array.isArray(bot.farmers)||bot.farmers.length!==3||
    new Set(bot.farmers).size!==3||
    names.some(n=>!bot.farmers.includes(n))||
    team.priest===undefined||!names.includes(team.priest)||
    c.map!==team.map||(c.in!==undefined&&c.in!==team.map)||
    c.cave?.run!==team.run)
  return caveResponseBlocked('verified-current-healing-trio-required',{
   teamReason:team?.reason??'unavailable'});
 const scope={run:team.run,floor:team.floor,map:team.map};
 const snapshot=bot.monsters?.();
 if(!Array.isArray(snapshot)||snapshot.length>512)
  return caveResponseBlocked('complete-monster-snapshot-required',scope);
 const monsters=snapshot.filter(m=>m&&names.includes(m.target)&&
  m.dead!==true&&!(caveResponseFinite(m.hp)&&m.hp<=0));
 if(monsters.length>3)
  return caveResponseBlocked('too-many-engaged-monsters',{
   ...scope,state:'emergency-unknown',critical:true,
   attackerCount:monsters.length});
 const counts=Object.fromEntries(names.map(n=>[n,0]));
 const ids=new Set(),snapshotParts=[],incoming=Object.fromEntries(
  names.map(n=>[n,{dps:0,peak:0}]));
 for(const m of monsters){
  if(m.type!==undefined&&m.type!=='monster'||
     typeof m.id!=='string'||m.id.length<1||m.id.length>100||
     ids.has(m.id)||typeof m.mtype!=='string'||!m.mtype||
     !caveResponseFinite(m.hp)||m.hp<=0||
     m.map!==team.map||(m.in!==undefined&&m.in!==team.map)||
     !caveResponseFinite(m.x)||!caveResponseFinite(m.y))
   return caveResponseBlocked('engaged-monster-unverified',{
    ...scope,attackerCount:monsters.length});
  ids.add(m.id);counts[m.target]++;
  if(monsters.length<2){
   snapshotParts.push([m.id,m.target,m.hp,m.x,m.y].join(':'));
   continue;
  }
  const meta=bot.p?.G?.monsters?.[m.mtype];
  if(!meta||!caveResponseFinite(meta.attack)||meta.attack<=0||
     meta.attack>100000||!caveResponseFinite(meta.frequency)||
     meta.frequency<=0||meta.frequency>100)
   return caveResponseBlocked('multi-aggro-damage-unknown',{
    ...scope,attackerCount:monsters.length});
  const dps=meta.attack*meta.frequency*1.5;
  const peak=meta.attack*1.5;
  if(!caveResponseFinite(dps)||!caveResponseFinite(peak))
   return caveResponseBlocked('multi-aggro-damage-overflow',{
    ...scope,attackerCount:monsters.length});
  incoming[m.target].dps+=dps;
  incoming[m.target].peak+=peak;
  snapshotParts.push([m.id,m.target,m.mtype,m.hp,m.x,m.y,
   meta.attack,meta.frequency].join(':'));
 }
 const members=[],memberParts=[];
 let emergencyMember=null;
 for(const name of names){
  const m=name===c.name?c:bot.transport?.fresh?.(name);
  if(!m||m.name!==name||m.rip===true||
     m.map!==team.map||(m.in!==undefined&&m.in!==team.map)||
     !caveResponseFinite(m.hp)||!caveResponseFinite(m.max_hp)||
     m.hp<=0||m.max_hp<=0||m.hp>m.max_hp||
     !caveResponseFinite(m.x)||!caveResponseFinite(m.y)||
     (name!==c.name&&(
      m.running!==true||m.realm!==bot.p.realm?.()||
      !caveResponseTime(m.received)||m.received>now||
      now-m.received>3000)))
   return caveResponseBlocked('fresh-roster-health-unverified',{
    ...scope,attackerCount:monsters.length,member:name});
  // For multi-aggro the independent transport threat counters MUST
  // match live engaged entities. Never infer a missing monster is safe.
  if(monsters.length>1&&(
    name!==c.name&&(!Number.isSafeInteger(m.threats)||
      m.threats!==counts[name])||
    name===c.name&&Number.isSafeInteger(m.targets)&&
      (m.targets<counts[name]||m.targets<0)))
   return caveResponseBlocked('observed-peer-aggro-disagrees',{
    ...scope,attackerCount:monsters.length,member:name});
  const hit=incoming[name];
  const protectedHp=Math.max(.35*m.max_hp,hit.peak*1.5);
  const projectedHp=m.hp-hit.dps*4;
  if(!caveResponseFinite(protectedHp)||!caveResponseFinite(projectedHp))
   return caveResponseBlocked('nonfinite-survival-estimate',{
    ...scope,attackerCount:monsters.length,member:name});
  const critical=monsters.length>1&&(
   m.hp/m.max_hp<.7||projectedHp<protectedHp);
  if(critical&&!emergencyMember)emergencyMember=name;
  members.push({name,ratio:+(m.hp/m.max_hp).toFixed(3),
   forecastDamage4s:+(hit.dps*4).toFixed(2),
   projectedHp4s:+projectedHp.toFixed(2),
   protectedHp:+protectedHp.toFixed(2),critical});
  memberParts.push([name,m.hp,m.max_hp,m.x,m.y,
   name===c.name?(Number.isSafeInteger(m.targets)?m.targets:'-'):m.threats,
   name===c.name?'-':m.received].join(':'));
 }
 const count=monsters.length,critical=count>1&&emergencyMember!==null;
 const state=critical?'critical-hold':count>1?
  'bounded-multi-aggro':count===1?'single-engagement':'no-engagement';
 return {...caveResponseBlocked(critical?
  'multi-aggro-survival-reserve-exhausted':'current-aggro-observed',scope),
  ready:true,state,critical,holdOffense:critical,
  attackerCount:count,member:emergencyMember,
  signature:[...snapshotParts.sort(),...memberParts.sort()].join('|'),
  members};
}
export function createCaveCriticalResponse(bot,{now=()=>Date.now()}={}){
 function status(){return caveCriticalResponsePreflight(bot,{now:now()});}
 return {status};
}
