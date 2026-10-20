// W12/N12: second (prepare) round for unanimously attested retreat paths.
// This is NOT a move executor, a lease, or a distributed atomic commit.
// No character may act on this diagnostic status as movement authority.
const finite=n=>Number.isFinite(n);
const time=n=>Number.isSafeInteger(n)&&n>0;
const blocked=(reason,details={})=>({
 version:1,mode:'cave-retreat-preparation',
 ready:false,prepared:false,phase:'blocked',canMove:false,
 canAttack:false,canPull:false,canAoE:false,
 canHeal:false,executable:false,reason,...details
});
const equal=(a,b)=>finite(a)&&finite(b)&&Math.abs(a-b)<=.001;
export function caveRetreatPreparationPreflight(bot,{
 now=Date.now(),ownPrepare=null
}={}){
 if(!time(now)||!bot?.running||bot.me?.role!=='farmer'||
    bot.journal||bot.inventoryBlocked||bot.lifecycleChanging||
    bot.account?.rotationPending?.()||bot.bank?.pending||
    bot.logistics?.reserved||bot.logistics?.handoffActive||
    bot.gold?.reserved||bot.teamTravel?.blocked||
    bot.strategy?.busy||bot.movement?.order||
    bot.movement?.nativeBusy?.()||
    bot.exec?.pending?.has?.('cave.priest.heal'))
  return blocked('action-or-lifecycle-conflict');
 const r=bot.caveRetreat?.status?.();
 const critical=bot.caveCriticalResponse?.status?.();
 if(r?.ready!==true||r.consensus!==true||
    r.canMove!==false||critical?.ready!==true||
    critical.critical!==true||critical.holdOffense!==true||
    ![2,3].includes(critical.attackerCount)||
    critical.run!==r.run||critical.floor!==r.floor||
    critical.map!==r.map||
    typeof r.proofKey!=='string'||!r.proofKey||
    r.proofKey.length>1300||typeof r.threatKey!=='string'||
    !r.threatKey||!Number.isInteger(r.direction)||
    r.direction<0||r.direction>7||
    !r.self||r.self.name!==bot.p?.c?.name||
    !Array.isArray(r.participants)||r.participants.length!==3||
    new Set(r.participants).size!==3||
    !r.participants.includes(bot.p.c.name)||
    !time(r.attestationAt)||r.attestationAt>now||
    now-r.attestationAt>2500)
  return blocked('fresh-unanimous-retreat-proof-required',{
   consensusReason:r?.reason??'missing'});
 const point=r.self,scope={
  run:r.run,floor:r.floor,map:r.map,
  direction:r.direction,threatKey:r.threatKey,proofKey:r.proofKey
 };
 const self=bot.p.c;
 if(![point.x,point.y,point.toX,point.toY,self.x,self.y]
     .every(finite)||
    !equal(point.x,self.x)||!equal(point.y,self.y)||
    Math.hypot(point.toX-point.x,point.toY-point.y)>24.001||
    Math.hypot(point.toX-point.x,point.toY-point.y)<23.99)
  return blocked('own-staged-waypoint-no-longer-current',scope);
 // This only proves a second, consistent receipt, not simultaneous
 // execution. At most one native path attestation per heartbeat comes
 // from the existing caveRetreat.heartbeat, never from status().
 const view={
  v:1,actor:self.name,run:r.run,floor:r.floor,map:r.map,
  dir:r.direction,threat:r.threatKey,proof:r.proofKey,
  x:point.x,y:point.y,toX:point.toX,toY:point.toY,
  voteAt:r.attestationAt,at:now
 };
 return {...blocked('all-first-round-votes-current',scope),
  ready:true,phase:'prepare-eligible',participants:[...r.participants],
  self:view,ownPrepare};
}
export function createCaveRetreatPreparation(bot,{now=()=>Date.now()}={}){
 let own=null,checks=0,accepted=0,lastAbort=null;
 function heartbeat(){
  const at=now(),p=caveRetreatPreparationPreflight(bot,{now:at});
  checks++;
  if(p.ready!==true){
   if(own)lastAbort={at,reason:p.reason};
   own=null;return null;
  }
  own={...p.self};
  accepted++;
  // A short-lived second-round receipt. No other node may treat this
  // receipt as an instruction or a permission to move.
  return {...own};
 }
 function status(){
  const at=now(),p=caveRetreatPreparationPreflight(bot,{
   now:at,ownPrepare:own});
  const deny=(reason,details={})=>({...blocked(reason,{
   checks,accepted,lastAbort,
   run:p.run??null,floor:p.floor??null,
   ...details})});
  if(p.ready!==true)return deny(p.reason);
  if(!own||own.v!==1||own.actor!==p.self.actor||
     own.proof!==p.proofKey||own.threat!==p.threatKey||
     own.dir!==p.direction||own.run!==p.run||
     own.floor!==p.floor||own.map!==p.map||
     own.voteAt!==p.self.voteAt||
     !time(own.at)||own.at>at||at-own.at>2500||
     !equal(own.x,p.self.x)||!equal(own.y,p.self.y)||
     !equal(own.toX,p.self.toX)||
     !equal(own.toY,p.self.toY))
   return deny('own-second-round-receipt-missing-or-stale');
  const participants=[own.actor];
  for(const name of p.participants){
   if(name===own.actor)continue;
   const peer=bot.transport?.fresh?.(name);
   const prep=peer?.retreatPrepare,vote=peer?.retreatVote;
   if(!peer||peer.name!==name||peer.running!==true||
      peer.rip===true||peer.realm!==bot.p.realm?.()||
      peer.map!==p.map||(peer.in!==undefined&&peer.in!==p.map)||
      !time(peer.received)||peer.received>at||
      at-peer.received>3000||
      !prep||prep.v!==1||prep.actor!==name||
      prep.run!==p.run||prep.floor!==p.floor||
      prep.map!==p.map||prep.dir!==p.direction||
      prep.threat!==p.threatKey||prep.proof!==p.proofKey||
      !time(prep.at)||prep.at>at||at-prep.at>2500||
      !time(prep.voteAt)||prep.voteAt>prep.at||
      prep.at-prep.voteAt>2500||
      !vote||vote.v!==1||vote.key!==prep.proof||
      vote.at!==prep.voteAt||vote.run!==prep.run||
      vote.floor!==prep.floor||vote.map!==prep.map||
      vote.dir!==prep.dir||vote.threat!==prep.threat||
      ![prep.x,prep.y,prep.toX,prep.toY,
        peer.x,peer.y,vote.x,vote.y,
        vote.toX,vote.toY].every(finite)||
      !equal(prep.x,vote.x)||!equal(prep.y,vote.y)||
      !equal(prep.toX,vote.toX)||!equal(prep.toY,vote.toY)||
      Math.hypot(prep.x-peer.x,prep.y-peer.y)>2)
    return deny('independent-second-round-receipt-missing',{
     missing:name,received:participants.length});
   participants.push(name);
  }
  // Explicitly NOT a distributed commit or a right to enter Cave space.
  return {...deny('unanimous-preparation-evidence-only',{
   participants:participants.sort(),received:participants.length,
   direction:p.direction,threatKey:p.threatKey,
   proofKey:p.proofKey,phase:'prepared',
   firstRoundAt:own.voteAt,secondRoundAt:own.at}),
   ready:true,prepared:true,executable:false,canMove:false};
 }
 return {heartbeat,status};
}
