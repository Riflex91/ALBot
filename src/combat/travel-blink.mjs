import {distance,samePlace} from '../core/policy.mjs';
import {runtimeConditionGate} from '../core/action-admission.mjs';
// Official server safe_xy_nearby first applies smap_round with step 10.
export function blinkLandingPoint(destination){
 if(!Number.isFinite(destination?.x)||!Number.isFinite(destination?.y))return null;
 const round=value=>{const integer=Number.parseInt(value,10),base=integer-integer%10,
  next=base+(value<0?-10:10);return Math.abs(value-base)<Math.abs(value-next)?base:next;};
 return {...destination,x:round(destination.x),y:round(destination.y)};
}
export function travelBlinkEligible(bot,destination,owner){
 const {p,cfg}=bot,c=p.c,s=p.G.skills?.blink,landing=blinkLandingPoint(destination);
 if(!landing||cfg.world?.travelBlink!==true||cfg.party?.advancedSkills===false||
    c.ctype!=='mage'||c.rip||!s||!p.has('use_skill')||
    !['farm','economy','quest','follow','cohesion'].includes(owner)||
    !samePlace(c,destination)||p.G.maps?.[c.map]?.instance||c.cave||
    Object.keys(c.c??{}).length||bot.journal||bot.inventoryBlocked||
    !runtimeConditionGate(c,p.G,'skill:blink',['movement','mana']).allowed||
    bot.monsters().some(m=>m.target===c.name&&m.hp>0&&!m.dead)||
    !Number.isFinite(s.mp)||s.mp<0||!Number.isFinite(c.mp)||!Number.isFinite(c.max_mp)||
    c.mp-s.mp<c.max_mp*Math.max(.5,cfg.farming.pullMp??.5)||
    distance(c,landing)/Math.max(1,c.speed??40)<5||
    distance(c,landing)>600||!Number.isFinite(destination.x)||!Number.isFinite(destination.y))
  return false;
 // Only shortcut an already directly walkable segment, not unknown walls,
 // map doors or a native route's unexamined future nodes.
 return p.call('can_move_to',destination.x,destination.y)===true&&
  p.call('can_move_to',landing.x,landing.y)===true&&
  p.call('is_on_cooldown','blink')===false;
}
