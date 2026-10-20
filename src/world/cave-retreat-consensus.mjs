// W12/N12: evidence-only three-character Cave retreat agreement.
// Every participant must independently attest native DIRECT geometry.
// A positive consensus is NOT an action token: no movement API is called.
const caveRetreatNum=n=>Number.isFinite(n);
const caveRetreatTime=n=>Number.isSafeInteger(n)&&n>0;
const caveRetreatRun=s=>typeof s==='string'&&/^[a-f0-9]{24}$/.test(s);
const caveRetreatDeny=(reason,scope={})=>({
 version:1,mode:'cave-retreat-consensus',ready:false,
 consensus:false,canMove:false,canAttack:false,canPull:false,
 canAoE:false,reason,...scope
});
const caveRetreatVector=[
 [1,0],[Math.SQRT1_2,Math.SQRT1_2],[0,1],
 [-Math.SQRT1_2,Math.SQRT1_2],[-1,0],
 [-Math.SQRT1_2,-Math.SQRT1_2],[0,-1],
 [Math.SQRT1_2,-Math.SQRT1_2]
];
const caveRetreatGap=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const caveRetreatPoint=(p,direction)=>({
 x:p.x+24*caveRetreatVector[direction][0],
 y:p.y+24*caveRetreatVector[direction][1]
});
export function caveRetreatLocalProof(bot,{
 now=Date.now(),nativeCheck=false
}={}){
 const p=bot?.p,c=p?.c;
 if(!bot?.running||bot.me?.role!=='farmer'||
    !['ranger','priest'].includes(c?.ctype)||
    c.rip===true||bot.cfg?.party?.enabled!==true||
    bot.cfg?.party?.waitForTeam!==true||!caveRetreatTime(now))
  return caveRetreatDeny('running-cave-farmer-required');
 if(bot.journal||bot.inventoryBlocked||bot.lifecycleChanging||
    bot.account?.rotationPending?.()||bot.bank?.pending||
    bot.logistics?.reserved||bot.logistics?.handoffActive||
    bot.gold?.reserved||bot.teamTravel?.blocked||bot.strategy?.busy||
    bot.movement?.order||bot.movement?.nativeBusy?.())
  return caveRetreatDeny('action-or-value-owner-busy');
 const response=bot.caveCriticalResponse?.status?.();
 if(response?.ready!==true||response.critical!==true||
    response.holdOffense!==true||
    ![2,3].includes(response.attackerCount))
  return caveRetreatDeny('verified-critical-multi-aggro-required',{
   responseState:response?.state??'missing'});
 const team=bot.caveTeam?.healStatus?.();
 const names=team?.members,cave=bot.cave?.status?.(),live=cave?.live;
 const lifecycle=bot.caveLifecycle?.status?.(),journal=lifecycle?.journal;
 if(team?.ready!==true||!Array.isArray(names)||names.length!==3||
    new Set(names).size!==3||!names.includes(c.name)||
    !Array.isArray(bot.farmers)||bot.farmers.length!==3||
    new Set(bot.farmers).size!==3||
    names.some(name=>!bot.farmers.includes(name))||
    !caveRetreatRun(team.run)||!live||
    live.run!==team.run||live.floor!==team.floor||
    live.map!==team.map||live.paused!==false||
    !caveRetreatTime(live.serverTime)||live.serverTime>now||
    now-live.serverTime>3000||cave.realm!==p.realm?.()||
    c.map!==team.map||(c.in!==undefined&&c.in!==team.map)||
    c.cave?.run!==team.run||
    lifecycle?.state!=='live-observed'||journal?.phase!=='observed-run'||
    journal.name!==c.name||journal.realm!==cave.realm||
    journal.observed?.run!==team.run)
  return caveRetreatDeny('fresh-durable-original-cave-trio-required');
 const scope={run:team.run,floor:team.floor,map:team.map};
 const actors=[],actorParts=[];
 for(const name of names){
  const m=name===c.name?c:bot.transport?.fresh?.(name);
  const visible=name===c.name?c:bot.entity?.(name);
  if(!m||m.name!==name||m.rip===true||
     m.map!==team.map||(m.in!==undefined&&m.in!==team.map)||
     !caveRetreatNum(m.x)||!caveRetreatNum(m.y)||
     !caveRetreatNum(m.hp)||!caveRetreatNum(m.max_hp)||
     m.max_hp<=0||m.hp/m.max_hp<.35||m.hp>m.max_hp||
     (name!==c.name&&(
      m.running!==true||m.realm!==cave.realm||
      !caveRetreatTime(m.received)||m.received>now||
      now-m.received>3000))||
     !visible||visible.name!==name||visible.rip===true||
     (name!==c.name&&visible.visible!==true)||
     visible.map!==team.map||
     (visible.in!==undefined&&visible.in!==team.map)||
     !caveRetreatNum(visible.x)||!caveRetreatNum(visible.y)||
     !caveRetreatNum(visible.hp)||!caveRetreatNum(visible.max_hp)||
     visible.max_hp<=0||visible.hp<=0||
     Math.hypot(visible.x-m.x,visible.y-m.y)>8||
     Math.abs(visible.hp/visible.max_hp-m.hp/m.max_hp)>.08)
   return caveRetreatDeny('direct-visible-trio-not-current',{
    ...scope,member:name});
  const role=m.ctype??m.class;
  if(name===team.priest?role!=='priest':role!=='ranger')
   return caveRetreatDeny('original-roles-unconfirmed',{...scope,member:name});
  actors.push({name,role,x:visible.x,y:visible.y});
  actorParts.push([name,m.hp,m.max_hp,visible.x,visible.y].join(':'));
 }
 const monsters=bot.monsters?.();
 if(!Array.isArray(monsters)||monsters.length>512)
  return caveRetreatDeny('complete-local-monster-observation-required',scope);
 const active=monsters.filter(m=>m&&m.dead!==true&&
   !(caveRetreatNum(m.hp)&&m.hp<=0)&&
   (m.map===team.map||m.in===team.map||names.includes(m.target)));
 if(active.length!==response.attackerCount)
  return caveRetreatDeny('unseen-or-neutral-cave-monster',{
   ...scope,observed:active.length});
 const ids=new Set(),monsterParts=[];
 for(const m of active){
  if(typeof m.id!=='string'||!m.id||m.id.length>100||
     ids.has(m.id)||m.type!==undefined&&m.type!=='monster'||
     typeof m.mtype!=='string'||!m.mtype||
     !names.includes(m.target)||
     m.map!==team.map||(m.in!==undefined&&m.in!==team.map)||
     !caveRetreatNum(m.hp)||m.hp<=0||
     !caveRetreatNum(m.x)||!caveRetreatNum(m.y))
   return caveRetreatDeny('monster-identity-or-geometry-unverified',scope);
  ids.add(m.id);
  monsterParts.push([m.id,m.target,m.mtype,m.hp,m.x,m.y].join(':'));
 }
 const centroid={
  x:actors.reduce((sum,m)=>sum+m.x,0)/actors.length,
  y:actors.reduce((sum,m)=>sum+m.y,0)/actors.length
 };
 const threats={
  x:active.reduce((sum,m)=>sum+m.x,0)/active.length,
  y:active.reduce((sum,m)=>sum+m.y,0)/active.length
 };
 const vx=centroid.x-threats.x,vy=centroid.y-threats.y;
 if(!caveRetreatNum(vx)||!caveRetreatNum(vy)||
    Math.hypot(vx,vy)<5)
  return caveRetreatDeny('no-unambiguous-away-vector',scope);
 const direction=(Math.round(Math.atan2(vy,vx)*4/Math.PI)+8)%8;
 const priest=actors.find(a=>a.name===team.priest);
 const plans=[];
 for(const m of actors){
  const dest=caveRetreatPoint(m,direction);
  if(!caveRetreatNum(dest.x)||!caveRetreatNum(dest.y)||
     actors.some(other=>other.name!==m.name&&
      caveRetreatGap(dest,other)>145)||
     m.name!==priest.name&&caveRetreatGap(dest,priest)>125||
     active.some(monster=>
      caveRetreatGap(dest,monster)<35||
      caveRetreatGap(dest,monster)-caveRetreatGap(m,monster)<12))
   return caveRetreatDeny('no-safe-shared-direct-vector',{
    ...scope,member:m.name});
  plans.push({name:m.name,x:m.x,y:m.y,toX:dest.x,toY:dest.y});
 }
 const self=plans.find(v=>v.name===c.name);
 if(nativeCheck){
  try{
   if(p.has?.('can_move_to')!==true||
      p.call('can_move_to',self.toX,self.toY)!==true)
    return caveRetreatDeny('own-native-direct-clearance-unavailable',scope);
  }catch{return caveRetreatDeny('own-native-direct-clearance-unavailable',scope);}
 }
 // The shared threat key excludes the viewer's identity, session and
 // heartbeat receive times. It includes exact enemy geometry and HP.
 const threatKey=monsterParts.sort().join('|');
 const localKey=[scope.run,scope.floor,threatKey,
  ...actorParts.sort(),direction].join('|');
 return {...caveRetreatDeny(nativeCheck?
  'local-direct-route-attested':'read-only-candidate-not-yet-attested',scope),
  ready:nativeCheck,attested:nativeCheck,
  direction,threatKey,localKey,
  actor:c.name,self,plans,
  attackerCount:active.length};
}
export function createCaveRetreatConsensus(bot,{now=()=>Date.now()}={}){
 let lastVote=null,checks=0;
 function heartbeat(){
  const at=now(),r=caveRetreatLocalProof(bot,{now:at,nativeCheck:true});
  checks++;
  if(r.ready!==true){lastVote=null;return null;}
  // Compact identity-scoped peer testimony. Only the receiving participant
  // can corroborate a peer's current position and matching enemy snapshot.
  const v={v:1,run:r.run,floor:r.floor,map:r.map,
   at,dir:r.direction,threat:r.threatKey,
   x:r.self.x,y:r.self.y,toX:r.self.toX,toY:r.self.toY};
  lastVote={...v,key:r.localKey};
  return v;
 }
 function status(){
  const at=now(),r=caveRetreatLocalProof(bot,{now:at});
  const deny=(reason,extra={})=>({...caveRetreatDeny(reason,{
   run:r.run??null,floor:r.floor??null,map:r.map??null,
   direction:r.direction??null,
   checks,...extra})});
  if(!r.localKey||r.reason!=='read-only-candidate-not-yet-attested')
   return deny(r.reason);
  if(!lastVote||!caveRetreatTime(lastVote.at)||
     at<lastVote.at||at-lastVote.at>2500||
     lastVote.key!==r.localKey||
     lastVote.x!==r.self.x||lastVote.y!==r.self.y||
     lastVote.toX!==r.self.toX||lastVote.toY!==r.self.toY)
   return deny('own-direct-clearance-not-freshly-attested');
  const votes=[{name:bot.p.c.name,...lastVote}];
  for(const plan of r.plans){
   if(plan.name===bot.p.c.name)continue;
   const peer=bot.transport?.fresh?.(plan.name),v=peer?.retreatVote;
   if(!peer||peer.name!==plan.name||peer.running!==true||
      peer.rip===true||peer.map!==r.map||
      (peer.in!==undefined&&peer.in!==r.map)||
      peer.realm!==bot.p.realm?.()||
      !caveRetreatTime(peer.received)||peer.received>at||
      at-peer.received>3000||
      !v||v.v!==1||v.run!==r.run||v.floor!==r.floor||
      v.map!==r.map||v.dir!==r.direction||
      v.threat!==r.threatKey||
      !caveRetreatTime(v.at)||v.at>at||at-v.at>2500||
      ![v.x,v.y,v.toX,v.toY,peer.x,peer.y].every(caveRetreatNum)||
      Math.hypot(v.x-peer.x,v.y-peer.y)>2||
      Math.hypot(v.x-plan.x,v.y-plan.y)>2||
      Math.hypot(v.toX-plan.toX,v.toY-plan.toY)>2)
    return deny('independent-peer-clearance-missing-or-divergent',{
     missing:plan.name,votes:votes.length});
   votes.push({name:plan.name,dir:v.dir,at:v.at,
    x:v.x,y:v.y,toX:v.toX,toY:v.toY});
  }
  // IMPORTANT: even a unanimous attestation cannot navigate the Cave.
  // There is still no atomic transaction across three native game clients.
  return {...deny('unanimous-native-retreat-evidence-only',{
   votes:votes.length,participants:votes.map(v=>v.name).sort(),
   threatKey:r.threatKey}),
   ready:true,consensus:true,canMove:false};
 }
 return {heartbeat,status};
}
