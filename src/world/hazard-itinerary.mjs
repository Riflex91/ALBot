// Route planning is deliberately separate from native smart_move:
// a map-hop count or a collision path is not a monster-survival proof.
import {isNaturallyAggressive} from '../combat/aggression.mjs';
const hiFinite=n=>typeof n==='number'&&Number.isFinite(n);
const hiPoint=p=>p&&hiFinite(p.x)&&hiFinite(p.y)&&typeof p.map==='string';
const hiDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const hiNodeKey=p=>p.map+':'+Math.round(p.x/4)+':'+Math.round(p.y/4);
const hiBox=(a,b,c,d)=>({x1:Math.min(a,c),y1:Math.min(b,d),x2:Math.max(a,c),y2:Math.max(b,d)});
function hiSegmentBox(a,b,r){
 let min=0,max=1;
 for(const axis of ['x','y']){
  const lo=axis==='x'?r.x1:r.y1,hi=axis==='x'?r.x2:r.y2;
  const delta=b[axis]-a[axis];
  if(Math.abs(delta)<1e-8){if(a[axis]<lo||a[axis]>hi)return false;continue;}
  const t1=(lo-a[axis])/delta,t2=(hi-a[axis])/delta;
  min=Math.max(min,Math.min(t1,t2));max=Math.min(max,Math.max(t1,t2));
  if(min>max)return false;
 }
 return true;
}
function hiSegmentDistance(a,b,c){
 const dx=b.x-a.x,dy=b.y-a.y;
 const t=Math.min(1,Math.max(0,((c.x-a.x)*dx+(c.y-a.y)*dy)/
  Math.max(1e-8,dx*dx+dy*dy)));
 return Math.hypot(a.x+dx*t-c.x,a.y+dy*t-c.y);
}
function hiCovered(map,zone){
 if(zone?.boundary&&zone.boundary.length===4&&zone.boundary.every(hiFinite))
  return [zone.boundary];
 if(Array.isArray(zone?.boundaries))
  return zone.boundaries.filter(r=>r[0]===map&&r.length===5&&r.slice(1).every(hiFinite))
   .map(r=>r.slice(1));
 if(Array.isArray(zone?.polygon)&&zone.polygon.length>=3){
  const pts=zone.polygon.filter(p=>Array.isArray(p)&&p.length===2&&p.every(hiFinite));
  if(pts.length!==zone.polygon.length)return null;
  return [[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),
   Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))]];
 }
 if(zone?.position?.length===2&&zone.position.every(hiFinite)&&hiFinite(zone.radius))
  return [[zone.position[0]-zone.radius,zone.position[1]-zone.radius,
   zone.position[0]+zone.radius,zone.position[1]+zone.radius]];
 return null;
}
export function threatRegions(G,map,liveMonsters=[],{margin=55}={}){
 const data=G?.maps?.[map];
 if(!data||!Array.isArray(data.monsters)||!G?.monsters)
  return {ok:false,reason:'missing-authoritative-monster-map'};
 if(!Array.isArray(liveMonsters)||liveMonsters.length>512)
  return {ok:false,reason:'invalid-live-hostile-observations'};
 const rectangles=[],circles=[];
 for(const zone of data.monsters){
  if(!zone||!G.monsters[zone.type])return {ok:false,reason:'unknown-monster-definition'};
  // Special/rare spawns with count=0 may become live later; include their
  // documented geometry. An unknown format is never a safe empty region.
  if(!isNaturallyAggressive(G,zone))continue;
  const ranges=hiCovered(map,zone);
  if(!ranges?.length||zone.random===true)
   return {ok:false,reason:'unbounded-aggressive-spawn'};
  const attack=G.monsters[zone.type].attack??0;
  const speed=G.monsters[zone.type].speed??0;
  const range=G.monsters[zone.type].range??0;
  const pad=margin+Math.max(0,range)+Math.min(120,Math.max(0,speed)*1.2)+
   (attack>=250?20:0);
  for(const r of ranges)rectangles.push({...hiBox(...r),pad,type:zone.type,count:Math.max(1,zone.count??1)});
 }
 for(const monster of liveMonsters){
  if(!monster)continue;
  if(typeof monster!=='object'||Array.isArray(monster))
   return {ok:false,reason:'invalid-live-hostile-observations'};
  // A missing/NaN coordinate, health, speed or range cannot constitute
  // proof that an active aggressive enemy is absent from the route.
  // This covers roaming prat well outside the static spawn rectangles.
  if(monster.dead===true||monster.hp===0)continue;
  if(!monster.target&&!isNaturallyAggressive(G,monster))continue;
  if(typeof monster.map!=='string'||!monster.map)
   return {ok:false,reason:'unlocated-live-hostile-map'};
  if(monster.map!==map)continue;
  if(!hiPoint(monster)||!hiFinite(monster.hp)||monster.hp<0)
   return {ok:false,reason:'unlocated-live-hostile-position'};
  const def=G.monsters[monster.mtype??monster.type];
  const speed=monster.speed??def?.speed;
  const reach=monster.range??def?.range;
  if(!hiFinite(speed)||speed<0||!hiFinite(reach)||reach<0||
     !hiFinite(margin)||margin<0||margin>200||
     !hiFinite(margin+reach+speed*2.5+45))
   return {ok:false,reason:'unbounded-live-hostile-reach'};
  const rad=margin+reach+speed*2.5+45;
  circles.push({x:monster.x,y:monster.y,r:rad,id:monster.id??null,type:monster.mtype});
  // Track likely near-term movement, without assuming a hostile is leashed
  // to the place where it originally spawned.
  if(hiFinite(monster.vx)&&hiFinite(monster.vy))
   circles.push({x:monster.x+monster.vx*1.5,
    y:monster.y+monster.vy*1.5,r:rad,id:monster.id??null,type:monster.mtype});
 }
 return {ok:true,rectangles,circles};
}
export function segmentThreatFree(regions,a,b){
 if(!regions?.ok||!hiPoint(a)||!hiPoint(b)||a.map!==b.map||
    !Array.isArray(regions.rectangles)||!Array.isArray(regions.circles))
  return false;
 for(const r of regions.rectangles){
  if(!r||![r.x1,r.y1,r.x2,r.y2,r.pad].every(hiFinite)||
     r.pad<0||r.x1>r.x2||r.y1>r.y2)return false;
  if(hiSegmentBox(a,b,{x1:r.x1-r.pad,y1:r.y1-r.pad,
    x2:r.x2+r.pad,y2:r.y2+r.pad}))return false;
 }
 for(const m of regions.circles){
  if(!m||![m.x,m.y,m.r].every(hiFinite)||m.r<0)return false;
  if(hiSegmentDistance(a,b,m)<m.r)return false;
 }
 return true;
}
const hiInside=(p,r)=>p.x>=r.x1-r.pad&&p.x<=r.x2+r.pad&&
 p.y>=r.y1-r.pad&&p.y<=r.y2+r.pad;
