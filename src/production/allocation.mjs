import {fingerprint,identity} from '../core/policy.mjs';
export function createGearAllocation(bot){const key='albot:gear:'+bot.me.name+':allocations';let rows=bot.p.read(key)??[];if(!Array.isArray(rows))rows=[];rows=rows.filter(x=>x&&typeof x.id==='string'&&typeof x.recipient==='string'&&typeof x.fingerprint==='string').slice(-64);
 function save(next){if(!bot.p.write(key,next))return false;rows=next;return true;}
 function goalFor(item,to){return bot.gear?.goals().find(g=>g.recipient===to&&g.item===item.name&&g.level===(item.level??0));}
 function reserve(j){const goal=goalFor(j.item,j.to);if(!goal)return true;const peer=bot.transport.fresh(j.to),live=bot.p.c.items[j.slot];if(!peer?.session||peer.session!==j.session||fingerprint(live)!==j.fingerprint)return false;const old=rows.find(r=>r.id===j.id);if(old)return old.state==='reserved'&&old.recipientSession===j.session&&old.fingerprint===j.fingerprint;
  const next=rows.filter(r=>r.state==='unresolved'||r.at>Date.now()-86400000).slice(-63);if(next.length>=63&&next.every(r=>r.state==='unresolved'))return false;
  next.push({id:j.id,recipient:j.to,recipientSession:j.session,slot:j.slot,fingerprint:j.fingerprint,variant:identity(live),quantity:j.quantity,gearSlot:goal.gearSlot,realm:bot.p.realm(),at:Date.now(),state:'reserved'});return save(next);
 }
 function guard(j){const row=rows.find(r=>r.id===j.id);return !row||row.state==='reserved'&&row.recipientSession===bot.transport.fresh(j.to)?.session&&row.realm===bot.p.realm()&&row.fingerprint===fingerprint(bot.p.c.items[j.slot]);}
 function settle(j,state){const row=rows.find(r=>r.id===j.id);if(!row)return true;if(row.state==='delivered')return state==='confirmed';return save(rows.map(r=>r.id===j.id?{...r,state:state==='confirmed'?'delivered':'unresolved',settled:Date.now(),settlement:{id:j.id,variant:identity(j.item),recipientSession:j.session,quantity:j.quantity,receipt:!!j.receipt}}:r));}
 return {reserve,guard,settle,status:()=>rows.map(r=>({...r})),close(){}};
}
