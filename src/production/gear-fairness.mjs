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


// Comparable [0..1] role-dependent slot coverage, NOT raw DPS, gear level,
// combat eligibility or a spend authority. A priest's mainhand, a tank's
// defensive shell and a travelling merchant's shoes are not interchangeable.
const SLOT_KEYS=['mainhand','offhand','helmet','chest','pants','shoes','gloves',
 'amulet','belt','cape','ring1','ring2','earring1','earring2','orb'];
const SLOT_WEIGHTS={
 healer:{mainhand:4,chest:2,helmet:2,amulet:2},
 tank:{chest:4,offhand:3,helmet:2,pants:2,belt:2},
 dps:{mainhand:4,offhand:2,gloves:2,ring1:2,ring2:2},
 economy:{shoes:4,belt:2,gloves:2,cape:2}
};
function roleCoverage(p,role){
 if(!p?.complete||!p.slots||
    SLOT_KEYS.some(k=>!Object.hasOwn(p.slots,k)))return null;
 const weights=SLOT_WEIGHTS[role]??SLOT_WEIGHTS.dps;
 const pivotal=role==='economy'?'shoes':role==='tank'?'chest':'mainhand';
 let total=0,filled=0;
 for(const key of SLOT_KEYS){
  const weight=weights[key]??1;total+=weight;
  if(p.slots[key])filled+=weight;
 }
 return {ratio:filled/total,pivotal};
}
export function crossRoleGearPriority(profile,cohort,{
 role='dps',slot='',now=Date.now(),lastImprovedAt=null
}={}){
 const own=roleCoverage(profile,role);
 // A loaded but outdated/off-realm cached profile cannot earn automatic
 // account-wide priority. The same bounded age applies to peer profiles.
 if(!own||!Array.isArray(cohort)||!Number.isFinite(now)||
    !Number.isFinite(profile?.at)||profile.at<=0||profile.at>now||
    now-profile.at>604800000)return 0;
 const values=cohort.filter(x=>x?.profile?.at>0&&now>=x.profile.at&&
  now-x.profile.at<=604800000).map(x=>roleCoverage(x.profile,x.role)).filter(Boolean);
 if(values.length<2)return 0;
 const gap=Math.max(0,Math.max(...values.map(x=>x.ratio))-own.ratio);
 const vacancy=gap>0&&!profile.slots[slot]?(slot===own.pivotal?10:4):0;
 const age=gap>0&&lastImprovedAt>0&&lastImprovedAt<=now?
  Math.min(12,Math.floor((now-lastImprovedAt)/172800000)):0;
 return Math.min(60,Math.round(gap*40)+vacancy+age);
}