const hiDepth=(p,r)=>hiInside(p,r)?Math.min(p.x-r.x1+r.pad,
 r.x2+r.pad-p.x,p.y-r.y1+r.pad,r.y2+r.pad-p.y):0;
// Escape only a region already containing the original start. No new hazard
// may be entered, and every internal step must reduce penetration. The caller
// must independently prove worst-case SOLO survival for the allowed species.
export function segmentHazardEscape(regions,a,b,origin,types=[]){
 if(!regions?.ok||!hiPoint(a)||!hiPoint(b)||!hiPoint(origin)||
   a.map!==b.map||a.map!==origin.map||hiDistance(origin,b)>600)return false;
 for(const r of regions.rectangles){
  if(!hiSegmentBox(a,b,{x1:r.x1-r.pad,y1:r.y1-r.pad,x2:r.x2+r.pad,y2:r.y2+r.pad}))continue;
  if(!types.includes(r.type)||!hiInside(origin,r)||!hiInside(a,r)||
     hiInside(b,r)&&hiDepth(b,r)>=hiDepth(a,r)-2)return false;
 }
 for(const c of regions.circles){
  if(hiSegmentDistance(a,b,c)>=c.r)continue;
  const dx=b.x-a.x,dy=b.y-a.y;
  if(!types.includes(c.type)||hiDistance(origin,c)>=c.r||
     hiDistance(a,c)>=c.r||hiDistance(b,c)<=hiDistance(a,c)+2||
     (a.x-c.x)*dx+(a.y-c.y)*dy<0)return false;
 }
 return true;
}
// An aggressive farm is reached in two phases: threat-free staging followed
// by a separately admitted local entry. Never remove other spawn hazards.
export function farmEntryRegions(regions,plan){
 const b=plan?.bounds;
 if(!regions?.ok||!Array.isArray(b)||b.length!==5||b[0]!==plan.map)return null;
 const matching=r=>r.type===plan.target&&r.x1===Math.min(b[1],b[3])&&
  r.y1===Math.min(b[2],b[4])&&r.x2===Math.max(b[1],b[3])&&r.y2===Math.max(b[2],b[4]);
 if(!regions.rectangles.some(matching))return null;
 return {...regions,rectangles:regions.rectangles.filter(r=>!matching(r)),
  circles:regions.circles.filter(c=>c.type!==plan.target||
   c.x<Math.min(b[1],b[3])||c.x>Math.max(b[1],b[3])||
   c.y<Math.min(b[2],b[4])||c.y>Math.max(b[2],b[4]))};
}
export function farmStagingPoint(regions,plan,canTraverse){
 const entry=farmEntryRegions(regions,plan);if(!entry)return null;
 for(const radius of [80,160,240,320,400,480])for(let k=0;k<16;k++){
  const q={map:plan.map,x:plan.x+Math.cos(k*Math.PI/8)*radius,
   y:plan.y+Math.sin(k*Math.PI/8)*radius};
  if(segmentThreatFree(regions,q,q)&&segmentThreatFree(entry,q,plan)&&
     canTraverse(q.map,q.x,q.y,plan.x,plan.y)===true)return q;
 }
 return null;
}
const hiMergePath=(path)=>{const result=[];for(const n of path)
 if(!result.length||hiDistance(result[result.length-1],n)>.01)result.push(n);
 return result;
};
// Spatial A* with a strict expansion budget. Every neighbor is checked
// for BOTH collision AND threat, and every executed segment is rechecked.
export function findLocalSafePath(map,from,to,regions,canTraverse,{
 step=90,maxNodes=1100,maxDetour=1000,escapeOrigin=null,escapeTypes=[]
}={}){
 if(!hiPoint(from)||!hiPoint(to)||from.map!==map||to.map!==map||
  !regions?.ok||typeof canTraverse!=='function')
  return {ok:false,reason:'invalid-local-route-proof'};
 const edge=(a,b)=>(segmentThreatFree(regions,a,b)||
  escapeOrigin&&segmentHazardEscape(regions,a,b,escapeOrigin,escapeTypes))&&
  canTraverse(map,a.x,a.y,b.x,b.y)===true;
 if(hiDistance(from,to)<.5)return {ok:true,points:[],length:0};
 if(edge(from,to))return {ok:true,points:[to],length:hiDistance(from,to)};
 // No blind fallback to native smart_move when collision geometry is absent.
 const radius=Math.max(500,Math.min(1500,maxDetour));
 const bounds={x1:Math.min(from.x,to.x)-radius,y1:Math.min(from.y,to.y)-radius,
  x2:Math.max(from.x,to.x)+radius,y2:Math.max(from.y,to.y)+radius};
 const open=[{ix:0,iy:0,g:0,h:hiDistance(from,to),parent:null}],best=new Map([['0:0',0]]);
 const moves=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
 let iterations=0;
 while(open.length&&iterations++<maxNodes){
  open.sort((a,b)=>(a.g+a.h)-(b.g+b.h)||a.h-b.h);
  const current=open.shift(),id=current.ix+':'+current.iy;
  if(current.g>best.get(id)+1e-5)continue;
  const here={map,x:from.x+current.ix*step,y:from.y+current.iy*step};
  if(edge(here,to)){
   const p=[to];let c=current;
   while(c&&c.parent!==null){
    p.push({map,x:from.x+c.ix*step,y:from.y+c.iy*step});c=c.parent;
   }
   p.reverse();
   const route=hiMergePath(p),length=route.reduce((n,v,i)=>
    n+hiDistance(i?route[i-1]:from,v),0);
   return {ok:true,points:route,length,expanded:iterations};
  }
  for(const [dx,dy] of moves){
   const ix=current.ix+dx,iy=current.iy+dy;
   const target={map,x:from.x+ix*step,y:from.y+iy*step};
   if(target.x<bounds.x1||target.x>bounds.x2||
      target.y<bounds.y1||target.y>bounds.y2)continue;
   const g=current.g+Math.hypot(dx,dy)*step,k=ix+':'+iy;
   if(g>= (best.get(k)??Infinity)-1e-5||!edge(here,target))continue;
   best.set(k,g);
   open.push({ix,iy,g,h:hiDistance(target,to),parent:current});
  }
 }
 return {ok:false,reason:iterations>=maxNodes?'local-search-budget':'no-safe-local-corridor',
  expanded:iterations};
}
function hiDepartures(G,map){
 const data=G.maps[map],out=[];
 for(const door of data?.doors??[]){
  if(!Array.isArray(door)||door.length<7||door[7]||
    typeof door[4]!=='string'||!Number.isSafeInteger(door[5]??0)||
    !Number.isSafeInteger(door[6])||door[8]||
    !G.maps[door[4]]||G.maps[door[4]].instance||
    G.maps[door[4]].pvp)continue;
  const from=data.spawns?.[door[6]],to=G.maps[door[4]].spawns?.[door[5]??0];
  if(!Array.isArray(from)||!Array.isArray(to)||
    ![from[0],from[1],to[0],to[1]].every(hiFinite))continue;
  out.push({via:'door',from:{map,x:from[0],y:from[1]},
    to:{map:door[4],x:to[0],y:to[1]},spawn:door[5]??0});
 }
 for(const npc of data.npcs??[]){
  if(npc?.id!=='transporter'||!Array.isArray(npc.position)||
    !npc.position.slice(0,2).every(hiFinite))continue;
  for(const [dest,spawn] of Object.entries(G.npcs?.transporter?.places??{})){
   if(!Number.isSafeInteger(spawn)||!G.maps[dest]||
      G.maps[dest].instance||G.maps[dest].pvp)continue;
   const to=G.maps[dest].spawns?.[spawn];
   if(!Array.isArray(to)||![to[0],to[1]].every(hiFinite))continue;
   out.push({via:'transporter',from:{map,x:npc.position[0],y:npc.position[1]},
    to:{map:dest,x:to[0],y:to[1]},spawn});
  }
 }
 return out;
}
// All map edges are server-legal *candidates*. Every local leg still needs
// real arbitrary-map collision proof and risk admission, and runtime arrival
// MUST be confirmed by the engine before following the next leg.
export function planHazardItinerary(G,start,goal,canTraverse,{
 liveMonsters=[],excludedMaps=[],maxStates=38,maxHops=5,maxNodes=1100,
 step=90,maxCollisionChecks=3500,escapeTypes=[]
}={}){
 const fail=(reason,extra={})=>({ok:false,reason,...extra});
 if(!hiPoint(start)||!hiPoint(goal)||!G?.maps?.[start.map]||
   !G.maps[goal.map]||typeof canTraverse!=='function')
  return fail('invalid-world-or-collision-provider');
 // Do not filter unlocated roaming hostiles away before threatRegions gets
 // the opportunity to deny the route. A missing map is UNKNOWN, not safe.
 if(!Array.isArray(liveMonsters)||liveMonsters.length>512)
  return fail('invalid-live-hostile-observations');
 const denied=new Set(excludedMaps);
 const blocks=map=>denied.has(map)||!G.maps[map]||
   G.maps[map].ignore||G.maps[map].pvp||G.maps[map].instance;
 if(blocks(start.map)||blocks(goal.map))return fail('excluded-or-special-map');
 let checkedSegments=0;
 const checked=(...args)=>{
  if(++checkedSegments>maxCollisionChecks)return false;
  return canTraverse(...args);
 };
 const regions=new Map(),lookup=map=>{
  if(!regions.has(map))regions.set(map,threatRegions(G,map,
   liveMonsters.filter(m=>!m||typeof m.map!=='string'||
    !m.map||m.map===map)));
  return regions.get(map);
 };
 const walks=new Map(),walker=(map,from,to)=>{
  const key=JSON.stringify([map,from.x,from.y,to.x,to.y]);
  if(!walks.has(key))walks.set(key,findLocalSafePath(map,from,to,lookup(map),
   checked,{step,maxNodes,escapeOrigin:start,escapeTypes}));
  return walks.get(key);
 };
 const queue=[{position:start,steps:[],cost:0,hops:0,maps:[start.map]}];
 const seen=new Map();
 let states=0,bestResult=null;
 while(queue.length&&states++<maxStates){
  queue.sort((a,b)=>a.cost-b.cost);
  const s=queue.shift(),signature=hiNodeKey(s.position);
  if(s.cost>(seen.get(signature)??Infinity))continue;
  if(s.position.map===goal.map){
   const last=walker(goal.map,s.position,goal);
   if(last.ok){
    const candidate={ok:true,steps:[...s.steps,...last.points.map(p=>({
     type:'move',map:p.map,x:p.x,y:p.y}))],
     length:s.cost+last.length,
     maps:s.maps,portalCount:s.hops};
    if(!bestResult||candidate.length<bestResult.length)bestResult=candidate;
   }
  }
  if(s.hops>=maxHops||s.cost>(bestResult?.length??Infinity))continue;
  const portals=hiDepartures(G,s.position.map);
  // Prioritize nearby portals, but preserve all visible transporter edges.
  portals.sort((a,b)=>hiDistance(s.position,a.from)-hiDistance(s.position,b.from));
  for(const portal of portals.slice(0,28)){
   if(blocks(portal.to.map)||s.maps.filter(x=>x===portal.to.map).length>=2)continue;
   const walk=walker(s.position.map,s.position,portal.from);
   if(!walk.ok)continue;
   // The portal endpoint itself is not always free of aggro. Entry
   // inside a static lethal field is refused before server transport.
   const arrival=lookup(portal.to.map);
   if(!segmentThreatFree(arrival,portal.to,portal.to))continue;
   const cost=s.cost+walk.length+300;
   const k=hiNodeKey(portal.to);if(cost>=(seen.get(k)??Infinity))continue;
   seen.set(k,cost);
   queue.push({position:portal.to,cost,hops:s.hops+1,
    maps:[...s.maps,portal.to.map],
    steps:[...s.steps,...walk.points.map(p=>({
     type:'move',map:p.map,x:p.x,y:p.y})),
     {type:'transport',via:portal.via,from:portal.from,
      map:portal.to.map,spawn:portal.spawn,x:portal.to.x,y:portal.to.y}]});
  }
 }
 return bestResult??fail(checkedSegments>=maxCollisionChecks?
   'collision-proof-work-budget':states>=maxStates?'world-search-budget':
   'no-certified-world-route',
  {visited:states,collisionChecks:checkedSegments});
}
