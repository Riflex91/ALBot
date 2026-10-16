import {outgoingDamageEstimate} from './damage-model.mjs';

// Safety-biased lower planning bound; never implies guaranteed lethal damage.
// Hit confirmation remains server-owned. This bound is used only to prefer
// another ALREADY ENGAGED safe monster, not to suppress necessary attacks.
export function provisionalImpactDamage(attacker,monster,skill=null){
 const result=outgoingDamageEstimate(attacker,monster,{skill,
  uncertainty:.35});
 if(!result.valid||result.accuracy!==1||!(result.damage>0))
  return 0;
 return Math.max(0,Math.floor(result.damage*.75));
}

export function pendingImpactDamage(targetId,now,source,roster,realm){
 if(typeof targetId!=='string'||!Number.isFinite(now)||
    !Array.isArray(source)||!(roster instanceof Set)||typeof realm!=='string')
  return 0;
 let damage=0;
 const seen=new Set();
 for(const peer of source){
  if(!peer?.running||peer.rip||peer.realm!==realm||
     !roster.has(peer.name)||typeof peer.session!=='string'||
     !Array.isArray(peer.impactIntents)||
     !Number.isFinite(peer.received)||now-peer.received<0||
     now-peer.received>2500)continue;
  for(const entry of peer.impactIntents.slice(0,8)){
   if(!entry||entry.kind!=='damage'||entry.realm!==realm||
      entry.session!==peer.session||
      !Number.isFinite(entry.at)||!Number.isFinite(entry.expires)||
      entry.at>now||now-entry.at>2400||entry.expires<=now||
      entry.expires-entry.at>3000||entry.expires-entry.at<100||
      !Array.isArray(entry.targets)||entry.targets.length>5)continue;
   const fingerprint=peer.name+':'+entry.session+':'+entry.at+':'+entry.action;
   if(seen.has(fingerprint))continue;
   seen.add(fingerprint);
   const estimate=entry.damage?.[targetId];
   if(!entry.targets.includes(targetId)||
      !Number.isSafeInteger(estimate)||estimate<=0||estimate>10000000)continue;
   damage+=estimate;
   if(damage>10000000)return 10000000;
  }
 }
 return damage;
}

// Advisory team-heal collision evidence. A projected heal has no calibrated
// amount, so this NEVER blocks a real rescue heal, consumes resources, or
// declares HP restored. Only fresh same-realm authenticated sessions count.
export function pendingImpactHeals(targetName,now,sources,roster,realm){
 if(typeof targetName!=='string'||!targetName||
    !Number.isFinite(now)||!Array.isArray(sources)||
    !(roster instanceof Set)||typeof realm!=='string')return 0;
 const seen=new Set();let count=0;
 for(const peer of sources){
  if(!peer?.running||peer.rip||peer.realm!==realm||
     !roster.has(peer.name)||typeof peer.session!=='string'||
     !Array.isArray(peer.impactIntents)||
     !Number.isFinite(peer.received)||peer.received>now||
     now-peer.received>2500)continue;
  for(const row of peer.impactIntents.slice(0,8)){
   if(row?.kind!=='heal'||row.realm!==realm||
      row.session!==peer.session||
      !Number.isFinite(row.at)||!Number.isFinite(row.expires)||
      row.at>now||now-row.at>2400||row.expires<=now||
      row.expires-row.at>10000||row.expires-row.at<100||
      !Array.isArray(row.targets)||row.targets.length>5||
      !row.targets.includes(targetName))continue;
   const id=peer.name+':'+peer.session+':'+row.at+':'+row.action;
   if(seen.has(id))continue;
   seen.add(id);count++;
   if(count>=32)return 32;
  }
 }
 return count;
}

// Active, fail-open focus preference only. The existing allowed() filter
// produced all candidates; we NEVER pull a neutral monster or switch to
// another species, or take precedence over self-defense. No target is removed.
export function preferUnreservedEngagedTarget({
 selected,candidates,character,roster,realm,now,sources,maxRange
}){
 const unchanged=reason=>({target:selected,changed:false,reason});
 if(!selected?.id||selected.boss||selected.target===character?.name||
    !Array.isArray(candidates)||!character||!Number.isFinite(maxRange)||
    maxRange<=0)return unchanged('self-defense-or-no-choice');
 const members=new Set(roster??[]);
 if(!members.has(character.name))return unchanged('roster-unverified');
 const candidatesEngaged=candidates.filter(e=>e?.id&&e.id!==selected.id&&
  e.mtype===selected.mtype&&!e.dead&&e.hp>0&&
  e.target&&members.has(e.target)&&
  (e.map??character.map)===character.map&&
  (e.in??e.map??character.map)===(character.in??character.map)&&
  Number.isFinite(e.x)&&Number.isFinite(e.y)&&
  Math.hypot(e.x-character.x,e.y-character.y)<=maxRange);
 if(!candidatesEngaged.length)return unchanged('no-safe-already-engaged-alternative');
 if(!(selected.hp>0)||!Number.isFinite(selected.hp)||
    selected.mtype===undefined)return unchanged('current-health-unverified');
 const pending=pendingImpactDamage(selected.id,now,sources,members,realm);
 if(pending<selected.hp*1.3)return unchanged('no-credible-near-lethal-pending-hit');
 const alternative=candidatesEngaged
  .map(e=>({entity:e,inflight:pendingImpactDamage(e.id,now,sources,members,realm)}))
  .filter(x=>x.inflight<x.entity.hp*1.3)
  .sort((a,b)=>a.inflight-b.inflight||
   Math.hypot(a.entity.x-character.x,a.entity.y-character.y)-
   Math.hypot(b.entity.x-character.x,b.entity.y-character.y))[0]?.entity;
 return alternative?
  {target:alternative,changed:true,reason:'redirect-only-to-engaged-safe-target',
   reserved:pending,from:selected.id,to:alternative.id}:
  unchanged('all-alternatives-reserved');
}
