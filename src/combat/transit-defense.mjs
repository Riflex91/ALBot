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
export function roadAggroTravelDecision(character,order,plan,monsters,teamNames=[]){
 if(!committedFarmTransit(character,order,plan))
  return {continueRoute:false,reason:'not-committed-farm-transit'};
 const names=new Set(teamNames);
 const enemies=(monsters??[]).filter(m=>m?.hp>0&&!m.dead&&names.has(m.target));
 if(!enemies.length)return {continueRoute:false,reason:'no-team-aggro'};
 return {continueRoute:true,reason:'team-road-aggro-preserve-native-route',
  hostileCount:enemies.length};
}
