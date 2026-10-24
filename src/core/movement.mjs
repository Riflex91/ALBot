import {travelBlinkEligible,blinkLandingPoint} from '../combat/travel-blink.mjs';
import {arrived,samePlace,distance,xy} from './policy.mjs';
import {farmerTransitAdmission,pratCorridorGuardRequired} from '../world/farmer-transit-admission.mjs';
export function transientMovementInterruption(error){
 const code=String(error?.reason??error?.message??error??'').toLowerCase();
 return code==='interrupted'||code==='cancelled'||code==='canceled'||code==='superseded';
}
// Respect the caller's accepted arrival radius even during a native
// movement animation. This prevents repeated identical follow requests.
export function reachedMovementRadius(character,destination){
 return !!destination&&Number.isFinite(destination.radius)&&
   samePlace(character,destination)&&distance(character,destination)<=destination.radius;
}
// Owner-scoped fast travel: approved farm destinations and live follower
// routes may use the same measured Town shortcut as quest trips. Combat,
// emergency positioning, local scouting and cave evacuation never do.
export function townShortcutOwnerAllowed(role,owner,townTravel=true){
 return role==='merchant'?townTravel!==false:
  role==='farmer'&&['quest','quest-escort','farm','follow','regroup'].includes(owner);
}
export function townShortcutRetryReady(now,lastSuccess,lastAttempt){
 return Number.isFinite(now)&&
  now-lastSuccess>=30000&&now-lastAttempt>=4000;
}
export function townChannelTeamThreat(character,monsters=[],team=[]){
 if(!character||!Array.isArray(monsters)||!Array.isArray(team))return true;
 return monsters.some(m=>{
  if(!m||m.dead===true||m.hp===0||typeof m.target!=='string'||
     m.target!==character.name&&!team.includes(m.target))return false;
  // No authoritative location/health data is NOT proof of a safe channel.
  if(!m.map||!Number.isFinite(xy(m).x)||!Number.isFinite(xy(m).y))
   return true;
  return samePlace(character,m)&&distance(character,m)<350;
 });
}
export function createMovement(bot){
  const {p,exec}=bot;let order=null,blockedUntil=0,townMs=5000,lastTown=0,lastTownAttempt=0,townQueued=false,moveSeq=0,questTownRetry=null;
  // Only native smart-route failures quarantine a destination map, not normal
  // travel stops or a rejected non-movement action. Keep the cache bounded.
  const failedRoutes=new Map(),routeCooldownMs=300000;
   let lastTransitDeny='',lastTransitDenyAt=0;
   const independentCaveOwner=owner=>['scout','cave','cave-evade','cave-priest'].includes(owner);
   function farmerRouteSafety(destination,owner){
     if(bot.me?.role!=='farmer'||independentCaveOwner(owner)||
        !pratCorridorGuardRequired(p.G))
      return {allowed:true,reason:'other-movement-controller'};
     return farmerTransitAdmission(p.c,destination,p.G,{
       canMove:(x,y)=>p.has?.('can_move_to')===true&&
         p.call('can_move_to',x,y)===true,
       liveMonsters:bot.monsters?.()??[],
       excludedMaps:bot.cfg?.world?.excludedMaps??[]
     });
   }
   function reportTransitDeny(owner,dest,admission,stopped=false){
     const key=owner+':'+dest?.map+':'+admission.reason+':'+admission.hazard;
     if(key!==lastTransitDeny||Date.now()-lastTransitDenyAt>10000){
       lastTransitDeny=key;lastTransitDenyAt=Date.now();
       bot.event?.(stopped?'movement.farmerTransitStopped':'movement.farmerTransitRejected',{
         owner,map:dest?.map??null,reason:admission.reason,
         hazard:admission.hazard??null,
         mode:'fail-closed-physical-segment'
       });
     }
     bot.reason='Unsicherer Reiseweg gesperrt: '+admission.reason;
   }
  const routeKey=dest=>dest.map+':'+Math.round(dest.x)+':'+Math.round(dest.y);
  function recordRouteFailure(owner,mode,dest,reason){
    if(!['economy','farm'].includes(owner)||mode!=='smart_move'||typeof dest?.map!=='string'||!Number.isFinite(dest.x)||!Number.isFinite(dest.y))return;
    failedRoutes.set(owner+':'+routeKey(dest),{owner,map:dest.map,x:dest.x,y:dest.y,at:Date.now(),reason});
    if(failedRoutes.size>24)failedRoutes.delete(failedRoutes.keys().next().value);
    bot.event?.('movement.route-quarantined',{owner,mode,map:dest.map,x:dest.x,y:dest.y,retryAfter:Date.now()+routeCooldownMs,reason:'Nur Zielpunkt gesperrt: '+reason});
  }
  function failedRecently(dest,owner='economy'){
    if(!['economy','farm'].includes(owner)||typeof dest?.map!=='string')return false;
    // An unreachable shoreline coordinate must not disable all work on main.
    // Queries with only a map remain supported for status/legacy diagnostics.
    for(const [key,entry] of failedRoutes){
      if(Date.now()-entry.at>=routeCooldownMs){failedRoutes.delete(key);continue;}
      if(entry.owner===owner&&entry.map===dest.map&&(!Number.isFinite(dest.x)||!Number.isFinite(dest.y)||Math.hypot(dest.x-entry.x,dest.y-entry.y)<10))return true;
    }
    return false;
  }
  // On headless clients the native smart path search can live in parent,
  // even while character.moving is false and root.smart is absent.
  const smartActive=()=>[p.root?.smart,p.parent?.smart].some(s=>s?.moving||s?.searching);
  // Native movement can be active even without a local ALBot order.
  const nativeBusy=()=>!!p.c?.moving||smartActive();
  const stop=()=>{if(order)bot.event?.('movement.terminal',{
    id:order.id,owner:order.owner,mode:order.mode??null,map:order.dest.map,
    outcome:order.terminal??'cancelled'});
   if(townQueued||p.c?.c?.town){try{Promise.resolve(p.call('stop','town')).catch(()=>{});}catch{}}townQueued=false;if(order||smartActive()||p.c?.moving){try{Promise.resolve(p.call('stop','move')).catch(()=>{});}catch{}}order=null;exec.cancelResource('movement');};
  function go(d,owner,scoutAdmission=null){
    if(!bot.running||Date.now()<blockedUntil||!d||!Number.isFinite(d.x)||!Number.isFinite(d.y))return false;
    // An active Monsterhunt visit has exclusive ordinary travel ownership.
    // Only its own route or urgent combat/kiting may preempt it; in particular
    // a follower tick cannot replace Daisy's route after a Town teleport.
    if(bot.me?.role==='farmer'&&bot.strategy?.busy&&
       !['quest','combat','kite'].includes(owner))return false;
    // N05's native movement must carry an explicit, re-evaluated admission
    // from the owning scout. A generic direct go('scout') has no authority.
    if(['scout','cave','cave-evade','cave-priest'].includes(owner)&&
       (typeof scoutAdmission!=='function'||nativeBusy()))return false;
    if(bot.cfg?.world?.excludedMaps.includes(d.map)||p.G.maps[d.map]?.pvp&&!bot.cfg?.farming?.pvp)return false;
     // Gate farm/follow/quest/regroup/combat: no native BFS through
     // a corridor for which physical monster safety was not proven.
     const travelProof=farmerRouteSafety(d,owner);
     if(!travelProof.allowed){reportTransitDeny(owner,d,travelProof);return false;}
    // A local N05 scout is a direct step, never general smart navigation.
    // Even an unexpected direct call cannot widen its map or travel budget.
    if(['scout','cave','cave-evade','cave-priest'].includes(owner)&&(!samePlace(p.c,d)||
       !Number.isFinite(p.c.x)||!Number.isFinite(p.c.y)||
       distance(p.c,d)>(owner==='scout'?95:45)||distance(p.c,d)<1||
       owner!=='scout'&&!/^zone_[a-f0-9]{24}_[0-7]$/.test(p.c.map)))
      return false;
    if(!order&&reachedMovementRadius(p.c,{...d,radius:d.radius??20}))return true;
    if(order||townQueued||exec.pending.has('travel.town'))return false;
    if(bot.lootDeparture?.beforeDeparture(d,owner)===false)return false;
    // An asynchronous open_stand may not yet be reflected in character.stand.
    // Never initiate a route while opening/closing the stand is pending.
    if(bot.me?.role==='merchant'&&exec.busy('stand'))return false;
    if(p.c.stand){exec.run('stand.close',['stand'],()=>bot.running&&!!p.c.stand,()=>p.call('close_stand'),{delay:1000});return false;}
    const dest={...d,radius:d.radius??20};
    // Reject a previously failed economy waypoint BEFORE requesting another
    // native smart route; otherwise the same inaccessible NPC/office can
    // trigger repeated route failures every three seconds.
    if(failedRecently(dest,owner)){
      bot.reason='Wegpunkt nach Smart-Move-Fehler vorübergehend gesperrt';
      return false;
    }
    // Smart movement can enter public maps; never attempt somebody else's instance.
    if(!samePlace(p.c,d)&&p.G.maps[d.map]?.instance){bot.reason='Zielinstanz nicht erreichbar';return false;}
    const crossQuest=owner==='quest'&&bot.me?.role==='farmer'&&
      p.c.map!=='main'&&d.map==='main'&&!p.G.maps?.[p.c.map]?.instance;
    const mainSpawn=p.G.maps?.main?.spawns?.[0];
    // Only public native doors into main provide a measured walk alternative.
    // Cross-map destinations without a verified direct portal stay on smart_move.
    const portalOptions=crossQuest?(p.G.maps[p.c.map]?.doors??[])
      .filter(door=>Array.isArray(door)&&door[4]==='main'&&
       Number.isFinite(door[0])&&Number.isFinite(door[1])&&
       Number.isSafeInteger(door[5])&&
       Array.isArray(p.G.maps.main?.spawns?.[door[5]]))
      .map(door=>({exit:door,entrance:p.G.maps.main.spawns[door[5]]})):[];
    const spawn=crossQuest?mainSpawn:p.G.maps[p.c.map]?.spawns?.[0];
    // A bank trip starts on main but ends on the bank map. Previously the
    // samePlace restriction suppressed the town shortcut precisely for
    // these journeys, making a merchant walk back from remote farms.
    const crossBank=p.c.map==='main'&&d.map==='bank';
    // Time the actual route for authorized farm/quest/group movement as
    // well as merchant work, but never interrupt emergency combat travel.
    const merchantTown=bot.me?.role==='merchant'&&bot.cfg.merchant?.townTravel!==false;
    const mayTown=townShortcutOwnerAllowed(bot.me?.role,owner,
     bot.cfg.merchant?.townTravel);
    const safeTown=()=>!townChannelTeamThreat(p.c,bot.monsters(),bot.teamNames??[]);
    const nowTown=Date.now(),townKey=routeKey(dest);
    // Retain measured fast-travel preference after a transient quest failure.
    // A failed cast gets at most two additional safe attempts in 30 seconds.
    const retryKnown=owner==='quest'&&questTownRetry?.key===townKey&&
     nowTown-questTownRetry.at<=30000;
    const questRetry=retryKnown&&questTownRetry.attempts<3;
    const questRetryExhausted=retryKnown&&questTownRetry.attempts>=3;
    if(mayTown&&
       (samePlace(p.c,d)||merchantTown&&crossBank||
         crossQuest&&portalOptions.length>0)&&Array.isArray(spawn)&&
       p.has('town')&&!p.c.c?.town&&
       !questRetryExhausted&&
       (townShortcutRetryReady(nowTown,lastTown,lastTownAttempt)||questRetry)&&
       safeTown()){
     const speed=Math.max(1,p.c.speed??40),toSpawn=Math.hypot(
       xy(p.c).x-spawn[0],xy(p.c).y-spawn[1])/speed*1000;
     // For bank use the same estimated final portal leg in both routes;
     // it cancels from the savings comparison instead of pretending bank
     // has coordinates directly comparable to main-map coordinates.
     const tail=crossBank?6000:Math.hypot(spawn[0]-d.x,spawn[1]-d.y)/speed*1000;
     const walk=crossQuest?Math.min(...portalOptions.map(({exit,entrance})=>
      (Math.hypot(xy(p.c).x-exit[0],xy(p.c).y-exit[1])+
       Math.hypot(entrance[0]-d.x,entrance[1]-d.y))/speed*1000)):
      crossBank?toSpawn+tail:distance(p.c,d)/speed*1000;
     const town=townMs+tail;
     bot.event?.('travel.compare',{owner,walkMs:Math.round(walk),
       townMs:Math.round(town),savedMs:Math.round(walk-town),
       threshold:bot.cfg.merchant?.townMinSavingsMs??3000,
       reason:crossBank?'Town-Kanal vor Bankportal gegen Rückweg zu Fuß':
        crossQuest?'Verifizierter Portalweg gegen Town und Restweg':
         'Town-Kanal plus Restweg gegen direkten Laufweg'});
     if(walk-town>(bot.cfg.merchant?.townMinSavingsMs??3000)){
      if(questRetry&&nowTown<questTownRetry.nextAt){
       bot.reason='Monsterhunt: schneller Town-Retry steht bevor';return false;
      }
      let at=0;const origin=p.c.map;townQueued=true;
      const accepted=exec.run('travel.town',['movement'],
       ()=>bot.running&&!p.c.rip&&safeTown(),
       ()=>{at=Date.now();lastTownAttempt=at;if(p.c.moving||smartActive())
         p.call('stop','move');bot.event?.('travel.town',{owner,map:origin,
           reason:crossBank?'Bankportal per Town-Kanal schneller':
             'Town spart Reisezeit; laufenden Weg vor Kanal beenden'});
         return p.call('town');},
       {priority:['logistics','gold'].includes(owner)?850:400,timeout:15000,
        delay:owner==='quest'?4000:30000,waitForObservation:true,
        observe:()=>p.c.map===(crossQuest?'main':origin)&&!p.c.c?.town&&
          Math.hypot(xy(p.c).x-spawn[0],xy(p.c).y-spawn[1])<60,
        onSettle(result){townQueued=false;
          if(result==='confirmed'){
           lastTown=Date.now();questTownRetry=null;
           townMs=(townMs+lastTown-at)/2;
          }else{
           if(owner==='quest'){
            const attempts=(questTownRetry?.key===townKey?questTownRetry.attempts:0)+1;
            questTownRetry={key:townKey,attempts,at:Date.now(),
             nextAt:Date.now()+4000};
           }
           bot.event?.('travel.townRetry',{owner,result,
            attempt:questTownRetry?.attempts??null,
            reason:'Begrenzter Quest-Teleport-Retry vor Smart-Move'});
          }
         }});
      if(!accepted)townQueued=false;return false;
     }
    }
    const started=Date.now();order={id:bot.session+':move:'+(++moveSeq),dest,owner,started,progress:started,last:xy(p.c),map:p.c.map,origin:p.c.map};const token=order;
    const local=samePlace(p.c,d)&&p.has('can_move_to')&&p.call('can_move_to',d.x,d.y);
     if(bot.me?.role==='farmer'&&pratCorridorGuardRequired(p.G)&&
        !independentCaveOwner(owner)&&!local){
       order=null;
       reportTransitDeny(owner,dest,{reason:'direct-native-move-no-longer-verified'});
       return false;
     }
    // Geometry can change between scout admission and actual movement.
    // A failed last local check must NEVER turn a scout hop into smart_move.
    if(['scout','cave','cave-evade','cave-priest'].includes(owner)&&!local){order=null;return false;}
    const blink=!['scout','cave','cave-evade','cave-priest'].includes(owner)&&local&&travelBlinkEligible(bot,d,owner),
     landing=blink?blinkLandingPoint(d):null;
    if(blink)token.dest={...dest,x:landing.x,y:landing.y,radius:Math.max(8,dest.radius)};
    token.mode=blink?'blink':local?'move':'smart_move';
    const boundedDirectDispatchSafe=()=>{
      if(order!==token||token.mode!=='move'||nativeBusy()||!samePlace(p.c,d)||
         !Number.isFinite(p.c.x)||!Number.isFinite(p.c.y)||
         distance(p.c,d)>(owner==='scout'?95:45)||distance(p.c,d)<1||
         owner!=='scout'&&!/^zone_[a-f0-9]{24}_[0-7]$/.test(p.c.map)||
         !p.has('can_move_to')||p.call('can_move_to',d.x,d.y)!==true)return false;
      try{return scoutAdmission()===true;}catch{return false;}
    };
    const accepted=exec.run('move',['movement',...(blink?['mana']:[])],
     ()=>bot.running&&!p.c.rip&&!p.c.stand&&!exec.busy('stand')&&
      farmerRouteSafety(d,owner).allowed&&
      (!blink||travelBlinkEligible(bot,d,owner))&&
      (!['scout','cave','cave-evade','cave-priest'].includes(owner)||boundedDirectDispatchSafe()),()=>blink?p.call('use_skill','blink',[landing.x,landing.y]):p.call(token.mode,...(local?[d.x,d.y]:[{map:d.map,x:d.x,y:d.y}])),{priority:owner==='kite'?1100:owner==='cave-evade'?1000:owner==='cave-priest'?900:['logistics','gold'].includes(owner)?850:400,timeout:120000,delay:500,onSettle(state,error){if(order!==token)return;
    if(error?.transient==='interrupted'){
     order=null;bot.event?.('movement.terminal',{id:token.id,owner,mode:token.mode,map:dest.map,outcome:'interrupted'});bot.event?.('movement.interrupted',{owner,mode:token.mode,map:dest.map,
      reason:'Native smart route was cancelled externally; safe retry'});return;
    }
    if(state==='rejected'||state==='timeout'||state==='superseded'){
 const reason=error?.reason??error?.message??state;
 if(transientMovementInterruption(reason)||state==='superseded'){
  // Native smart_move rejects with 'interrupted' when an ordinary travel
  // handoff cancels it. The destination remains reachable; retry normally.
  order=null;bot.event?.('movement.terminal',{id:token.id,owner,mode:token.mode,map:dest.map,outcome:'interrupted'});bot.event?.('movement.interrupted',{owner,mode:token.mode,map:dest.map,reason});return;
 }
 recordRouteFailure(owner,token.mode,dest,reason);token.terminal='failed';stop();blockedUntil=Date.now()+3000;
 bot.reason='Weg fehlgeschlagen; neuer Versuch in 3 Sekunden';bot.event?.('movement.failed',{owner,mode:token.mode,map:dest.map,x:dest.x,y:dest.y,reason});}}});
    if(accepted)bot.event?.('movement.request',{id:token.id,owner,mode:token.mode,map:dest.map,x:dest.x,y:dest.y,radius:dest.radius});
    if(!accepted)order=null;return false;
  }
  function poll(){
     if(!order){
       // A native route without an ALBot owner can persist across reloads.
       // The actual physical path cannot be audited: halt it.
       if(bot.me?.role==='farmer'&&pratCorridorGuardRequired(p.G)&&
          nativeBusy()&&!townQueued&&!p.c?.c?.town){
         bot.event?.('movement.farmerOrphanRouteStopped',{
           reason:'native-movement-without-owned-route'});
         stop();
       }
       return;
     }
     const proof=farmerRouteSafety(order.dest,order.owner);
     if(bot.me?.role==='farmer'&&pratCorridorGuardRequired(p.G)&&
        !independentCaveOwner(order.owner)&&
        order.mode==='smart_move'){
       const previous=order;
       previous.terminal='unsafe-native-smart-route';
       stop();
       reportTransitDeny(previous.owner,previous.dest,{
         reason:'native-smart-route-not-certifiable'},true);
       return;
     }
     if(!proof.allowed){
       const previous=order;
       previous.terminal='unsafe-transit';
       stop();
       reportTransitDeny(previous.owner,previous.dest,proof,true);
       return;
     }
     const now=Date.now();if(samePlace(p.c,order.dest)&&distance(p.c,order.dest)<=order.dest.radius){bot.observations?.travel(order.origin,p.c.map,now-order.started);bot.event?.('movement.arrived',{id:order.id,owner:order.owner,map:p.c.map,x:xy(p.c).x,y:xy(p.c).y});order.terminal='arrived';stop();return;}if(p.c.map!==order.map||distance(p.c,order.last)>3){order.progress=now;order.last=xy(p.c);order.map=p.c.map;}
    // Native smart_move may spend >12 s on path search before coordinates
    // change; retain its ownership until the bounded 120 s deadline.
    const timedOut=now-order.started>120000;
    if(timedOut||(order.mode!=='smart_move'&&now-order.progress>12000)){
      const failed=order;const reason=timedOut?'timeout':'no_progress';recordRouteFailure(failed.owner,failed.mode,failed.dest,reason);failed.terminal='failed';stop();blockedUntil=now+10000;
      bot.reason=timedOut?'Wegzeit überschritten; neuer Versuch in 10 Sekunden':'Weg ohne Fortschritt; neuer Versuch in 10 Sekunden';
      bot.event?.('movement.failed',{owner:failed.owner,mode:failed.mode,map:failed.dest.map,x:failed.dest.x,y:failed.dest.y,reason:timedOut?'timeout':'no_progress'});
    }
  }
  return {go,poll,stop,failedRecently,nativeBusy,get townActive(){return townQueued||!!p.c.c?.town||exec.pending.has('travel.town');},get order(){return order;},status:()=>order?{owner:order.owner,mode:order.mode,destination:{...order.dest},started:order.started}:null,
    local(x,y,owner,scoutAdmission=null){
      if(order&&order.owner!==owner)return false;
      if(!p.call('can_move_to',x,y))return false;
      const prior=order,accepted=go({
        map:p.c.map,in:p.c.in??p.c.map,x,y,radius:8},owner,scoutAdmission);
      // Generic go() historically returns false even on accepted travel.
      // N05 MUST verify it actually owns a native route before consuming
      // the one-use scout proof or reporting a dispatched movement.
      return ['scout','cave','cave-evade','cave-priest'].includes(owner)?
        order!==prior&&order?.owner===owner&&order.mode==='move'&&
        order.dest.x===x&&order.dest.y===y:accepted;
    },
    farmLocation(type){const candidates=[];for(const [map,data] of Object.entries(p.G.maps)){if(data.ignore||data.instance||data.pvp)continue;for(const pack of data.monsters??[]){if(pack.type!==type)continue;const ranges=pack.boundaries??(pack.boundary?[[map,...pack.boundary]]:[]);for(const [m,x1,y1,x2,y2] of ranges)candidates.push({map:m,in:m,x:(x1+x2)/2,y:(y1+y2)/2,radius:45});}}return candidates.sort((a,b)=>(a.map===p.c.map?-100000:0)+distance(p.c,a)-((b.map===p.c.map?-100000:0)+distance(p.c,b)))[0];}
  };
}
