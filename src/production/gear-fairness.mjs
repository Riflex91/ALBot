// Only order automatic goals. Explicit priorities, budgets, locks, compatibility
// and the existing minimum-improvement test retain their authority.
// Snapshot timestamps are observations, not refreshed heartbeat timestamps.
export function gearCatchUpPriority(profile,peers,{now=Date.now()}={}){
 if(!freshGearEvidence(profile,now)||!Array.isArray(peers))return 0;
 const quality=p=>{
  const items=SLOT_KEYS.map(key=>p.slots[key]),equipped=items.filter(Boolean);
  return {coverage:equipped.length/items.length,
   level:equipped.length?equipped.reduce((n,i)=>n+i.level,0)/equipped.length:0};
 };
 const group=peers.filter(p=>freshGearEvidence(p,now)&&
  p.realm===profile.realm&&p.class===profile.class);
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
// Three role-critical slots carry graded coverage weight (4,3,2).
// All other canonical slots count once; maximum is 15+3+2+1 = 21.
const SLOT_PRIORITIES={
 healer:['mainhand','chest','helmet'],
 tank:['chest','offhand','helmet'],
 dps:['mainhand','offhand','gloves'],
 economy:['shoes','belt','gloves']
};
const MAX_GEAR_EVIDENCE_AGE_MS=7*86400000;
function freshGearEvidence(profile,now){
 return !!profile&&profile.complete===true&&
  typeof profile.realm==='string'&&!!profile.realm&&
  typeof profile.class==='string'&&!!profile.class&&
  Number.isFinite(now)&&Number.isSafeInteger(profile.at)&&
  profile.at>0&&profile.at<=now&&
  now-profile.at<=MAX_GEAR_EVIDENCE_AGE_MS&&
  !!profile.slots&&typeof profile.slots==='object'&&
  SLOT_KEYS.every(key=>{
   if(!Object.hasOwn(profile.slots,key))return false;
   const item=profile.slots[key];
   return !item||typeof item==='object'&&!Array.isArray(item)&&
    Number.isSafeInteger(item.level)&&item.level>=0&&item.level<=99;
  });
}
function roleCoverage(p,role){
 if(!p?.complete||!p.slots||
    SLOT_KEYS.some(k=>!Object.hasOwn(p.slots,k)))return null;
 const top=SLOT_PRIORITIES[role]??SLOT_PRIORITIES.dps;
 const filled=SLOT_KEYS.reduce((sum,k)=>sum+(p.slots[k]?
  k===top[0]?4:k===top[1]?3:k===top[2]?2:1:0),0);
 return {ratio:filled/21,pivotal:top[0]};
}
export function crossRoleGearPriority(profile,cohort,{
 role='dps',slot='',now=Date.now(),lastImprovedAt=null
}={}){
 const own=roleCoverage(profile,role);
 // Freshness AND realm come from actual versioned per-character gear
 // snapshots. A remote or missing-realm cached profile is not evidence.
 if(!own||!Array.isArray(cohort)||!freshGearEvidence(profile,now))return 0;
 const values=cohort.filter(x=>freshGearEvidence(x?.profile,now)&&
  x.profile.realm===profile.realm)
  .map(x=>roleCoverage(x.profile,x.role)).filter(Boolean);
 if(values.length<2)return 0;
 const gap=Math.max(0,Math.max(...values.map(x=>x.ratio))-own.ratio);
 const vacancy=gap>0&&!profile.slots[slot]?(slot===own.pivotal?10:4):0;
 const age=gap>0&&lastImprovedAt>0&&lastImprovedAt<=now?
  Math.min(12,Math.floor((now-lastImprovedAt)/172800000)):0;
 return Math.min(60,Math.round(gap*40)+vacancy+age);
}
