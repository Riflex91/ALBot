// W12/N12: a small native DIRECT Cave step toward the verified Priest.
// No generated-map graph, smart_move, teleport, neutral pull, or attack.
// A stale or incomplete run/roster/monster snapshot is never movement authority.
const caveDirectHex=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s);
const caveDirectFinite=n=>Number.isFinite(n);
const caveDirectSafeTime=n=>Number.isSafeInteger(n)&&n>0;
const caveDirectDeny=(reason,scope={})=>({
 version:1,mode:'cave-direct-cohesion',ready:false,canMove:false,
 canPull:false,canAttack:false,reason,...scope
});
export function caveDirectCohesionPreflight(bot,{
 now=Date.now(),hostChecks=true,forDispatch=false
}={}){
 const p=bot?.p,c=p?.c;
 if(!bot?.running||bot.me?.role!=='farmer'||c?.ctype!=='ranger'||
    c.rip===true||bot.cfg?.party?.enabled!==true||
    bot.cfg?.party?.waitForTeam!==true)
  return caveDirectDeny('eligible-live-ranger-required');
 if(bot.journal||bot.inventoryBlocked||bot.lifecycleChanging||
    bot.account?.rotationPending?.()||bot.bank?.pending||
    bot.logistics?.reserved||bot.logistics?.handoffActive||
    bot.gold?.reserved||bot.teamTravel?.blocked)
  return caveDirectDeny('value-or-lifecycle-action-blocked');
 const order=bot.movement?.order;
 if(order&&!(forDispatch&&order.owner==='cave'))
  return caveDirectDeny('another-movement-order');
 if(!forDispatch&&bot.movement?.nativeBusy?.())
  return caveDirectDeny('native-movement-in-progress');
 const cave=bot.cave?.status?.(),live=cave?.live;
 const lifecycle=bot.caveLifecycle?.status?.(),journal=lifecycle?.journal;
 if(!caveDirectSafeTime(now)||!live||!caveDirectHex(live.run)||
    !Number.isSafeInteger(live.floor)||live.floor<0||live.floor>7||
    live.map!==`zone_${live.run}_${live.floor}`||
    !caveDirectSafeTime(live.serverTime)||live.serverTime>now||
    now-live.serverTime>3000||live.paused!==false||
    cave.realm!==p.realm?.()||c?.map!==live.map||
    (c.in!==undefined&&c.in!==live.map)||c.cave?.run!==live.run)
  return caveDirectDeny('fresh-own-cave-instance-required');
 const scope={run:live.run,floor:live.floor,map:live.map};
 if(lifecycle?.state!=='live-observed'||journal?.phase!=='observed-run'||
    journal.name!==c.name||journal.realm!==cave.realm||
    journal.observed?.run!==live.run)
  return caveDirectDeny('durable-current-run-required',scope);
 const roster=live.roster,names=bot.farmers;
 if(!Array.isArray(roster)||roster.length!==3||
    !Array.isArray(names)||names.length!==3||
    new Set(names).size!==3||!names.includes(c.name)||
    new Set(roster.map(m=>m?.name)).size!==3||
    roster.some(m=>m?.left!==false||m.disconnected!==false||
      typeof m.name!=='string'||!names.includes(m.name)))
  return caveDirectDeny('complete-active-trio-required',scope);
 const members=[];
 for(const name of names){
  const m=name===c.name?c:bot.transport?.fresh?.(name);
  if(!m||m.name!==name||m.rip===true||
     !caveDirectFinite(m.x)||!caveDirectFinite(m.y)||
     !caveDirectFinite(m.hp)||!caveDirectFinite(m.max_hp)||m.max_hp<=0||
     m.hp/m.max_hp<.7||m.hp>m.max_hp||
     m.map!==live.map||(m.in!==undefined&&m.in!==live.map)||
     (name!==c.name&&(
      m.running!==true||m.realm!==cave.realm||
      !caveDirectSafeTime(m.received)||m.received>now||now-m.received>3000)))
   return caveDirectDeny('member-not-currently-safe',{...scope,member:name});
  members.push(m);
 }
 const priests=members.filter(m=>(m.ctype??m.class)==='priest');
 if(priests.length!==1||priests[0].name===c.name)
  return caveDirectDeny('verified-priest-required',scope);
 const priest=priests[0];
 if(members.some(m=>Math.hypot(m.x-priest.x,m.y-priest.y)>280))
  return caveDirectDeny('trio-too-far-to-stage-safely',scope);
 // A heartbeat alone is not sufficient movement authority: the healer
 // must also be directly visible at the same current instance coordinates.
 const visible=bot.entity?.(priest.name);
 if(!visible||visible.name!==priest.name||visible.visible!==true||
    visible.rip===true||visible.map!==live.map||
    (visible.in!==undefined&&visible.in!==live.map)||
    !caveDirectFinite(visible.x)||!caveDirectFinite(visible.y)||
    Math.hypot(visible.x-priest.x,visible.y-priest.y)>12)
  return caveDirectDeny('visible-priest-anchor-required',scope);
 if(!Array.isArray(bot.monsters?.()))
  return caveDirectDeny('complete-local-monster-list-required',scope);
 // A direct movement cannot evaluate unknown encounter geometry. Reject
 // EVERY visible live/unknown-health monster on this Cave floor, and any
 // monster targeting our trio regardless of its claimed map.
 const monsters=bot.monsters();
 if(monsters.some(m=>m&&(
    names.includes(m.target)||
    ((m.map===live.map||m.in===live.map)&&
     (m.dead!==true||!caveDirectFinite(m.hp)||m.hp>0)))))
  return caveDirectDeny('visible-cave-encounter-blocks-cohesion',scope);
 const d=Math.hypot(c.x-visible.x,c.y-visible.y);
 if(!caveDirectFinite(d)||d<=130||d>240)
  return caveDirectDeny('no-bounded-direct-step-required',scope);
 const step=Math.min(35,d-120);
 if(step<3)return caveDirectDeny('direct-step-too-small',scope);
 const x=c.x+(visible.x-c.x)*step/d;
 const y=c.y+(visible.y-c.y)*step/d;
 if(!caveDirectFinite(x)||!caveDirectFinite(y))return caveDirectDeny('invalid-direct-waypoint',scope);
 if(hostChecks){
  try{
   if(p.has?.('can_move_to')!==true||
      p.call('can_move_to',x,y)!==true)
    return caveDirectDeny('no-native-direct-clearance',scope);
  }catch{return caveDirectDeny('native-direct-clearance-unavailable',scope);}
 }
 return {...caveDirectDeny('bounded-direct-cohesion-ready',scope),
  ready:true,canMove:true,x,y,step,priest:priest.name,
  priestX:visible.x,priestY:visible.y};
}
export function createCaveDirectCohesion(bot,{now=()=>Date.now()}={}){
 let attempts=0,last=null;
 const proof=(hostChecks,forDispatch=false)=>
  caveDirectCohesionPreflight(bot,{now:now(),hostChecks,forDispatch});
 function status(options={}){
  const r=proof(false,options.forDispatch===true);
  return {...r,attempts,last};
 }
 function tick(){
  const first=proof(true);
  if(!first.ready)return false;
  // Re-observe the exact run, floor, healer and endpoint immediately before
  // native move dispatch. The movement controller independently verifies
  // same-map, direct native clearance, hop length and current ownership.
  const admit=()=>{
   const r=proof(true,true);
   return r.ready&&r.run===first.run&&r.floor===first.floor&&
    r.priest===first.priest&&
    r.priestX===first.priestX&&r.priestY===first.priestY&&
    r.x===first.x&&r.y===first.y;
  };
  const accepted=bot.movement?.local?.(
   first.x,first.y,'cave',admit)===true;
  if(accepted){
   attempts++;
   last={run:first.run,floor:first.floor,priest:first.priest,
    x:first.x,y:first.y,at:now()};
   bot.event?.('cave.cohesion.directRequested',last);
  }
  return accepted;
 }
 return {status,tick};
}
