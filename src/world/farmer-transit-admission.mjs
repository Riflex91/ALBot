// Physical, fail-closed admission for autonomous farmer movement.
// Native smart_move uses collision BFS, not a monster-risk proof. Until a
// certified route executor exists, farmers may only dispatch one proven
// direct same-map segment. No portal graph is a substitute for that proof.
import {isNaturallyAggressive} from '../combat/aggression.mjs';

const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const span=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function clearance(point,box){
 const dx=Math.max(box.x1-point.x,0,point.x-box.x2);
 const dy=Math.max(box.y1-point.y,0,point.y-box.y2);
 if(dx||dy)return Math.hypot(dx,dy);
 return -Math.min(point.x-box.x1,box.x2-point.x,point.y-box.y1,box.y2-point.y);
}
function hitsBox(a,b,box){
 let lo=0,hi=1;
 for(const axis of ['x','y']){
  const low=axis==='x'?box.x1:box.y1;
  const high=axis==='x'?box.x2:box.y2;
  const v=b[axis]-a[axis];
  if(Math.abs(v)<1e-9){if(a[axis]<low||a[axis]>high)return false;continue;}
  const t1=(low-a[axis])/v,t2=(high-a[axis])/v;
  lo=Math.max(lo,Math.min(t1,t2));
  hi=Math.min(hi,Math.max(t1,t2));
  if(lo>hi)return false;
 }
 return true;
}
function segmentClearance(a,b,point){
 const dx=b.x-a.x,dy=b.y-a.y;
 const t=Math.max(0,Math.min(1,((point.x-a.x)*dx+(point.y-a.y)*dy)/
  Math.max(1e-6,dx*dx+dy*dy)));
 return Math.hypot(a.x+dx*t-point.x,a.y+dy*t-point.y);
}
function boundsFor(G,map){
 const data=G?.maps?.[map];
 if(!data||!Array.isArray(data.monsters))return null;
 const boxes=[];
 for(const pack of data.monsters){
  if(typeof pack?.type!=='string'||!G.monsters?.[pack.type])
   return null; // Unknown monsters are not proof of a safe map.
  if(!isNaturallyAggressive(G,pack))continue;
  const ranges=pack.boundaries??(pack.boundary?[[map,...pack.boundary]]:null);
  if(!Array.isArray(ranges)||!ranges.length)return null;
  for(const range of ranges){
   if(!Array.isArray(range)||range.length<5||
      ![range[1],range[2],range[3],range[4]].every(Number.isFinite))
    return null;
   if(range[0]!==map)continue;
   boxes.push({type:pack.type,x1:Math.min(range[1],range[3]),
    y1:Math.min(range[2],range[4]),x2:Math.max(range[1],range[3]),
    y2:Math.max(range[2],range[4])});
  }
 }
 return boxes;
}
// This release's hard stop is activated by *positive authoritative*
// evidence of the precise 2026-10-24 lethal corridor. Isolated mock maps
// and unrelated monsterless game worlds retain their existing navigation.
// No missing or uncertain level1/prat record is treated as a safe route once
// this incident signature is present.
export function pratCorridorGuardRequired(G){
 const definition=G?.monsters?.prat;
 return (definition?.aggro===true||Number.isFinite(definition?.aggro)&&
   definition.aggro>0)&&
  (G?.maps?.level1?.monsters??[]).some(pack=>pack?.type==='prat');
}
export function mapHasNaturalAggro(G,map){
 const boxes=boundsFor(G,map);
 return boxes===null||boxes.length>0;
}
export function farmerTransitAdmission(character,destination,G,{
 canMove=()=>false,liveMonsters=[],excludedMaps=[],margin=70
}={}){
 const deny=(reason,hazard=null)=>({allowed:false,reason,hazard});
 if(!finitePoint(character)||!finitePoint(destination)||
    typeof character.map!=='string'||typeof destination.map!=='string')
  return deny('missing-physical-route-evidence');
 if(!G?.maps?.[character.map]||!G.maps[destination.map]||
    excludedMaps.includes(destination.map))
  return deny('unknown-or-excluded-map',destination.map);
 if(G.maps[destination.map]?.instance||G.maps[destination.map]?.pvp)
  return deny('instance-or-pvp-not-certified',destination.map);
 if(character.map!==destination.map||
    (character.in??character.map)!==(destination.in??destination.map))
  return deny('cross-map-route-not-physically-certified',destination.map);
 const boxes=boundsFor(G,character.map);
 if(boxes===null)return deny('unverified-local-spawn-geometry',character.map);
 if(span(character,destination)<1)
  return {allowed:true,reason:'already-at-destination'};
 if(typeof canMove!=='function'||canMove(destination.x,destination.y)!==true)
  return deny('no-direct-native-collision-proof',destination.map);
 const step=span(character,destination);
 // A single escape from an already exposed point may reduce exposure.
 // A full smart route, an approach deeper into aggro, or side-to-side
 // wandering INSIDE an aggro rectangle is never an escape proof.
 const witness=(signed,label)=>{
  const before=signed(character);
  if(before>0){
   if(signed(destination)<=0)return deny('enters-hostile-corridor',label);
   // The exact segment, not endpoints alone, must remain outside.
   for(let k=1;k<10;k++){
    const point={x:character.x+(destination.x-character.x)*k/10,
     y:character.y+(destination.y-character.y)*k/10};
    if(signed(point)<=0)return deny('crosses-hostile-corridor',label);
   }
   return null;
  }
  if(step>70)return deny('hazard-escape-step-too-long',label);
  if(signed(destination)<before+3)
   return deny('hazard-escape-not-progressing',label);
  let previous=before;
  for(let k=1;k<=10;k++){
   const point={x:character.x+(destination.x-character.x)*k/10,
    y:character.y+(destination.y-character.y)*k/10};
   const value=signed(point);
   if(value<previous-0.01)return deny('hazard-escape-reenters',label);
   previous=value;
  }
  return null;
 };
 for(const b of boxes){
  const expanded={x1:b.x1-margin,y1:b.y1-margin,
   x2:b.x2+margin,y2:b.y2+margin};
  if(clearance(character,expanded)>0&&hitsBox(character,destination,expanded))
   return deny('crosses-hostile-spawn',b.type);
  const rejected=witness(pt=>clearance(pt,expanded),b.type);
  if(rejected)return rejected;
 }
 for(const mob of liveMonsters??[]){
  if(!mob||mob.dead||!(mob.hp>0)||!finitePoint(mob)||
     mob.map&&mob.map!==character.map||
     !mob.target&&!isNaturallyAggressive(G,mob))continue;
  const meta=G.monsters?.[mob.mtype??mob.type];
  const radius=Math.max(80,(mob.range??meta?.range??30)+55);
  const signed=pt=>span(pt,mob)-radius;
  if(signed(character)>0&&segmentClearance(character,destination,mob)<=radius)
   return deny('crosses-live-hostile',mob.mtype??mob.type??null);
  const rejected=witness(signed,mob.mtype??mob.type??null);
  if(rejected)return rejected;
 }
 return {allowed:true,reason:'single-direct-monster-checked-segment'};
}
