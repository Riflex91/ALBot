import {distance,samePlace} from '../core/policy.mjs';
import {runtimeConditionGate} from '../core/action-admission.mjs';
export function travelBlinkEligible(bot,destination,owner){
 const {p,cfg}=bot,c=p.c,s=p.G.skills?.blink;
 if(cfg.world?.travelBlink!==true||cfg.party?.advancedSkills===false||
    c.ctype!=='mage'||c.rip||!s||!p.has('use_skill')||
    !['farm','economy','quest','follow','cohesion'].includes(owner)||
    !samePlace(c,destination)||p.G.maps?.[c.map]?.instance||c.cave||
    Object.keys(c.c??{}).length||bot.journal||bot.inventoryBlocked||
    !runtimeConditionGate(c,p.G,'skill:blink',['movement','mana']).allowed||
    bot.monsters().some(m=>m.target===c.name&&m.hp>0&&!m.dead)||
    !Number.isFinite(s.mp)||s.mp<0||!Number.isFinite(c.mp)||!Number.isFinite(c.max_mp)||
    c.mp-s.mp<c.max_mp*Math.max(.5,cfg.farming.pullMp??.5)||
    distance(c,destination)/Math.max(1,c.speed??40)<5||
    distance(c,destination)>600||!Number.isFinite(destination.x)||!Number.isFinite(destination.y))
  return false;
 // Only shortcut an already directly walkable segment, not unknown walls,
 // map doors or a native route's unexamined future nodes.
 return p.call('can_move_to',destination.x,destination.y)===true&&
  p.call('is_on_cooldown','blink')===false;
}
