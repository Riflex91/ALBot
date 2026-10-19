import {distance,samePlace} from '../core/policy.mjs';

// An approved squad farm trip is navigation, not an optional combat orbit.
// Keep the native path owner while transient road aggro is handled through
// potions / Priest heal. This never approves a monster or starts a new pull.
export function committedFarmTransit(character,order,plan){
 if(!character||!plan||!order?.dest||
    !['farm','follow'].includes(order.owner)||
    !['farm','hunt','material','elixir'].includes(plan.kind)||
    !samePlace(order.dest,plan)||
    !Number.isFinite(order.dest.x)||!Number.isFinite(order.dest.y)||
    !Number.isFinite(plan.x)||!Number.isFinite(plan.y)||
    distance(order.dest,plan)>85)return false;
 // Do not mistake combat-positioning around the already reached spawn for
 // an active cross-map transit. A plan can be in the same map but still far.
 return !samePlace(character,plan)||distance(character,plan)>85;
}
// A stationary native path search is not evidence that a monster blocks us.
// Require actual incoming damage plus failed physical progress, or an active
// immobilizing condition. Keep the witness briefly while defense owns movement.
export function createTransitBlockObserver(){
 let sample=null,block=null;
 return (character,order,plan,monsters,now=Date.now())=>{
  const own=(monsters??[]).filter(m=>m?.hp>0&&!m.dead&&
   m.target===character.name&&samePlace(m,character));
  const attacker=own.find(m=>m.id===block?.monster)??own[0];
  if(!attacker||!plan||block?.plan!==undefined&&block.plan!==plan.id){block=null;}
  if(block&&now-block.at>=0&&now-block.at<=6000&&attacker?.id===block.monster&&
     samePlace(block,character)&&distance(block,character)<=20){
   block.at=now;return {...block};
  }
  block=null;
  if(!attacker||!committedFarmTransit(character,order,plan)){sample=null;return null;}
  if(!sample||sample.plan!==plan.id||!samePlace(sample,character)||
     distance(sample,character)>20||sample.monster!==attacker.id)
   sample={...character,plan:plan.id,monster:attacker.id,at:now,hp:character.hp};
  const immobilized=['stunned','stoned'].some(id=>!!character.s?.[id]);
  const damagedStall=character.moving===true&&now-sample.at>=6000&&
   sample.hp-character.hp>=Math.max(25,character.max_hp*.03);
  if(!immobilized&&!damagedStall&&character.hp/character.max_hp>=.6)return null;
  block={plan:plan.id,monster:attacker.id,victim:character.name,
   map:character.map,in:character.in??character.map,x:character.x,y:character.y,at:now,
   reason:immobilized?'immobilized':damagedStall?'damaged-route-stall':'critical-hp'};
  return {...block};
 };
}
export function verifiedTransitBlock(character,plan,monsters,peers=[],now=Date.now()){
 for(const peer of peers){const b=peer?.travelBlock;
  if(!peer?.running||peer.rip||peer.realm!==plan?.realm||
     !Number.isFinite(peer.received)||now-peer.received<0||now-peer.received>4000||
     !b||b.plan!==plan.id||b.victim!==peer.name||!Number.isFinite(b.at)||
     now-b.at<0||now-b.at>6000||!samePlace(peer,b))continue;
  const m=(monsters??[]).find(m=>m?.id===b.monster&&m.hp>0&&!m.dead&&
   m.target===peer.name&&samePlace(m,peer)&&samePlace(character,m));
  if(m)return m;
 }
 return null;
}
export function roadAggroTravelDecision(character,order,plan,monsters,teamNames=[],blocked=false){
 if(!committedFarmTransit(character,order,plan))
  return {continueRoute:false,reason:'not-committed-farm-transit'};
 const names=new Set(teamNames);
 const enemies=(monsters??[]).filter(m=>m?.hp>0&&!m.dead&&names.has(m.target));
 if(!enemies.length)return {continueRoute:false,reason:'no-team-aggro'};
 if(blocked)return {continueRoute:false,reason:'verified-team-transit-block'};
 return {continueRoute:true,reason:'team-road-aggro-preserve-native-route',
  hostileCount:enemies.length};
}
