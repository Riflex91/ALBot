import {planHazardItinerary,segmentThreatFree,threatRegions,segmentHazardEscape,farmEntryRegions,farmStagingPoint} from './hazard-itinerary.mjs';
import {assessCombat} from './risk.mjs';
import {combatMembers,compositionOptions} from './composition.mjs';
const htDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const htSame=(a,b)=>a?.map===b?.map&&(a?.in??a?.map)===(b?.in??b?.map);
const htRetryKey=d=>d.map+':'+Math.round(d.x)+':'+Math.round(d.y);
const htPoint=(map,p)=>({map,x:p.x,y:p.y});
export function createHazardTravel(bot){
 const {p,exec}=bot;
 let trip=null,lastReject='',lastRejectAt=0,lastPlanFailure=null;
 const diagnostic=(event,details)=>{
  const message=event+JSON.stringify(details);
  if(message!==lastReject||Date.now()-lastRejectAt>10000){
   lastReject=message;lastRejectAt=Date.now();bot.event?.(event,details);
  }
 };
 // Native can_move is the ONLY accepted arbitrary-map collision oracle.
 // can_move_to applies exclusively from the character's current position;
 // it cannot certify arbitrary future/cross-map segments.
 const traversable=(map,x,y,toX,toY)=>{
  if(!Number.isFinite(x)||!Number.isFinite(y)||
    !Number.isFinite(toX)||!Number.isFinite(toY))return false;
  if(p.has('can_move')){
   try{return p.call('can_move',{map,x,y,going_x:toX,going_y:toY,
    base:p.c.base})===true;}catch{return false;}
  }
  if(p.c.map===map&&htDistance(p.c,{x,y})<2&&p.has('can_move_to')){
   try{return p.call('can_move_to',toX,toY)===true;}catch{return false;}
  }
  return false;
 };
 function tripProof(s){
  if(!s||!bot.running||p.c.rip||!p.c.map||
    !p.G?.maps?.[p.c.map])return {ok:false,reason:'invalid-runtime-state'};
  const next=s.steps[s.index];
  if(!next)return {ok:true};
  const current=htPoint(p.c.map,p.c);
  if(next.type==='move'){
   if(!htSame(current,next)||!traversable(current.map,current.x,current.y,next.x,next.y))
    return {ok:false,reason:'direct-collision-changed'};
   let reg=threatRegions(p.G,current.map,bot.monsters?.()??[]);
   if(next.phase==='farm-entry'){
    if(!entryReady(s))return {ok:false,reason:'farm-entry-denied'};
    reg=farmEntryRegions(reg,s.farmPlan);
   }
   if(!segmentThreatFree(reg,current,htPoint(next.map,next))&&
      !(next.phase!=='farm-entry'&&segmentHazardEscape(reg,current,
        htPoint(next.map,next),s.origin,s.escapeTypes.filter(t=>escapeTypes(s.origin).includes(t)))))return {
    ok:false,reason:'hostile-route-segment-changed'};
   }else if(next.type==='transport'){
   if(p.c.map!==next.from.map||htDistance(p.c,next.from)>36||
      !p.G.maps?.[next.map]?.spawns?.[next.spawn])
    return {ok:false,reason:'portal-origin-unverified'};
   const src=p.G.maps[p.c.map];
   const source=next.from;
   const legalDoor=next.via==='door'&&src?.doors?.some(door=>
     door?.[4]===next.map&&(door[5]??0)===next.spawn&&
     !door[7]&&!door[8]&&Number.isSafeInteger(door[6])&&
     src.spawns?.[door[6]]&&
     htDistance({x:src.spawns[door[6]][0],y:src.spawns[door[6]][1]},
       source)<3);
   const legalTransport=next.via==='transporter'&&
     p.G.npcs?.transporter?.places?.[next.map]===next.spawn&&
     src?.npcs?.some(n=>n?.id==='transporter'&&
       Array.isArray(n.position)&&
       htDistance({x:n.position[0],y:n.position[1]},source)<3);
   if(!legalDoor&&!legalTransport)return {
     ok:false,reason:'portal-edge-revoked'};
   if(p.c.targets>5||p.c.c?.town||p.c.s?.dampened)
    return {ok:false,reason:'portal-server-conditions-blocked'};
   const reg=threatRegions(p.G,next.map,bot.monsters?.()??[]);
   if(!segmentThreatFree(reg,htPoint(next.map,next),htPoint(next.map,next)))
    return {ok:false,reason:'portal-arrival-hostile'};
  }
  return {ok:true};
 }
 const session=()=>trip;
 function failure(destination,reason){
  bot.teamPlan?.travelFailed?.(destination,reason);
 }
 function escapeTypes(origin){
  const reg=threatRegions(p.G,origin.map,bot.monsters?.()??[]);
  if(!reg.ok)return [];
  const touching=reg.rectangles.filter(r=>!segmentThreatFree({ok:true,
   rectangles:[r],circles:[]},origin,origin));
  const types=[...new Set(touching.map(r=>r.type))];
  if(types.length!==1)return [];
  const type=types[0],count=touching.reduce((n,r)=>n+r.count,0);
  return count<=12&&assessCombat(p.G.monsters[type],[p.c],
   bot.cfg.world.risk,count,{G:p.G,maxCombatSeconds:bot.cfg.farming.maxCombatSeconds}).safe?[type]:[];
 }
 function entryReady(s){
  const plan=bot.teamPlan?.heartbeat?.(),pinned=s.farmPlan;
  if(!pinned||!plan||plan.id!==pinned.id||
     bot.teamPlan.valid?.(plan)!==true||!htSame(p.c,plan)||
     htDistance(p.c,plan)>550)return false;
  const names=bot.cfg.party.enabled===false?[p.c.name]:bot.farmers??[];
  if(!names.length||!names.every(name=>{
   const h=name===p.c.name?{...p.c,running:bot.running,received:Date.now(),realm:p.realm()}:
    bot.transport?.fresh?.(name);
   return h?.running&&!h.rip&&h.realm===p.realm()&&htSame(p.c,h)&&
    Number.isFinite(h.received)&&Date.now()-h.received>=0&&Date.now()-h.received<4000&&
    htDistance(p.c,h)<=Math.min(300,bot.cfg.party.followDistance??180)&&
    h.hp/Math.max(1,h.max_hp)>=(bot.cfg.farming.pullHp??.75)&&
    !h.inventoryBlocked&&!h.journal;
  }))return false;
  const visible=(bot.monsters?.()??[]).filter(m=>m.hp>0&&!m.dead&&m.map===plan.map&&htDistance(m,plan)<550);
  if(visible.some(m=>m.target&&!names.includes(m.target)))return false;
  const count=p.G.maps[plan.map].monsters.filter(z=>z.type===plan.target&&
   z.boundary?.every((v,i)=>v===plan.bounds[i+1])).reduce((n,z)=>n+Math.max(1,z.count??1),0);
  return count>0&&count<=12&&bot.strategy?.safeTarget?.(plan.target,undefined,true,false)===true&&
   assessCombat(p.G.monsters[plan.target],combatMembers(bot,false),bot.cfg.world.risk,
    count,{...compositionOptions(bot,false),maxCombatSeconds:bot.cfg.farming.maxCombatSeconds}).safe;
 }
 function abort(reason,halt=true){
  const old=trip;trip=null;
  if(!old)return false;
  lastPlanFailure={key:htRetryKey(old.destination),until:Date.now()+6000,reason};
  exec.cancelResource('movement');
  if(halt){try{Promise.resolve(p.call('stop','move')).catch(()=>{});}catch{}}
  diagnostic('travel.hazardAborted',{id:old.id,owner:old.owner,reason,
   step:old.index,map:p.c.map});
  if(!['owner-stop','emergency-combat-preemption'].includes(reason))failure(old.destination,reason);
  return true;
 }
 function start(destination,owner){
  if(trip||!bot.running||!destination||!p.c||p.c.rip)return false;
  const retryKey=htRetryKey(destination);
  if(lastPlanFailure?.key===retryKey&&Date.now()<lastPlanFailure.until){
   bot.reason='Navigation: sicherer Routenversuch wartet auf neue Prüfung';
   return false;
  }
  const c=p.c,source={map:c.map,x:c.x,y:c.y};
  let goal={map:destination.map,x:destination.x,y:destination.y};
  const farmPlan=bot.teamPlan?.heartbeat?.();
  const terminal=['farm','follow'].includes(owner)&&farmPlan&&
   bot.teamPlan?.valid?.(farmPlan)===true&&farmPlan.map===goal.map&&
   htDistance(farmPlan,goal)<30?{...farmPlan}:null;
  let stage=null;
  const targetRegions=threatRegions(p.G,goal.map,bot.monsters?.()??[]);
  if(terminal&&!segmentThreatFree(targetRegions,goal,goal)){
   stage=farmStagingPoint(targetRegions,terminal,traversable);
   if(!stage){bot.reason='Kein sicherer Farmsammelpunkt';
    failure(destination,'no-farm-staging');return false;}
   goal=stage;
  }
  const escape=escapeTypes(source);
  const plans=planHazardItinerary(p.G,source,goal,traversable,{
   liveMonsters:bot.monsters?.()??[],
   excludedMaps:bot.cfg?.world?.excludedMaps??[],
   maxStates:54,maxHops:5,maxNodes:1300,step:90,escapeTypes:escape
  });
  if(!plans.ok){
   diagnostic('travel.hazardPlanRejected',{owner,from:c.map,to:goal.map,
    reason:plans.reason,visited:plans.visited??null});
   bot.reason='Sichere Route fehlt: '+plans.reason;
   lastPlanFailure={key:retryKey,until:Date.now()+10000,
    reason:plans.reason};
   failure(destination,plans.reason);
   return false;
  }
  trip={id:bot.session+':safe-trip:'+Date.now(),owner,
   destination:{...destination},steps:[...plans.steps,...(stage?[{
    type:'move',phase:'farm-entry',map:destination.map,x:destination.x,y:destination.y}]:[])],
   origin:source,escapeTypes:escape,farmPlan:terminal,
   index:0,startingMap:c.map,created:Date.now(),
   lastProgress:Date.now(),last:source,maps:plans.maps};
  bot.event?.('travel.hazardPlanned',{id:trip.id,owner,from:c.map,to:goal.map,
   maps:plans.maps.join('>'),segments:plans.steps.length,
   portals:plans.portalCount,source:'geometry+aggro'});
  return true;
 }
 function poll(){
  const s=trip;if(!s)return false;
  if(Date.now()-s.created>180000||Date.now()-s.lastProgress>20000){
   abort('bounded-travel-timeout');return true;
  }
  if(s.index>=s.steps.length){
   if(htSame(p.c,s.destination)&&htDistance(p.c,s.destination)<=
      Math.max(12,s.destination.radius??20)){
    trip=null;bot.event?.('travel.hazardArrived',{
     id:s.id,owner:s.owner,map:p.c.map});
   }else abort('destination-not-server-verified',false);
   return true;
  }
  const step=s.steps[s.index];
  const observed=step.type==='move'?
   p.c.map===step.map&&htDistance(p.c,step)<=Math.max(5,Math.min(15,(s.destination.radius??15)/2)):
   p.c.map===step.map&&
   (p.c.in??p.c.map)===(step.toIn??step.map)&&htDistance(p.c,step)<=90;
  if(observed&&!exec.pending?.has('travel.hazard')){
   s.index++;s.lastProgress=Date.now();s.last=htPoint(p.c.map,p.c);
   bot.event?.('travel.hazardStepConfirmed',{id:s.id,index:s.index,
    type:step.type,map:p.c.map});
   return true;
  }
  if(step.phase==='farm-entry'&&!entryReady(s)){
   bot.reason='Sammelpunkt: Gruppenfreigabe fehlt';
   return true;
  }
  // Monster motion can invalidate a step AFTER native move was dispatched:
  // interrupt immediately rather than waiting for the next waypoint.
  if(exec.pending?.has('travel.hazard')&&step.type==='move'){
   const proof=tripProof(s);
   if(!proof.ok){abort('inflight-'+proof.reason);return true;}
  }
  if(exec.busy('movement')||exec.pending?.has('travel.hazard'))return true;
  const result=tripProof(s);
  if(!result.ok){
   abort(result.reason);return true;
  }
  const admitted=()=>trip===s&&s.index<s.steps.length&&
   bot.running&&!p.c.rip&&!p.c.stand&&!exec.busy('stand')&&
   tripProof(s).ok===true;
  // Movement and portals share the same movement resource. Executor rechecks the
  // native collision and live threat proof immediately before dispatch.
  const accepted=exec.run('travel.hazard',['movement'],admitted,
   ()=>step.type==='move'?p.call('move',step.x,step.y):
    p.call('transport',step.map,step.spawn),{
    priority:700,timeout:step.type==='move'?25000:22000,
    delay:step.type==='transport'?1200:150,waitForObservation:true,
    observe:()=>trip===s&&(
     step.type==='move'?p.c.map===step.map&&htDistance(p.c,step)<=12:
     p.c.map===step.map&&(p.c.in??p.c.map)===(step.toIn??step.map)&&
      htDistance(p.c,step)<=90),
    onSettle(result,error){
     if(trip!==s)return;
     if(result==='confirmed'){
      s.index++;s.lastProgress=Date.now();s.last=htPoint(p.c.map,p.c);
      bot.event?.('travel.hazardStepConfirmed',{id:s.id,index:s.index,
       type:step.type,map:p.c.map});
     }else if(result!=='cancelled'){
      abort('server-step-'+result+':'+String(error?.reason??''),true);
     }
    }
   });
  if(!accepted)diagnostic('travel.hazardDispatchDeferred',{
   id:s.id,step:s.index,type:step.type,map:p.c.map});
  return true;
 }
 return {start,poll,abort,session,traversable,
  get active(){return !!trip;},
  get order(){return trip?{id:trip.id,owner:trip.owner,
   dest:trip.destination,mode:'hazard-itinerary'}:null;},
  matches:(goal,owner)=>!!trip&&trip.owner===owner&&
   htSame(goal,trip.destination)&&htDistance(goal,trip.destination)<30};
}
