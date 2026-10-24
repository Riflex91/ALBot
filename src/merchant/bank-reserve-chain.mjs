// W03/W04: a reserve chain is a recovery cursor, NEVER a bank/sale permit.
// Journal dispatch receipts and fresh local physical observations stay required.
const integer=n=>Number.isSafeInteger(n)&&n>=0;
export function validReserveChain(r,{owner,realm,now=Date.now()}={}){
 if(!r||typeof r!=='object'||Array.isArray(r)||r.version!==1||
    !owner||!realm||r.owner!==owner||r.realm!==realm||
    typeof r.variant!=='string'||!r.variant||
    !r.item||typeof r.item.name!=='string'||!r.item.name||
    !integer(r.floor)||r.floor<1||!integer(r.carried)||
    !integer(r.steps)||r.steps>16||!integer(r.started)||r.started<1||
    !integer(r.updated)||r.updated<r.started||r.updated>now+2000||
    !['ready','prepared','dispatched'].includes(r.phase))return false;
 if(r.phase==='ready')return r.source===null;
 const s=r.source;
 return !!s&&typeof s==='object'&&!Array.isArray(s)&&
  /^items\\d+$/.test(s.pack??'')&&integer(s.slot)&&s.slot<42&&
  typeof s.before==='string'&&!!s.before&&
  (s.after===null||typeof s.after==='string'&&!!s.after)&&
  integer(s.held)&&integer(s.take)&&s.take>0&&
  integer(s.quantity)&&s.quantity>=s.take&&
  integer(s.held+s.take)&&r.carried===s.held&&
  r.steps<16;
}
export function reserveChainObservation(r,{held,source,journalOpen=false}={}){
 if(!r)return 'absent';
 if(r.phase==='ready')return 'ready';
 if(journalOpen)return 'journal-open';
 if(!integer(held))return 'unknown-physical-quantity';
 if(r.phase==='prepared')return
  held===r.source.held&&source===r.source.before?
  'prepared-unchanged':'prepared-drift';
 // A durable dispatch record alone is NOT proof of physical completion.
 if(held===r.source.held+r.source.take&&source===r.source.after)
  return 'confirmed-physical-step';
 return 'dispatched-outcome-unknown';
}
