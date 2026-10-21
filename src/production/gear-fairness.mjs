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
  Number.isSafeInteger(profile.level)&&profile.level>=1&&
  Number.isFinite(now)&&Number.isSafeInteger(profile.at)&&
  profile.at>0&&profile.at<=now&&
  now-profile.at<=MAX_GEAR_EVIDENCE_AGE_MS&&
  !!profile.slots&&typeof profile.slots==='object'&&
  SLOT_KEYS.every(key=>{
   if(!Object.hasOwn(profile.slots,key))return false;
   const item=profile.slots[key];
   return item===null||typeof item==='object'&&!Array.isArray(item)&&
    typeof item.name==='string'&&item.name.length>0&&
    item.name.length<=120&&Number.isSafeInteger(item.level)&&
    item.level>=0&&item.level<=99;
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
 if(!own||!SLOT_KEYS.includes(slot)||!SLOT_PRIORITIES[role]||
    !Array.isArray(cohort)||!freshGearEvidence(profile,now))return 0;
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


// W05/W08: the optimizer already measures role-weighted item_properties and
// discounts its marginal improvement by upgrade chance and cost. Compare ONLY
// feasible alternatives for the SAME character; raw class scores or currency
// cannot rank a tank directly against a priest. This bounded ordinal bonus is
// planning evidence, never empirical post-equip performance or permission.
// A sole candidate, ties, stale profiles and unverified optimizer rows add 0.
export function measuredSlotUtilityPriority(goal,candidates,{profile,now=Date.now()}={}){
 if(!freshGearEvidence(profile,now)||!Array.isArray(candidates)||
    !candidates.includes(goal)||!goal||
    typeof goal.character!=='string'||!goal.character||
    !SLOT_KEYS.includes(goal.slot))return 0;
 const valid=g=>g&&typeof g.character==='string'&&
  g.character===goal.character&&SLOT_KEYS.includes(g.slot)&&
  Number.isFinite(g.utility)&&g.utility>0&&
  Number.isFinite(g.chance)&&g.chance>0&&g.chance<=1&&
  Number.isFinite(g.estimatedCost)&&g.estimatedCost>=0;
 if(!valid(goal))return 0;
 const alternatives=candidates.filter(g=>valid(g));
 // A duplicate slot does not establish a second independently actionable
 // improvement, and must not arbitrarily inflate the first candidate.
 if(alternatives.length<2||
    new Set(alternatives.map(g=>g.slot)).size!==alternatives.length)
  return 0;
 const values=alternatives.map(g=>g.utility),low=Math.min(...values),
  high=Math.max(...values),range=high-low;
 if(!Number.isFinite(range)||range<=0)return 0;
 return Math.min(12,Math.max(0,Math.round(12*(goal.utility-low)/range)));
}


// W05/W08: passive actual before/after GEAR and live character stat readings.
// This never proves a causal DPS/survival improvement: buffs, effects, target
// selection and movement may change stats between snapshots. No scheduling,
// spending, mutation or shipment receives authority from this evidence.
const GEAR_OBSERVATION_STATS=['attack','frequency','armor','resistance',
 'max_hp','max_mp','range','crit','apiercing','rpiercing'];
export function observedGearStatDelta(before,after,{
 now=Date.now(),maxGapMs=300000
}={}){
 if(!freshGearEvidence(before,now)||!freshGearEvidence(after,now)||
    !Number.isSafeInteger(maxGapMs)||maxGapMs<1||maxGapMs>3600000||
    typeof before.session!=='string'||!before.session||
    before.session!==after.session||before.realm!==after.realm||
    before.class!==after.class||before.level!==after.level||
    after.at<=before.at||after.at-before.at>maxGapMs||
    !before.stats||typeof before.stats!=='object'||
    Array.isArray(before.stats)||!after.stats||
    typeof after.stats!=='object'||Array.isArray(after.stats))return null;
 const keys=Object.keys(before.stats),nextKeys=Object.keys(after.stats);
 if(keys.length<2||keys.length!==nextKeys.length||
    keys.some(k=>!GEAR_OBSERVATION_STATS.includes(k)||
      !Object.hasOwn(after.stats,k)||!Number.isFinite(before.stats[k])||
      !Number.isFinite(after.stats[k])||
      Math.abs(before.stats[k])>1e9||Math.abs(after.stats[k])>1e9))
  return null;
 const signature=item=>item===null?'null':JSON.stringify([
  item.name,item.level,item.stat_type??'',item.p??'',
  item.title??'',item.l??false,item.b??false]);
 let changed;
 try{changed=SLOT_KEYS.filter(k=>
  signature(before.slots[k])!==signature(after.slots[k]));}
 catch{return null;}
 if(changed.length!==1)return null;
 const slot=changed[0],statDelta={};
 for(const key of keys){
  const d=after.stats[key]-before.stats[key];
  if(!Number.isFinite(d))return null;
  statDelta[key]=d;
 }
 return {version:1,kind:'observed-live-character-stat-delta',
  realm:after.realm,session:after.session,slot,
  from:before.slots[slot],to:after.slots[slot],
  beforeAt:before.at,afterAt:after.at,statDelta,
  directlyObserved:true,causalityConfirmed:false,
  executable:false,priorityAuthorized:false};
}
