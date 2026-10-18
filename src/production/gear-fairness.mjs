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
