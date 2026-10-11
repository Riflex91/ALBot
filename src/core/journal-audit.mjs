import {fingerprint} from './policy.mjs';
export function inspectMiningJournal(bot){
 const j=bot.journal;
 if(!j)return {eligible:false,kind:null,inventoryEqual:false,goldEqual:false,reason:'Kein offenes Journal'};
 const snap=j.evidence;
 const inventoryEqual=Array.isArray(snap?.inventory)&&snap.inventory.length===bot.p.c.items?.length&&
  snap.inventory.every((fp,index)=>fp===(bot.p.c.items[index]?fingerprint(bot.p.c.items[index]):null));
 const goldEqual=Number.isSafeInteger(snap?.gold)&&snap.gold===bot.p.c.gold;
 const realmEqual=typeof snap?.realm==='string'&&snap.realm===bot.p.realm();
 const isMining=['gather.mining','gather.fishing'].includes(j.kind)&&j.cost===0&&j.loss===0&&Array.isArray(j.slots)&&j.slots.length===0;
 const eligible=!bot.running&&!bot.exec.pending.size&&!!bot.inventoryBlocked&&isMining&&inventoryEqual&&goldEqual&&realmEqual;
 return {eligible,kind:j.kind,inventoryEqual,goldEqual,realmEqual,reason:eligible?
  'Bestand und Gold entsprechen exakt dem Journal-Snapshot. Mining-Erfolg ist trotzdem unbekannt.':
  'Nicht freigabefähig: Pause, leere Auftragsliste, Mining-Journal, identischer Realm, Inventar und Gold erforderlich'};
}
