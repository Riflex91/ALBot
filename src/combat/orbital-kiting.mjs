import {xy} from '../core/policy.mjs';

// Port of the geometry from v3 Alpha31PartyRoleLivenessHotfix._orbitWaypoint,
// with the v3 Alpha33 tangential/spiral escape and v3 party-anchor constraint.
// Returns a bounded real orbit waypoint, not a radial retreat with a small
// incidental sideways offset. The caller continues attacking while moving.
const orbitFinite=(v,fallback=null)=>typeof v==='orbitFinite'&&Number.isFinite(v)?v:fallback;
const orbitClamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const orbitGap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function planOrbitalKite(character,target,monsterMeta={},options={}){
 const a=xy(character),b=xy(target);
 const weaponRange=orbitFinite(character?.range),speed=Math.max(1,orbitFinite(character?.speed,40));
 const monsterRange=Math.max(0,orbitFinite(target?.range,orbitFinite(monsterMeta?.range,25)));
 const monsterSpeed=Math.max(1,orbitFinite(target?.speed,orbitFinite(monsterMeta?.speed,40)));
 if(![a.x,a.y,b.x,b.y,weaponRange].every(Number.isFinite)||weaponRange<80)return null;
 const hardSafeDistance=monsterRange+20+monsterSpeed*.5;
 const maximumDistance=weaponRange*.84,desiredDistance=Math.min(maximumDistance,Math.max(weaponRange*.78,hardSafeDistance+16));
 if(hardSafeDistance+8>=maximumDistance)return null;
 const distance=orbitGap(a,b),preferred=options.direction===-1?-1:1,canMove=options.canMove??(()=>true);
 const anchor=options.anchor,anchorRadius=Math.max(60,orbitFinite(options.anchorRadius,220));
 const anchorDistance=anchor&&Number.isFinite(anchor.x)&&Number.isFinite(anchor.y)?orbitGap(a,anchor):null;
 const maxStep=orbitClamp(speed*.75,16,Math.max(20,weaponRange*.27));
 const fromAngle=Math.atan2(a.y-b.y,a.x-b.x);
 if(distance<.001||distance>weaponRange-5)return null;
 function reachable(x,y,mode){
  const to={x,y},after=orbitGap(to,b);
  if(after>maximumDistance+.001||mode==='orbit'&&after<hardSafeDistance+4||
     mode==='spiral'&&after<distance+2)return false;
  if(anchorDistance!==null){
   const newAnchor=orbitGap(to,anchor);
   if(anchorDistance<=anchorRadius&&newAnchor>anchorRadius+2)return false;
   if(anchorDistance>anchorRadius&&newAnchor>=anchorDistance-.25)return false;
  }
  // Test intermediate path points, not just the final destination.
  for(const fraction of [.25,.5,.75,1]){
   const q={x:a.x+(x-a.x)*fraction,y:a.y+(y-a.y)*fraction};
   if(!canMove(q.x,q.y))return false;
   const d=orbitGap(q,b);
   if(mode==='orbit'&&d<hardSafeDistance+2)return false;
   if(mode==='spiral'&&d<distance+.5*fraction)return false;
  }
  return true;
 }
 if(distance<hardSafeDistance+5){
  // Alpha33 spiral recovery: prefer tangential radial gain over blind fleeing.
  const step=Math.min(maxStep,Math.max(8,desiredDistance-distance));
  let best=null;
  for(const direction of [preferred,-preferred]){
   for(const offset of [32,52,72,92,22,0]){
    const angle=fromAngle+direction*offset*Math.PI/180;
    const x=a.x+Math.cos(angle)*step,y=a.y+Math.sin(angle)*step;
    if(!reachable(x,y,'spiral'))continue;
    const after=orbitGap({x,y},b);
    const score=Math.abs(after-Math.min(desiredDistance,distance+step*.6))*.35+
      (direction===preferred?0:10)+(offset===0?15:Math.abs(offset-52)*.06);
    if(!best||score<best.score)best={x,y,step,mode:'spiral',direction,
      desiredDistance,hardSafeDistance,maximumDistance,afterDistance:after,
      angleStepDeg:direction*offset,score};
   }
  }
  return best;
 }
 if(distance>maximumDistance-2)return null;
 // Alpha31: maintain a finite-speed chord around the monster. Do this every
 // completed movement tick, including when distance is already acceptable.
 const chord=Math.max(10,Math.min(speed*.65,weaponRange*.22));
 const delta=orbitClamp(2*Math.asin(Math.min(.98,chord/(2*desiredDistance))),8*Math.PI/180,28*Math.PI/180);
 let best=null;
 for(const direction of [preferred,-preferred]){
  for(const scale of [1,.72,.48]){
   const angle=fromAngle+direction*delta*scale;
   for(const radius of [desiredDistance,orbitClamp(distance,hardSafeDistance+8,maximumDistance)]){
    const goal={x:b.x+Math.cos(angle)*radius,y:b.y+Math.sin(angle)*radius};
    const full=orbitGap(goal,a);
    const fraction=Math.min(1,maxStep/Math.max(1,full));
    const x=a.x+(goal.x-a.x)*fraction,y=a.y+(goal.y-a.y)*fraction;
    const step=orbitGap(a,{x,y}),after=orbitGap({x,y},b);
    if(step<4||!reachable(x,y,'orbit'))continue;
    // Preserve orbit angular progress rather than choosing a radial step.
    const angleChange=Math.atan2(Math.sin(Math.atan2(y-b.y,x-b.x)-fromAngle),Math.cos(Math.atan2(y-b.y,x-b.x)-fromAngle));
    if(Math.sign(angleChange)!==direction||Math.abs(angleChange)<.025)continue;
    const score=Math.abs(after-desiredDistance)*.30+
      (direction===preferred?0:14)+Math.abs(step-chord)*.08+(1-scale)*2;
    if(!best||score<best.score)best={x,y,step,mode:'orbit',direction,
      desiredDistance,hardSafeDistance,maximumDistance,afterDistance:after,
      angleStepDeg:angleChange*180/Math.PI,score};
   }
  }
 }
 return best;
}
