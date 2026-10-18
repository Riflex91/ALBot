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


// Account-comparable, role-weighted slot coverage. Incomplete or old
// profiles never confer authority to equip; only automatic job priority.
function roleCoverage(p,role){
 if(!p?.complete||!p.slots)return null;
 const keys=Object.keys(p.slots);
 if(keys.length<10)return null;
 const pivotal=role==='economy'?'shoes':role==='tank'?'chest':'mainhand';
 return {ratio:(keys.filter(k=>p.slots[k]).length+(p.slots[pivotal]?3:0))/(keys.length+3),pivotal};
}
export function crossRoleGearPriority(profile,cohort,{
 role='dps',slot='',now=Date.now(),lastImprovedAt=null
}={}){
 const own=roleCoverage(profile,role);
 if(!own||!Array.isArray(cohort))return 0;
 const values=cohort.filter(x=>x?.profile?.at>0&&now>=x.profile.at&&
  now-x.profile.at<=604800000).map(x=>roleCoverage(x.profile,x.role)).filter(Boolean);
 if(values.length<2)return 0;
 const gap=Math.max(0,Math.max(...values.map(x=>x.ratio))-own.ratio);
 const vacancy=gap>0&&!profile.slots[slot]?(slot===own.pivotal?10:4):0;
 const age=gap>0&&lastImprovedAt>0&&lastImprovedAt<=now?
  Math.min(12,Math.floor((now-lastImprovedAt)/172800000)):0;
 return Math.min(60,Math.round(gap*40)+vacancy+age);
}
