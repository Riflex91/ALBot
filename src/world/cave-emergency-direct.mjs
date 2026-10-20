// W12/N12: a VERY short, native-verified Cave Ranger emergency separation.
// This is not a path finder and never authorizes new pulls, skills or attacks.
// An uncertain floor, second monster, Priest or geometry is a hard refusal.
const caveEvadeFinite=n=>Number.isFinite(n);
const caveEvadeTime=n=>Number.isSafeInteger(n)&&n>0;
const caveEvadeRun=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s);
const caveEvadeDenied=(reason,scope={})=>({
 version:1,mode:'cave-emergency-direct',ready:false,canMove:false,
 canAttack:false,canPull:false,canUseSkills:false,reason,...scope
});
export function caveEmergencyDirectPreflight(bot,{
 now=Date.now(),hostChecks=true,forDispatch=false
}={}){
 const p=bot?.p,c=p?.c;
 if(!bot?.running||bot.me?.role!=='farmer'||c?.ctype!=='ranger'||
    c.rip===true||bot.cfg?.party?.enabled!==true||
    bot.cfg?.party?.waitForTeam!==true||
    bot.cfg?.party?.healing!==true)
  return caveEvadeDenied('eligible-supported-ranger-required');
 if(bot.journal||bot.inventoryBlocked||bot.lifecycleChanging||
    bot.account?.rotationPending?.()||bot.bank?.pending||
    bot.logistics?.reserved||bot.logistics?.handoffActive||
    bot.gold?.reserved||bot.teamTravel?.blocked||
    bot.strategy?.busy)
  return caveEvadeDenied('concurrent-value-or-lifecycle-work');
 const moveOrder=bot.movement?.order;
 if(moveOrder&&!(forDispatch&&moveOrder.owner==='cave-evade'))
  return caveEvadeDenied('another-movement-order');
 if(!forDispatch&&bot.movement?.nativeBusy?.())
  return caveEvadeDenied('native-movement-busy');
 const cave=bot.cave?.status?.(),live=cave?.live;
 const state=bot.caveLifecycle?.status?.(),journal=state?.journal;
 if(!caveEvadeTime(now)||!live||!caveEvadeRun(live.run)||
    !Number.isSafeInteger(live.floor)||live.floor<0||live.floor>7||
    live.map!==`zone_${live.run}_${live.floor}`||
    !caveEvadeTime(live.serverTime)||live.serverTime>now||
    now-live.serverTime>3000||live.paused!==false||
    cave.realm!==p.realm?.()||c?.map!==live.map||
    (c.in!==undefined&&c.in!==live.map)||c.cave?.run!==live.run)
  return caveEvadeDenied('current-local-cave-required');
 const scope={run:live.run,floor:live.floor,map:live.map};
 if(state?.state!=='live-observed'||journal?.phase!=='observed-run'||
    journal.name!==c.name||journal.realm!==cave.realm||
    journal.observed?.run!==live.run)
  return caveEvadeDenied('durable-run-unverified',scope);
 // Unlike combat readiness, a wounded Ranger MUST be allowed to request
 // isolation while a fully healthy trio would not need any emergency step.
 const team=bot.caveTeam?.healStatus?.();
 if(team?.ready!==true||team.run!==live.run||
    team.floor!==live.floor||team.map!==live.map||
    team.members?.length!==3||team.priest===c.name)
  return caveEvadeDenied('verified-healing-trio-required',scope);
 const names=team.members;
 if(!Array.isArray(bot.farmers)||bot.farmers.length!==3||
    new Set(names).size!==3||
    names.some(n=>!bot.farmers.includes(n))||
    !names.includes(c.name))
  return caveEvadeDenied('original-trio-required',scope);
 if(!caveEvadeFinite(c.hp)||!caveEvadeFinite(c.max_hp)||
    c.max_hp<=0||c.hp<=0||c.hp>c.max_hp||
    c.hp/c.max_hp>.65||c.hp/c.max_hp<.25||
    !caveEvadeFinite(c.x)||!caveEvadeFinite(c.y)||
    !caveEvadeFinite(c.speed)||c.speed<=0)
  return caveEvadeDenied('bounded-ranger-injury-required',scope);
 const priest=bot.transport?.fresh?.(team.priest);
 const priestEntity=bot.entity?.(team.priest);
 const otherName=names.find(n=>n!==c.name&&n!==team.priest);
 const other=bot.transport?.fresh?.(otherName);
 const peerSafe=(m,name)=>m?.name===name&&m.running===true&&
    m.realm===cave.realm&&m.rip!==true&&
    m.map===live.map&&(m.in===undefined||m.in===live.map)&&
    caveEvadeTime(m.received)&&m.received<=now&&
    now-m.received<=3000&&
    caveEvadeFinite(m.x)&&caveEvadeFinite(m.y)&&
    caveEvadeFinite(m.hp)&&caveEvadeFinite(m.max_hp)&&
    m.max_hp>0&&m.hp>=.7*m.max_hp&&m.hp<=m.max_hp&&
    m.threats===0;
 if(!peerSafe(priest,team.priest)||!peerSafe(other,otherName)||
    !caveEvadeFinite(priest.mp)||!caveEvadeFinite(priest.max_mp)||
    priest.max_mp<=0||priest.mp<priest.max_mp*.2||
    !priestEntity||priestEntity.name!==team.priest||
    priestEntity.visible!==true||priestEntity.rip===true||
    priestEntity.map!==live.map||
    (priestEntity.in!==undefined&&priestEntity.in!==live.map)||
    !caveEvadeFinite(priestEntity.x)||
    !caveEvadeFinite(priestEntity.y)||
    Math.hypot(priestEntity.x-priest.x,priestEntity.y-priest.y)>8)
  return caveEvadeDenied('fresh-visible-priest-and-support-required',scope);
 const monsters=bot.monsters?.();
 if(!Array.isArray(monsters)||monsters.length>512)
  return caveEvadeDenied('complete-cave-monster-snapshot-required',scope);
 const liveMobs=monsters.filter(m=>m&&m.dead!==true&&
    !(caveEvadeFinite(m.hp)&&m.hp<=0)&&
    (m.map===live.map||m.in===live.map||names.includes(m.target)));
 if(liveMobs.length!==1)
  return caveEvadeDenied('only-one-visible-engaged-monster-supported',{
   ...scope,monsterCount:liveMobs.length});
 const m=liveMobs[0],visible=bot.entity?.(m.id);
 if(!visible||visible!==m&&(
      visible.id!==m.id||visible.x!==m.x||visible.y!==m.y||
      visible.target!==m.target||visible.hp!==m.hp)||
    m.type!==undefined&&m.type!=='monster'||
    typeof m.id!=='string'||!m.id||m.id.length>100||
    !m.mtype||m.target!==c.name||
    !caveEvadeFinite(m.hp)||m.hp<=0||
    m.map!==live.map||(m.in!==undefined&&m.in!==live.map)||
    !caveEvadeFinite(m.x)||!caveEvadeFinite(m.y)||
    !caveEvadeFinite(m.range)||m.range<10||m.range>65)
  return caveEvadeDenied('one-visible-self-engaged-melee-required',scope);
 const meta=p.G?.monsters?.[m.mtype];
 if(!meta||!caveEvadeFinite(meta.attack)||meta.attack<=0||
    !caveEvadeFinite(meta.frequency)||meta.frequency<=0||
    !caveEvadeFinite(meta.speed)||meta.speed<=0||
    meta.speed>=c.speed*.85)
  return caveEvadeDenied('melee-speed-or-damage-unverified',scope);
 const gap=Math.hypot(c.x-m.x,c.y-m.y);
 if(!caveEvadeFinite(gap)||gap<10||gap>80)
  return caveEvadeDenied('no-close-melee-threat-to-separate',scope);
 const forecast=meta.attack*meta.frequency*1.5*4;
 if(!caveEvadeFinite(forecast)||!caveEvadeFinite(c.max_hp)||
    c.hp<=Math.max(meta.attack*2,.25*c.max_hp)||
    forecast<=0)
  return caveEvadeDenied('no-bounded-impact-survival',scope);
 // A 28px direct step must increase monster separation while retaining
 // direct Priest support. It does not claim to avoid future enemy hits.
 const angle=Math.atan2(c.y-m.y,c.x-m.x);
 const candidates=[0,Math.PI/6,-Math.PI/6].map(delta=>({
  x:c.x+28*Math.cos(angle+delta),
  y:c.y+28*Math.sin(angle+delta)
 })).filter(point=>
   caveEvadeFinite(point.x)&&caveEvadeFinite(point.y)&&
   Math.hypot(point.x-m.x,point.y-m.y)>=gap+20&&
   Math.hypot(point.x-priestEntity.x,point.y-priestEntity.y)<=110&&
   Math.hypot(point.x-other.x,point.y-other.y)<=150);
 if(!candidates.length)
  return caveEvadeDenied('no-direct-priest-tethered-step',scope);
 let selected=null;
 for(const point of candidates){
  if(hostChecks){
   try{
    if(p.has?.('can_move_to')!==true||
       p.call('can_move_to',point.x,point.y)!==true)continue;
   }catch{return caveEvadeDenied('native-direct-clearance-unavailable',scope);}
  }
  selected=point;break;
 }
 if(!selected)return caveEvadeDenied('no-native-direct-clearance',scope);
 return {...caveEvadeDenied('direct-melee-separation-ready',scope),
  ready:true,canMove:true,monsterId:m.id,monsterTarget:m.target,
  monsterX:m.x,monsterY:m.y,monsterHp:m.hp,
  priest:team.priest,priestX:priestEntity.x,priestY:priestEntity.y,
  heroX:c.x,heroY:c.y,heroHp:c.hp,
  x:selected.x,y:selected.y,step:28,originalGap:gap};
}
export function createCaveEmergencyDirect(bot,{now=()=>Date.now()}={}){
 let attempts=0,last=null;
 const proof=(hostChecks=true,forDispatch=false)=>
  caveEmergencyDirectPreflight(bot,{now:now(),hostChecks,forDispatch});
 function status(options={}){
  return {...proof(false,options.forDispatch===true),attempts,last};
 }
 function tick(){
  const first=proof(true);
  if(!first.ready)return false;
  const admit=()=>{
   const current=proof(true,true);
   return current.ready===true&&
    ['run','floor','map','monsterId','monsterTarget','monsterX',
     'monsterY','monsterHp','priest','priestX','priestY',
     'heroX','heroY','heroHp','x','y']
     .every(key=>current[key]===first[key]);
  };
  const accepted=bot.movement?.local?.(
   first.x,first.y,'cave-evade',admit)===true;
  if(accepted){
   attempts++;
   last={run:first.run,floor:first.floor,monsterId:first.monsterId,
    priest:first.priest,x:first.x,y:first.y,at:now()};
   bot.event?.('cave.emergency.directRequested',last);
  }
  return accepted;
 }
 return {status,tick};
}
