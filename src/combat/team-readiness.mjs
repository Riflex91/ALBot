import {distance,samePlace} from '../core/policy.mjs';

// Neutral pulls require live, healthy, colocated participants. Defensive
// combat against an existing attacker remains allowed independently.
export function neutralPullReadiness(bot){
 const {cfg,p,me}=bot;
 if(cfg.party?.enabled===false||cfg.party?.waitForTeam!==true)
  return {ready:true,reason:'no-team-hold'};
 if(me.name!==bot.leader)return {ready:false,reason:'follower-cannot-pull'};
 const names=bot.farmers??[];
 if(!names.length)return {ready:false,reason:'missing-roster'};
 const maxDistance=Math.min(140,Math.max(1,cfg.party.followDistance??140));
 for(const name of names){
  if(name===me.name)continue;
  const peer=bot.transport?.fresh?.(name);
  if(!peer?.running||peer.rip||peer.realm!==p.realm()||
    peer.inventoryBlocked||peer.journal||peer.reserved)
   return {ready:false,peer:name,reason:'peer-not-ready'};
  if(!samePlace(p.c,peer)||!Number.isFinite(peer.x)||
    !Number.isFinite(peer.y)||distance(p.c,peer)>maxDistance)
   return {ready:false,peer:name,reason:'peer-not-assembled'};
  if(!Number.isFinite(peer.hp)||!Number.isFinite(peer.max_hp)||
    peer.max_hp<=0||peer.hp/peer.max_hp<(cfg.farming.pullHp??.8)||
    !Number.isFinite(peer.mp)||!Number.isFinite(peer.max_mp)||
    peer.max_mp<=0||peer.mp/peer.max_mp<.15)
   return {ready:false,peer:name,reason:'peer-recovering'};
 }
 return {ready:true,reason:'assembled'};
}
