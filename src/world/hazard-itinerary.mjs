// Route planning is deliberately separate from native smart_move:
// a map-hop count or a collision path is not a monster-survival proof.
import {isNaturallyAggressive} from '../combat/aggression.mjs';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const point=p=>p&&finite(p.x)&&finite(p.y)&&typeof p.map==='string';
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const key=p=>p.map+':'+Math.round(p.x/4)+':'+Math.round(p.y/4);
const box=(a,b,c,d)=>({x1:Math.min(a,c),y1:Math.min(b,d),x2:Math.max(a,c),y2:Math.max(b,d)});
function segmentBox(a,b,r){
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
function segDistance(a,b,c){
 const dx=b.x-a.x,dy=b.y-a.y;
 const t=Math.min(1,Math.max(0,((c.x-a.x)*dx+(c.y-a.y)*dy)/
  Math.max(1e-8,dx*dx+dy*dy)));
 return Math.hypot(a.x+dx*t-c.x,a.y+dy*t-c.y);
}
function covered(map,zone){
 if(zone?.boundary&&zone.boundary.length===4&&zone.boundary.every(finite))
  return [zone.boundary];
 if(Array.isArray(zone?.boundaries))
  return zone.boundaries.filter(r=>r[0]===map&&r.length===5&&r.slice(1).every(finite))
   .map(r=>r.slice(1));
 if(Array.isArray(zone?.polygon)&&zone.polygon.length>=3){
  const pts=zone.polygon.filter(p=>Array.isArray(p)&&p.length===2&&p.every(finite));
  if(pts.length!==zone.polygon.length)return null;
  return [[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),
   Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))]];
 }
 if(zone?.position?.length===2&&zone.position.every(finite)&&finite(zone.radius))
  return [[zone.position[0]-zone.radius,zone.position[1]-zone.radius,
   zone.position[0]+zone.radius,zone.position[1]+zone.radius]];
 return null;
}
export function threatRegions(G,map,liveMonsters=[],{margin=55}={}){
 const data=G?.maps?.[map];
 if(!data||!Array.isArray(data.monsters)||!G?.monsters)
  return {ok:false,reason:'missing-authoritative-monster-map'};
 const rectangles=[],circles=[];
 for(const zone of data.monsters){
  if(!zone||!G.monsters[zone.type])return {ok:false,reason:'unknown-monster-definition'};
  // Special/rare spawns with count=0 may become live later; include their
  // documented geometry. An unknown format is never a safe empty region.
  if(!isNaturallyAggressive(G,zone))continue;
  const ranges=covered(map,zone);
  if(!ranges?.length||zone.random===true)
   return {ok:false,reason:'unbounded-aggressive-spawn'};
  const attack=G.monsters[zone.type].attack??0;
  const speed=G.monsters[zone.type].speed??0;
  const range=G.monsters[zone.type].range??0;
  const pad=margin+Math.min(170,Math.max(0,range)+Math.max(0,speed)*1.2)+
   (attack>=250?20:0);
  for(const r of ranges)rectangles.push({...box(...r),pad,type:zone.type});
 }
 for(const monster of liveMonsters??[]){
  if(!monster||monster.dead||!(monster.hp>0)||!point(monster)||
    monster.map!==map||!monster.target&&!isNaturallyAggressive(G,monster))continue;
  const def=G.monsters[monster.mtype??monster.type]??{};
  const speed=Math.max(0,monster.speed??def.speed??0);
  const reach=Math.max(0,monster.range??def.range??0);
  const rad=margin+reach+speed*2.5+45;
  circles.push({x:monster.x,y:monster.y,r:rad,id:monster.id??null});
  // Track likely near-term movement, without assuming a hostile is leashed
  // to the place where it originally spawned.
  if(finite(monster.vx)&&finite(monster.vy))
   circles.push({x:monster.x+monster.vx*1.5,
    y:monster.y+monster.vy*1.5,r:rad,id:monster.id??null});
 }
 return {ok:true,rectangles,circles};
}
export function segmentThreatFree(regions,a,b){
 if(!regions?.ok||!point(a)||!point(b)||a.map!==b.map)return false;
 for(const r of regions.rectangles)
  if(segmentBox(a,b,{x1:r.x1-r.pad,y1:r.y1-r.pad,
    x2:r.x2+r.pad,y2:r.y2+r.pad}))return false;
 for(const m of regions.circles)
  if(segDistance(a,b,m)<m.r)return false;
 return true;
}
const mergePath=(path)=>{const result=[];for(const n of path)
 if(!result.length||dist(result[result.length-1],n)>.01)result.push(n);
 return result;
};
// Spatial A* with a strict expansion budget. Every neighbor is checked
// for BOTH collision AND threat, and every executed segment is rechecked.
export function findLocalSafePath(map,from,to,regions,canTraverse,{
 step=90,maxNodes=1100,maxDetour=1000
}={}){
 if(!point(from)||!point(to)||from.map!==map||to.map!==map||
  !regions?.ok||typeof canTraverse!=='function')
  return {ok:false,reason:'invalid-local-route-proof'};
 const edge=(a,b)=>segmentThreatFree(regions,a,b)&&
  canTraverse(map,a.x,a.y,b.x,b.y)===true;
 if(dist(from,to)<.5)return {ok:true,points:[],length:0};
 if(edge(from,to))return {ok:true,points:[to],length:dist(from,to)};
 // No blind fallback to native smart_move when collision geometry is absent.
 const radius=Math.max(500,Math.min(1500,maxDetour));
 const bounds={x1:Math.min(from.x,to.x)-radius,y1:Math.min(from.y,to.y)-radius,
  x2:Math.max(from.x,to.x)+radius,y2:Math.max(from.y,to.y)+radius};
 const open=[{ix:0,iy:0,g:0,h:dist(from,to),parent:null}],best=new Map([['0:0',0]]);
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
   const route=mergePath(p),length=route.reduce((n,v,i)=>
    n+dist(i?route[i-1]:from,v),0);
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
   open.push({ix,iy,g,h:dist(target,to),parent:current});
  }
 }
 return {ok:false,reason:iterations>=maxNodes?'local-search-budget':'no-safe-local-corridor',
  expanded:iterations};
}
function departures(G,map){
 const data=G.maps[map],out=[];
 for(const door of data?.doors??[]){
  if(!Array.isArray(door)||door.length<7||door[7]||
    typeof door[4]!=='string'||!Number.isSafeInteger(door[5]??0)||
    !Number.isSafeInteger(door[6])||door[8]||
    !G.maps[door[4]]||G.maps[door[4]].instance||
    G.maps[door[4]].pvp)continue;
  const from=data.spawns?.[door[6]],to=G.maps[door[4]].spawns?.[door[5]??0];
  if(!Array.isArray(from)||!Array.isArray(to)||
    ![from[0],from[1],to[0],to[1]].every(finite))continue;
  out.push({via:'door',from:{map,x:from[0],y:from[1]},
    to:{map:door[4],x:to[0],y:to[1]},spawn:door[5]??0});
 }
 for(const npc of data.npcs??[]){
  if(npc?.id!=='transporter'||!Array.isArray(npc.position)||
    !npc.position.slice(0,2).every(finite))continue;
  for(const [dest,spawn] of Object.entries(G.npcs?.transporter?.places??{})){
   if(!Number.isSafeInteger(spawn)||!G.maps[dest]||
      G.maps[dest].instance||G.maps[dest].pvp)continue;
   const to=G.maps[dest].spawns?.[spawn];
   if(!Array.isArray(to)||![to[0],to[1]].every(finite))continue;
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
 step=90
}={}){
 const fail=(reason,extra={})=>({ok:false,reason,...extra});
 if(!point(start)||!point(goal)||!G?.maps?.[start.map]||
   !G.maps[goal.map]||typeof canTraverse!=='function')
  return fail('invalid-world-or-collision-provider');
 const denied=new Set(excludedMaps);
 const blocks=map=>denied.has(map)||!G.maps[map]||
   G.maps[map].ignore||G.maps[map].pvp||G.maps[map].instance;
 if(blocks(start.map)||blocks(goal.map))return fail('excluded-or-special-map');
 const regions=new Map(),lookup=map=>{
  if(!regions.has(map))regions.set(map,threatRegions(G,map,
   liveMonsters.filter(m=>m?.map===map)));
  return regions.get(map);
 };
 const walker=(map,from,to)=>findLocalSafePath(map,from,to,lookup(map),
  canTraverse,{step,maxNodes});
 const queue=[{position:start,steps:[],cost:0,hops:0,maps:[start.map]}];
 const seen=new Map();
 let states=0,bestResult=null;
 while(queue.length&&states++<maxStates){
  queue.sort((a,b)=>a.cost-b.cost);
  const s=queue.shift(),signature=key(s.position);
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
  const portals=departures(G,s.position.map);
  // Prioritize nearby portals, but preserve all visible transporter edges.
  portals.sort((a,b)=>dist(s.position,a.from)-dist(s.position,b.from));
  for(const portal of portals.slice(0,28)){
   if(blocks(portal.to.map)||s.maps.filter(x=>x===portal.to.map).length>=2)continue;
   const walk=walker(s.position.map,s.position,portal.from);
   if(!walk.ok)continue;
   // The portal endpoint itself is not always free of aggro. Entry
   // inside a static lethal field is refused before server transport.
   const arrival=lookup(portal.to.map);
   if(!segmentThreatFree(arrival,portal.to,portal.to))continue;
   const cost=s.cost+walk.length+300;
   const k=key(portal.to);if(cost>=(seen.get(k)??Infinity))continue;
   seen.set(k,cost);
   queue.push({position:portal.to,cost,hops:s.hops+1,
    maps:[...s.maps,portal.to.map],
    steps:[...s.steps,...walk.points.map(p=>({
     type:'move',map:p.map,x:p.x,y:p.y})),
     {type:'transport',via:portal.via,from:portal.from,
      map:portal.to.map,spawn:portal.spawn,x:portal.to.x,y:portal.to.y}]});
  }
 }
 return bestResult??fail(states>=maxStates?'world-search-budget':'no-certified-world-route',
  {visited:states});
}
