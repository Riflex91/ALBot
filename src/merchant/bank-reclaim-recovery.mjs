import {fingerprint,protectedItem,variantCount} from '../core/policy.mjs';

// W03/W04/G11: one read-only proof over a durable bank-reclaim before-image.
// No guess about missing bank packs or a checkpoint written by older code
// may authorize a withdrawal or a second NPC sale.
const safe=n=>Number.isSafeInteger(n)&&n>=0;
export function validateBankReclaimRecord(record,{owner,realm,now=Date.now()}={}){
 const reject=reason=>({valid:false,reason});
 if(!record||typeof record!=='object'||Array.isArray(record)||
    record.version!==2||typeof owner!=='string'||!owner||
    typeof realm!=='string'||!realm||
    record.owner!==owner||record.realm!==realm)
  return reject('unverified-checkpoint-owner-or-version');
 if(!safe(now)||!safe(record.at)||record.at<1||record.at>now+2000)
  return reject('invalid-checkpoint-time');
 if(!/^items\d+$/.test(record.pack??'')||!safe(record.slot)||
    record.slot>=42||!safe(record.dest)||record.dest>=1000)
  return reject('invalid-addressed-slots');
 if(!record.item||typeof record.item.name!=='string'||!record.item.name||
    protectedItem(record.item)||!safe(record.quantity)||
    record.quantity<1||record.quantity!==(record.item.q??1)||
    !safe(record.before)||!safe(record.bankBefore)||
    record.bankBefore<record.quantity||
    !safe(record.before+record.quantity))
  return reject('invalid-variant-or-quantities');
 if(typeof record.sourcePrint!=='string'||
    record.sourcePrint!==fingerprint(record.item)||
    typeof record.explicitOnly!=='boolean'||
    !safe(record.gold)||!safe(record.expectedSaleGold)||
    !(record.saleConfirmed===undefined||record.saleConfirmed===true))
  return reject('invalid-checkpoint-evidence');
 return {valid:true,reason:null};
}

export function classifyBankReclaimRecord(record,{owner,realm,now=Date.now(),
 inventory,bank,map,packMap}={}){
 const verified=validateBankReclaimRecord(record,{owner,realm,now});
 if(!verified.valid)return {phase:'invalid',reason:verified.reason,confirmed:false};
 if(!Array.isArray(inventory)||record.dest>=inventory.length||
    typeof packMap!=='function'||typeof map!=='string'||!map)
  return {phase:'unobserved',reason:'inventory-or-bank-map-unavailable',confirmed:false};
 let bankMap;try{bankMap=packMap(record.pack);}catch{
  return {phase:'unobserved',reason:'bank-map-unresolved',confirmed:false};
 }
 if(bankMap!==map||!bank||!Array.isArray(bank[record.pack])||
    bank[record.pack].length>42)
  return {phase:'unobserved',reason:'addressed-local-bank-pack-unavailable',confirmed:false};
 const pack=bank[record.pack],source=pack[record.slot],
  target=inventory[record.dest];
 const count=variantCount(inventory,record.item),
  bankCount=variantCount(pack,record.item);
 if(!safe(count)||!safe(bankCount))
  return {phase:'ambiguous',reason:'invalid-observed-quantities',confirmed:false};
 const original=!!source&&fingerprint(source)===record.sourcePrint,
  withdrawn=!source&&!!target&&fingerprint(target)===record.sourcePrint,
  empty=!target;
 if(!record.saleConfirmed&&original&&empty&&
    count===record.before&&bankCount===record.bankBefore)
  return {phase:'unchanged',reason:'exact-addressed-before-image',confirmed:false};
 if(!record.saleConfirmed&&withdrawn&&
    count===record.before+record.quantity&&
    bankCount===record.bankBefore-record.quantity)
  return {phase:'withdrawn',reason:'exact-addressed-withdrawal',confirmed:true};
 if(record.saleConfirmed===true&&!source&&empty&&
    count===record.before&&
    bankCount===record.bankBefore-record.quantity)
  return {phase:'sold',reason:'previously-confirmed-sale-and-exact-final-state',
   confirmed:true};
 return {phase:'ambiguous',reason:'addressed-inventory-or-bank-evidence-mismatch',
  confirmed:false};
}
