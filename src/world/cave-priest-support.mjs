// W12/N12: one bounded DIRECT Priest support-range correction while a
// single melee mob is already engaged on a Ranger. Not an escape mesh,
// pull, combat skill, or permission to traverse generated Cave geometry.
const caveSupportFinite=n=>Number.isFinite(n);
const caveSupportClock=n=>Number.isSafeInteger(n)&&n>0;
const caveSupportRun=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s);
const caveSupportDeny=(reason,extra={})=>({
 version:1,mode:'cave-priest-support-step',ready:false,canMove:false,
 canAttack:false,canPull:false,canCast:false,reason,...extra
});
export function cavePriestSupportPreflight(bot,{
 now=Date.now(),hostChecks=true,forDispatch=false
}={}){
 const p=bot?.p,c=p?.c;
 if(!bot?.running||bot.me?.role!=='farmer'||c?.ctype!=='priest'||
    c.rip===true||bot.cfg?.party?.enabled!==true||
    bot.cfg?.party?.healing!==true||
    bot.cfg?.party?.waitForTeam!==true)
  return caveSupportDeny('eligible-active-priest-required');
 if(bot.journal||bot.inventoryBlocked||bot.lifecycleChanging||
    bot.account?.rotationPending?.()||bot.bank?.pending||
    bot.logistics?.reserved||bot.logistics?.handoffActive||
    bot.gold?.reserved||bot.teamTravel?.blocked||bot.strategy?.busy||
    bot.exec?.pending?.has?.('cave.priest.heal'))
  return caveSupportDeny('healing-or-value-action-pending');
 const order=bot.movement?.order;
 if(order&&!(forDispatch&&order.owner==='cave-priest'))
  return caveSupportDeny('other-movement-owner-active');
 if(!forDispatch&&bot.movement?.nativeBusy?.())
  return caveSupportDeny('native-movement-in-progress');
 const cave=bot.cave?.status?.(),live=cave?.live;
 const state=bot.caveLifecycle?.status?.(),j=state?.journal;
 if(!caveSupportClock(now)||!live||!caveSupportRun(live.run)||
    !Number.isSafeInteger(live.floor)||live.floor<0||live.floor>7||
    live.map!==`zone_${live.run}_${live.floor}`||
    !caveSupportClock(live.serverTime)||live.serverTime>now||
    now-live.serverTime>3000||live.paused!==false||
    cave.realm!==p.realm?.()||c?.map!==live.map||
    (c.in!==undefined&&c.in!==live.map)||c.cave?.run!==live.run)
  return caveSupportDeny('fresh-own-cave-required');
 const scope={run:live.run,floor:live.floor,map:live.map};
 if(state?.state!=='live-observed'||j?.phase!=='observed-run'||
    j.name!==c.name||j.realm!==cave.realm||
    j.observed?.run!==live.run)
  return caveSupportDeny('durable-run-proof-required',scope);
 const team=bot.caveTeam?.healStatus?.(),names=team?.members;
 if(team?.ready!==true||team.run!==live.run||
    team.floor!==live.floor||team.map!==live.map||
    team.priest!==c.name||!Array.isArray(names)||names.length!==3||
    !Array.isArray(bot.farmers)||bot.farmers.length!==3||
    new Set(names).size!==3||
    names.some(n=>!bot.farmers.includes(n))||
    !names.includes(c.name))
  return caveSupportDeny('assembled-original-trio-required',scope);
 if(!caveSupportFinite(c.hp)||!caveSupportFinite(c.max_hp)||
    c.max_hp<=0||c.hp<c.max_hp*.85||c.hp>c.max_hp||
    !caveSupportFinite(c.mp)||!caveSupportFinite(c.max_mp)||
    c.max_mp<=0||c.mp<c.max_mp*.3||
    !caveSupportFinite(c.x)||!caveSupportFinite(c.y))
  return caveSupportDeny('healthy-supported-priest-required',scope);
 const rangers=[];
 for(const n of names.filter(n=>n!==c.name)){
  const h=bot.transport?.fresh?.(n),v=bot.entity?.(n);
  if(!h||h.name!==n||h.class!=='ranger'||
     h.running!==true||h.rip===true||h.realm!==cave.realm||
     h.map!==live.map||(h.in!==undefined&&h.in!==live.map)||
     !caveSupportClock(h.received)||h.received>now||
     now-h.received>3000||
     !Number.isSafeInteger(h.threats)||h.threats<0||
     !caveSupportFinite(h.hp)||!caveSupportFinite(h.max_hp)||
     h.max_hp<=0||h.hp<=0||h.hp>h.max_hp||
     !caveSupportFinite(h.x)||!caveSupportFinite(h.y)||
     !v||v.name!==n||v.visible!==true||v.rip===true||
     v.type==='monster'||v.map!==live.map||
     (v.in!==undefined&&v.in!==live.map)||
     !caveSupportFinite(v.x)||!caveSupportFinite(v.y)||
     !caveSupportFinite(v.hp)||!caveSupportFinite(v.max_hp)||
     v.max_hp<=0||v.hp<=0||v.hp>v.max_hp||
     Math.hypot(v.x-h.x,v.y-h.y)>8||
     Math.abs(v.hp/v.max_hp-h.hp/h.max_hp)>.08)
   return caveSupportDeny('fresh-visible-rangers-required',{...scope,member:n});
  rangers.push({name:n,h,v,ratio:v.hp/v.max_hp});
 }
 // Support repositioning is allowed only when EXACTLY one Ranger is
 // injured but still survivable, and is near the edge of heal range.
 const patients=rangers.filter(m=>m.ratio>=.45&&m.ratio<=.8&&
  Math.hypot(m.v.x-c.x,m.v.y-c.y)>=122);
 if(patients.length!==1||rangers.some(m=>m!==patients[0]&&m.ratio<.8))
  return caveSupportDeny('single-healable-ranger-at-range-margin-required',scope);
 const patient=patients[0],other=rangers.find(m=>m!==patient);
 const dist=Math.hypot(patient.v.x-c.x,patient.v.y-c.y);
 if(!caveSupportFinite(dist)||dist>140||
    Math.hypot(other.v.x-c.x,other.v.y-c.y)>130||
    patient.h.threats!==1||other.h.threats!==0)
  return caveSupportDeny('healing-margin-or-aggro-unverified',scope);
 const mobs=bot.monsters?.();
 if(!Array.isArray(mobs)||mobs.length>512)
  return caveSupportDeny('local-monster-snapshot-unavailable',scope);
 const visible=mobs.filter(m=>m&&m.dead!==true&&
  !(caveSupportFinite(m.hp)&&m.hp<=0)&&
  (m.map===live.map||m.in===live.map||names.includes(m.target)));
 if(visible.length!==1)
  return caveSupportDeny('no-single-engaged-cave-monster',{
   ...scope,monsterCount:visible.length});
 const monster=visible[0],confirmed=bot.entity?.(monster.id);
 if(monster.type!==undefined&&monster.type!=='monster'||
    !monster.id||typeof monster.id!=='string'||monster.id.length>100||
    monster.target!==patient.name||
    !caveSupportFinite(monster.hp)||monster.hp<=0||
    monster.map!==live.map||
    (monster.in!==undefined&&monster.in!==live.map)||
    !caveSupportFinite(monster.x)||!caveSupportFinite(monster.y)||
    !caveSupportFinite(monster.range)||monster.range<10||
    monster.range>55||
    !confirmed||confirmed.id!==monster.id||
    confirmed.hp!==monster.hp||confirmed.target!==monster.target||
    confirmed.x!==monster.x||confirmed.y!==monster.y)
  return caveSupportDeny('current-melee-ranger-aggro-required',scope);
 const meta=p.G?.monsters?.[monster.mtype];
 if(!meta||!caveSupportFinite(meta.attack)||meta.attack<=0||
    !caveSupportFinite(meta.frequency)||meta.frequency<=0||
    !caveSupportFinite(meta.range??monster.range)||
    meta.range!==undefined&&meta.range>55)
  return caveSupportDeny('official-melee-threat-definition-required',scope);
 if(Math.hypot(monster.x-patient.v.x,monster.y-patient.v.y)>75)
  return caveSupportDeny('engaged-monster-location-unverified',scope);
 const step=24;
 const point={
  x:c.x+(patient.v.x-c.x)*step/dist,
  y:c.y+(patient.v.y-c.y)*step/dist
 };
 const threatMargin=Math.max(120,monster.range+85);
 if(!caveSupportFinite(point.x)||!caveSupportFinite(point.y)||
    Math.hypot(point.x-patient.v.x,point.y-patient.v.y)>115||
    Math.hypot(point.x-other.v.x,point.y-other.v.y)>125||
    Math.hypot(point.x-monster.x,point.y-monster.y)<threatMargin||
    Math.hypot(c.x-monster.x,c.y-monster.y)<threatMargin)
  return caveSupportDeny('no-threat-separated-support-waypoint',scope);
 if(hostChecks){
  try{
   if(p.has?.('can_move_to')!==true||
      p.call('can_move_to',point.x,point.y)!==true)
    return caveSupportDeny('native-direct-clearance-unavailable',scope);
  }catch{return caveSupportDeny('native-direct-clearance-unavailable',scope);}
 }
 return {...caveSupportDeny('safe-direct-healing-margin-ready',scope),
  ready:true,canMove:true,priest:c.name,priestX:c.x,priestY:c.y,
  priestHp:c.hp,priestMp:c.mp,
  patient:patient.name,patientX:patient.v.x,patientY:patient.v.y,
  patientHp:patient.v.hp,patientThreats:patient.h.threats,
  ally:other.name,allyX:other.v.x,allyY:other.v.y,
  allyHp:other.v.hp,monsterId:monster.id,
  monsterHp:monster.hp,monsterX:monster.x,monsterY:monster.y,
  monsterTarget:monster.target,x:point.x,y:point.y,step};
}
export function createCavePriestSupport(bot,{now=()=>Date.now()}={}){
 let attempts=0,last=null;
 const proof=(hostChecks,forDispatch=false)=>
  cavePriestSupportPreflight(bot,{now:now(),hostChecks,forDispatch});
 function status(options={}){
  return {...proof(false,options.forDispatch===true),attempts,last};
 }
 function tick(){
  const first=proof(true);
  if(!first.ready)return false;
  const keys=['run','floor','map','priest','priestX','priestY',
   'priestHp','priestMp','patient','patientX','patientY','patientHp',
   'patientThreats','ally','allyX','allyY','allyHp','monsterId',
   'monsterHp','monsterX','monsterY','monsterTarget','x','y'];
  const admit=()=>{
   const current=proof(true,true);
   return current.ready===true&&keys.every(key=>current[key]===first[key]);
  };
  const accepted=bot.movement?.local?.(
   first.x,first.y,'cave-priest',admit)===true;
  if(accepted){
   attempts++;
   last={run:first.run,floor:first.floor,patient:first.patient,
    monsterId:first.monsterId,x:first.x,y:first.y,at:now()};
   bot.event?.('cave.priest.supportStepRequested',last);
  }
  return accepted;
 }
 return {status,tick};
}
