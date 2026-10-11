import {gearCompatible,gearScore,gearSuitability} from './gear.mjs';
import {defaultsFor} from '../../editor/lib/contract.mjs';
import {ITEM_RULE} from '../../editor/lib/schema.mjs';
import {fingerprint,identity,protectedItem} from '../core/policy.mjs';
export function createGearAllocation(bot){const key='albot:gear:'+bot.me.name+':allocations';let rows=bot.p.read(key)??[];if(!Array.isArray(rows))rows=[];rows=rows.filter(x=>x&&typeof x.id==='string'&&typeof x.recipient==='string'&&typeof x.fingerprint==='string').slice(-64);
 function save(next){if(!bot.p.write(key,next))return false;rows=next;return true;}
 function goalFor(item,to){return bot.gear?.goals().find(g=>g.recipient===to&&g.item===item.name&&g.level===(item.level??0));}
 function reserve(j){const goal=goalFor(j.item,j.to);if(!goal)return true;const peer=bot.transport.fresh(j.to),live=bot.p.c.items[j.slot];if(!j.gear||!peer?.session||peer.session!==j.session||fingerprint(live)!==j.fingerprint||j.gear&&(!j.gearAck||fingerprint(peer.gear?.slots?.[j.gear.slot])!==j.gear.expected))return false;const old=rows.find(r=>r.id===j.id);if(old)return old.state==='reserved'&&old.recipientSession===j.session&&old.fingerprint===j.fingerprint;
  const next=rows.filter(r=>r.state==='unresolved'||r.at>Date.now()-86400000).slice(-63);if(next.length>=63&&next.every(r=>r.state==='unresolved'))return false;
  next.push({id:j.id,recipient:j.to,recipientSession:j.session,slot:j.slot,fingerprint:j.fingerprint,variant:identity(live),quantity:j.quantity,gearSlot:goal.gearSlot,expected:j.gear?.expected,realm:bot.p.realm(),at:Date.now(),state:'reserved'});return save(next);
 }
 function guard(j){const row=rows.find(r=>r.id===j.id);return !row||row.state==='reserved'&&row.recipientSession===bot.transport.fresh(j.to)?.session&&row.realm===bot.p.realm()&&(!row.expected||row.expected===fingerprint(bot.transport.fresh(j.to)?.gear?.slots?.[row.gearSlot]))&&row.fingerprint===fingerprint(bot.p.c.items[j.slot]);}
 function settle(j,state){const row=rows.find(r=>r.id===j.id);if(!row)return true;if(row.state==='delivered')return state==='confirmed';return save(rows.map(r=>r.id===j.id?{...r,state:state==='confirmed'?'delivered':'unresolved',settled:Date.now(),settlement:{id:j.id,variant:identity(j.item),recipientSession:j.session,quantity:j.quantity,receipt:!!j.receipt}}:r));}
 const receivingKey=key+':receiving';let receiving=bot.p.read(receivingKey)??[];if(!Array.isArray(receiving))receiving=[];
 function offer(item,to){const g=goalFor(item,to);if(!g)return null;const peer=bot.transport.fresh(to);return peer?.gear?{goal:g.name,slot:g.gearSlot,expected:fingerprint(peer.gear.slots?.[g.gearSlot]),item,expires:Date.now()+bot.cfg.general.messageTtlMs}:false;}
 function accept(id,from,session,item,g){if(!g)return true;const profile=bot.gear.snapshot(),old=bot.p.c.slots?.[g.slot],explicit=bot.economy.explicit(item);
  if(g.expires<Date.now()||from!==bot.cfg.party.merchant||protectedItem(old)&&old||g.expected!==fingerprint(profile.slots?.[g.slot])||!gearCompatible(bot.p.G,profile,item,g.slot)||explicit&&explicit.action!=='equip')return false;
  const role=bot.me.gearRole==='auto'?(profile.class==='priest'?'healer':profile.class==='merchant'?'economy':'dps'):bot.me.gearRole;
  try{const next=bot.p.call('item_properties',item),previous=old?bot.p.call('item_properties',old):null;
   if(!gearSuitability(previous,next,role,profile.class,bot.me.merchantMobility).ok)return false;
   if(old&&gearScore(next,role,profile.class)<=gearScore(previous,role,profile.class))return false;
  }catch{return false;}
  const row={id,from,session,item,slot:g.slot,expected:g.expected,expires:Date.now()+600000,state:'accepted'};const next=receiving.filter(r=>r.id!==id&&r.expires>Date.now()).slice(-15);next.push(row);if(!bot.p.write(receivingKey,next))return false;receiving=next;return true;
 }
 function rules(){receiving=receiving.filter(r=>r.expires>Date.now());return receiving.filter(r=>fingerprint(bot.gear.snapshot().slots?.[r.slot])===r.expected).map(r=>({...defaultsFor(ITEM_RULE),name:'Gearzusage '+r.id,item:r.item.name,minLevel:r.item.level,maxLevel:r.item.level,statType:r.item.stat_type??'',property:r.item.p??'',title:r.item.title??'',role:bot.me.role,character:bot.me.name,action:'equip',slot:r.slot,priority:50000,targetCount:1,maxCount:1}));}
 function equipGuard(item,slot){const r=receiving.find(r=>r.slot===slot&&r.state!=='equipped'&&r.expires>Date.now());return !r||identity(r.item)===identity(item)&&fingerprint(bot.gear.snapshot().slots?.[slot])===r.expected;}
 function tick(){let changed=false;for(const r of receiving){if(identity(bot.p.c.slots?.[r.slot])===identity(r.item)&&r.state!=='equipped'){r.state='equipped';changed=true;bot.event('gear.equipped',{id:r.id,slot:r.slot,item:r.item.name,reason:'Empfaengerzustand bestaetigt'});}}if(changed)bot.p.write(receivingKey,receiving);let delivered=false;for(const r of rows)if(r.state==='delivered'&&identity({...bot.transport.fresh(r.recipient)?.gear?.slots?.[r.gearSlot],l:undefined,b:undefined})===r.variant){r.state='equipped';delivered=true;}if(delivered)save(rows);}
 return {offer,accept,rules,equipGuard,tick,reserve,guard,settle,status:()=>rows.map(r=>({...r})),close(){}};
}
