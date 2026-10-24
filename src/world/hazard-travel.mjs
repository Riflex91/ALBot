import {planHazardItinerary,segmentThreatFree,threatRegions} from './hazard-itinerary.mjs';
const htDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const htSame=(a,b)=>a?.map===b?.map&&(a?.in??a?.map)===(b?.in??b?.map);
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
   const reg=threatRegions(p.G,current.map,bot.monsters?.()??[]);
   if(!segmentThreatFree(reg,current,htPoint(next.map,next)))return {
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
 function abort(reason,halt=true){
  const old=trip;trip=null;
  if(!old)return false;
  lastPlanFailure={key:old.destination.map+':'+Math.round(old.destination.x)+':'+
    Math.round(old.destination.y),until:Date.now()+6000,reason};
  exec.cancelResource('movement');
  if(halt){try{Promise.resolve(p.call('stop','move')).catch(()=>{});}catch{}}
  diagnostic('travel.hazardAborted',{id:old.id,owner:old.owner,reason,
   step:old.index,map:p.c.map});
  return true;
 }
 function start(destination,owner){
  if(trip||!bot.running||!destination||!p.c||p.c.rip)return false;
  const retryKey=destination.map+':'+Math.round(destination.x)+':'+
   Math.round(destination.y);
  if(lastPlanFailure?.key===retryKey&&Date.now()<lastPlanFailure.until){
   bot.reason='Navigation: sicherer Routenversuch wartet auf neue Prüfung';
   return false;
  }
  const c=p.c,source={map:c.map,x:c.x,y:c.y};
  const goal={map:destination.map,x:destination.x,y:destination.y};
  const plans=planHazardItinerary(p.G,source,goal,traversable,{
   liveMonsters:bot.monsters?.()??[],
   excludedMaps:bot.cfg?.world?.excludedMaps??[],
   maxStates:54,maxHops:5,maxNodes:1300,step:90
  });
  if(!plans.ok){
   diagnostic('travel.hazardPlanRejected',{owner,from:c.map,to:goal.map,
    reason:plans.reason,visited:plans.visited??null});
   bot.reason='Gefahrensichere Route nicht belegbar: '+plans.reason;
   lastPlanFailure={key:retryKey,until:Date.now()+10000,
    reason:plans.reason};
   return false;
  }
  trip={id:bot.session+':safe-trip:'+Date.now(),owner,
   destination:{...destination},steps:plans.steps,
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
  // Monster motion can invalidate a step AFTER native move was dispatched:
  // interrupt immediately rather than waiting for the next waypoint.
  if(exec.pending?.has('travel.hazard')&&step.type==='move'){
   const proof=tripProof(s);
   if(!proof.ok){abort('inflight-'+proof.reason);return true;}
  }
  if(exec.busy('movement')||exec.pending?.has('travel.hazard'))return true;
  if(!tripProof(s).ok){
   const result=tripProof(s);
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
    delay:150,waitForObservation:true,
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
