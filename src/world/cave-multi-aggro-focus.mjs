import {caveCumulativeThreatBudget} from './cave-cumulative-threat.mjs';
// W12/N12: read-only priority agreement for ALREADY engaged Cave enemies.
// It cannot grant a neutral pull, a new attack capability, movement or AoE.
const caveFocusFinite=n=>Number.isFinite(n);
const caveFocusBlocked=(reason,extra={})=>({
 version:1,mode:'cave-multi-aggro-focus',ready:false,
 canAttack:false,canPull:false,canMove:false,canAoE:false,
 reason,attackerCount:0,focus:null,...extra
});
export function caveMultiAggroFocusPlan(bot,{
 team,now=Date.now(),budget=null
}={}){
 const r=budget??caveCumulativeThreatBudget(bot,{team,now});
 const scope={run:team?.run??null,floor:team?.floor??null,
  map:team?.map??null,attackerCount:r?.attackerCount??0};
 if(team?.ready!==true||r?.ready!==true||
    r.attackerCount<2||r.attackerCount>3||
    r.run!==team.run||r.floor!==team.floor||r.map!==team.map||
    !Array.isArray(team.members)||team.members.length!==3||
    team.members.filter(n=>n===team.priest).length!==1||
    !Array.isArray(r.members)||r.members.length!==3)
  return caveFocusBlocked('complete-multi-aggro-budget-required',scope);
 const monsters=bot?.monsters?.();
 if(!Array.isArray(monsters)||monsters.length>512)
  return caveFocusBlocked('local-monster-snapshot-unavailable',scope);
 const names=new Set(team.members);
 const targeted=monsters.filter(m=>m&&names.has(m.target)&&
  m.dead!==true&&!(caveFocusFinite(m.hp)&&m.hp<=0));
 if(targeted.length!==r.attackerCount||
    targeted.map(m=>m.id+':'+m.target).sort().join('|')!==r.signature)
  return caveFocusBlocked('aggro-snapshot-drift',scope);
 const memberRisk=new Map(r.members.map(m=>[m.name,m]));
 const roster=new Map();
 for(const name of team.members){
  const m=name===bot?.p?.c?.name?bot.p.c:bot?.transport?.fresh?.(name);
  const risk=memberRisk.get(name);
  if(!m||m.name!==name||!risk||
     !caveFocusFinite(m.hp)||!caveFocusFinite(m.max_hp)||
     m.max_hp<=0||m.hp<=0||m.hp>m.max_hp||
     !caveFocusFinite(risk.postWindowHp)||
     !caveFocusFinite(risk.protectedHp)||risk.protectedHp<=0)
   return caveFocusBlocked('member-risk-observation-missing',scope);
  roster.set(name,m);
 }
 const ordered=[];
 for(const m of targeted){
  const meta=bot?.p?.G?.monsters?.[m.mtype],victim=roster.get(m.target),
   victimRisk=memberRisk.get(m.target);
  if(m.type!==undefined&&m.type!=='monster'||
     typeof m.id!=='string'||!m.id||m.id.length>100||
     typeof m.mtype!=='string'||!m.mtype||
     m.map!==team.map||(m.in!==undefined&&m.in!==team.map)||
     !caveFocusFinite(m.hp)||m.hp<=0||
     !caveFocusFinite(m.x)||!caveFocusFinite(m.y)||
     !meta||!caveFocusFinite(meta.attack)||meta.attack<=0||
     !caveFocusFinite(meta.frequency)||meta.frequency<=0||
     !caveFocusFinite(victimRisk?.postWindowHp)||
     !caveFocusFinite(victimRisk?.protectedHp))
   return caveFocusBlocked('engaged-monster-definition-invalid',scope);
  const damage=meta.attack*meta.frequency*1.5;
  const margin=(victimRisk.postWindowHp-victimRisk.protectedHp)/
   victim.max_hp;
  if(!caveFocusFinite(damage)||damage<=0||!caveFocusFinite(margin))
   return caveFocusBlocked('threat-priority-nonfinite',scope);
  ordered.push({id:m.id,victim:m.target,mtype:m.mtype,
   hp:m.hp,x:m.x,y:m.y,damage,margin,
   priestThreat:m.target===team.priest});
 }
 // Both Rangers derive the same result from visible aggro, current
 // four-second survival margins, and the same explicit tie-breakers.
 // Protect a targeted Priest first; otherwise address the smallest
 // survivability margin. When equal, remove the strongest DPS first.
 ordered.sort((a,b)=>
  Number(b.priestThreat)-Number(a.priestThreat)||
  a.margin-b.margin||b.damage-a.damage||
  a.hp-b.hp||a.id.localeCompare(b.id));
 const focus=ordered[0];
 if(!focus)return caveFocusBlocked('no-stable-engaged-focus',scope);
 // A stable, bounded identity/health/geometry signature must survive
 // scheduler guard AND the literal network call. Never pin an entity
 // reference; those objects can change while a command is queued.
 const signature=ordered.map(m=>[
  m.id,m.victim,m.mtype,m.hp,m.x,m.y,m.damage
 ].join(':')).sort().join('|');
 const memberSignature=[...roster.values()].map(m=>[
  m.name,m.hp,m.max_hp
 ].join(':')).sort().join('|');
 return {...caveFocusBlocked('confirmed-existing-aggro-focus',scope),
  ready:true,canAttack:true,attackerCount:r.attackerCount,
  focus:{id:focus.id,victim:focus.victim,alreadyEngaged:true},
  signature,memberSignature,riskSignature:r.signature};
}
export function createCaveMultiAggroFocus(bot,{now=()=>Date.now()}={}){
 function status(){
  const team=bot.caveTeam?.status?.();
  return caveMultiAggroFocusPlan(bot,{team,now:now()});
 }
 return {status};
}
