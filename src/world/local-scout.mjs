// N05: one optional, strictly local observation hop inside an EXISTING
// approved, currently occupied farm plan. It grants no map/monster authority.
// Rectangular spawn bounds are convex: if both actual endpoints retain
// this safety margin, the straight native move cannot leave the rectangle.
export function insideScoutFarmBoundary(point,bounds,margin=10){
 if(!point||!Array.isArray(bounds)||bounds.length!==5||
    typeof point.map!=='string'||point.map!==bounds[0]||
    !Number.isFinite(point.x)||!Number.isFinite(point.y)||
    !Number.isFinite(margin)||margin<0||
    !bounds.slice(1).every(Number.isFinite))return false;
 const [,x1,y1,x2,y2]=bounds;
 return x1+margin<=x2-margin&&y1+margin<=y2-margin&&
  point.x>=x1+margin&&point.x<=x2-margin&&
  point.y>=y1+margin&&point.y<=y2-margin;
}
export function approvedLocalScoutHop({row,plan,character,realm,now,
 approved=false,solo=false,safe=false}={}){
 const deny=reason=>({allowed:false,reason,point:null});
 if(!approved||!solo||!safe)return deny('missing-farm-safety-authority');
 if(!Number.isSafeInteger(now)||now<=0||
    !row||!plan||!character||plan.kind!=='farm'||
    typeof plan.target!=='string'||plan.target!==row.monster||
    plan.objective||!plan.key||!plan.id||
    plan.realm!==realm||row.realm!==realm)return deny('unapproved-scout-context');
 if(!Number.isSafeInteger(row.killedAt)||row.killedAt<=0||
    row.scoutState!=='observing'||
    !Number.isSafeInteger(row.scoutUntil)||row.scoutUntil<=now||
    row.scoutUntil-row.killedAt>300000||
    row.killedAt>now||
    !Number.isSafeInteger(row.scoutNegatives)||
    row.scoutNegatives<1||row.scoutNegatives>=12||
    !Number.isSafeInteger(row.lastMissingAt)||
    row.lastMissingAt<row.killedAt||
    row.lastMissingAt>now||now-row.lastMissingAt>10000)
   return deny('no-fresh-finite-negative-sighting');
 if(plan.map!==row.map||plan.in!==row.in||
    character.map!==row.map||
    (character.in??character.map)!==row.in||
    !Number.isFinite(character.x)||!Number.isFinite(character.y)||
    !Number.isFinite(plan.x)||!Number.isFinite(plan.y)||
    !Number.isFinite(row.x)||!Number.isFinite(row.y))
   return deny('cross-context-or-invalid-coordinates');
 const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 if(dist(character,plan)>65||dist(row,plan)>70||
    dist(character,row)<=45||dist(character,row)>95)
   return deny('outside-current-safe-farm-anchor');
 if(!insideScoutFarmBoundary(character,plan.bounds)||
    !insideScoutFarmBoundary(row,plan.bounds))
   return deny('scout-hop-outside-approved-boundary');
 return {allowed:true,reason:'single-hop-inside-approved-farm',
  point:{map:row.map,in:row.in,x:row.x,y:row.y,radius:8},
  witness:{id:row.id,killedAt:row.killedAt,planId:plan.id,realm}};
}
