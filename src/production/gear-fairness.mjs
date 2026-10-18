// Only order automatic goals. Explicit priorities, budgets, locks, compatibility
// and the existing minimum-improvement test retain their authority.
export function gearCatchUpPriority(profile,peers){
 if(!profile?.complete||!profile.slots)return 0;
 const quality=p=>{
  const items=Object.values(p.slots??{}),equipped=items.filter(Boolean);
  return {coverage:items.length?equipped.length/items.length:0,
   level:equipped.length?equipped.reduce((n,i)=>n+(i.level??0),0)/equipped.length:0};
 };
 const group=peers.filter(p=>p?.complete&&p.class===profile.class&&p.slots);
 if(!group.length)return 0;
 const own=quality(profile),scores=group.map(quality);
 const coverage=Math.max(...scores.map(p=>p.coverage)),
  level=Math.max(...scores.map(p=>p.level));
 return Math.min(60,Math.max(0,Math.round((coverage-own.coverage)*40+
  Math.max(0,level-own.level)*4)));
}


// W05/W08: compare bounded role-specific slot coverage, not raw gear level
// or damage across unrelated classes. Complete offline profiles can
// participate as planning evidence, never as authorization to equip/send.
const roleSlotWeights={
 healer:{mainhand:10,amulet:3,chest:3,helmet:2,pants:2,shoes:2,gloves:1,ring1:1},
 tank:{mainhand:6,offhand:4,chest:5,helmet:4,pants:4,shoes:2,gloves:2,amulet:1},
 economy:{shoes:4,cape:3,chest:2,helmet:2,pants:2,gloves:1,amulet:2},
 dps:{mainhand:10,chest:3,helmet:2,pants:2,shoes:2,gloves:2,amulet:1,ring1:1}
};
function roleCoverage(profile,role){
 const weights=roleSlotWeights[role]??roleSlotWeights.dps;
 if(!profile?.complete||!profile.slots)return null;
 const slots=Object.keys(weights).filter(k=>Object.hasOwn(profile.slots,k));
 if(slots.length<5)return null;
 const total=slots.reduce((n,k)=>n+weights[k],0);
 const equipped=slots.reduce((n,k)=>n+(profile.slots[k]?weights[k]:0),0);
 return {ratio:equipped/total,weights};
}
export function crossRoleGearPriority(profile,cohort,{
 role='dps',slot='',now=Date.now(),lastImprovedAt=null
}={}){
 const own=roleCoverage(profile,role);
 if(!own||!Array.isArray(cohort)||!Number.isFinite(now)||now<0)return 0;
 const current=cohort.filter(entry=>entry?.profile&&
  Number.isFinite(entry.profile.at)&&entry.profile.at<=now&&
  now-entry.profile.at<=7*86400000).map(entry=>
   roleCoverage(entry.profile,entry.role??'dps')).filter(Boolean);
 if(current.length<2)return 0;
 const best=Math.max(...current.map(x=>x.ratio));
 const gap=Math.max(0,best-own.ratio);
 const roleWeight=own.weights[slot]??0;
 // Slot urgency only when another verified member is more prepared overall.
 const vacancy=gap>0&&roleWeight>0&&!profile.slots[slot]?
  Math.min(12,Math.round(roleWeight*1.2)):0;
 const wait=gap>0&&Number.isSafeInteger(lastImprovedAt)&&lastImprovedAt>0&&
  lastImprovedAt<=now?Math.min(12,Math.floor((now-lastImprovedAt)/172800000)):0;
 return Math.min(60,Math.max(0,Math.round(gap*40)+vacancy+wait));
}
