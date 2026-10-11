import {fingerprint} from './policy.mjs';

// The checkpoint has immutable "before" fingerprints. User actions that
// follow a timed-out gathering skill may legitimately ADD items, so a
// slot-by-slot comparison is too strict for a human-approved reconciliation.
// A HUMAN-reviewed exception for up to two ordinary MP potions is permitted.
// All other missing variants, gold changes and live gathering still block.
function readFingerprint(fp){
 if(fp===null)return null;
 if(typeof fp!=='string')return null;
 const colon=fp.lastIndexOf(':'),quantity=Number(fp.slice(colon+1)),id=fp.slice(0,colon);
 if(colon<1||!Number.isSafeInteger(quantity)||quantity<1)return null;
 try{const variant=JSON.parse(id);if(!Array.isArray(variant)||typeof variant[0]!=='string'||!variant[0])return null;
  return {id,name:variant[0],level:variant[1]??0,quantity};}catch{return null;}
}
function totals(fingerprints){
 const byId=new Map();
 for(const fp of fingerprints){
  if(fp===null)continue;
  const parsed=readFingerprint(fp);if(!parsed)return null;
  const current=byId.get(parsed.id),quantity=(current?.quantity??0)+parsed.quantity;
  if(!Number.isSafeInteger(quantity))return null;
  byId.set(parsed.id,{...parsed,quantity});
 }
 return byId;
}
const itemLabel=i=>i.name+(i.level?' +'+i.level:'');
const PLAIN_MPOT0=JSON.stringify(['mpot0',0,'','','','','','','']);
export function inspectMiningJournal(bot){
 const j=bot.journal;
 if(!j)return {eligible:false,kind:null,inventoryEqual:false,goldEqual:false,reason:'Kein offenes Journal',changes:[]};
 const snap=j.evidence,items=bot.p.c.items;
 const before=Array.isArray(snap?.inventory)?snap.inventory:null;
 const after=Array.isArray(items)?items.map(i=>i?fingerprint(i):null):null;
 const sameLength=!!before&&!!after&&before.length===after.length;
 const inventoryEqual=sameLength&&before.every((fp,index)=>fp===after[index]);
 const goldEqual=Number.isSafeInteger(snap?.gold)&&snap.gold===bot.p.c.gold;
 const realmEqual=typeof snap?.realm==='string'&&snap.realm===bot.p.realm();
 const kindOK=['gather.mining','gather.fishing'].includes(j.kind)&&j.cost===0&&j.loss===0&&Array.isArray(j.slots)&&j.slots.length===0;
 const earlier=sameLength?totals(before):null,later=sameLength?totals(after):null;
 const changes=[];
 let missing=false;
 if(earlier&&later){
  for(const id of new Set([...earlier.keys(),...later.keys()])){
   const old=earlier.get(id)?.quantity??0,newValue=later.get(id)?.quantity??0;
   if(old===newValue)continue;
   const item=earlier.get(id)??later.get(id);
   changes.push({item:itemLabel(item),before:old,after:newValue,delta:newValue-old,variant:id});
   if(newValue<old)missing=true;
  }
 }
 changes.sort((a,b)=>a.item.localeCompare(b.item));
 const losses=changes.filter(c=>c.delta<0);
 // Current report contains exactly two missing ordinary mpot0 potions. Allow
 // ONLY this tightly bounded, explicitly reviewed consumption discrepancy.
 // A changed rarity/lock/stat variant or loss of other goods is not eligible.
 const reviewedPotionLoss=losses.length===1&&losses[0].variant===PLAIN_MPOT0&&losses[0].delta>=-2;
 const unapprovedLoss=losses.length>0&&!reviewedPotionLoss;
 const pending=bot.exec?.pending?.size??0;
 const activity=j.kind==='gather.mining'?'mining':j.kind==='gather.fishing'?'fishing':null;
 const activeSkill=!!(activity&&bot.p.c.q?.[activity]);
 const eligible=!!(!bot.running&&pending===0&&bot.inventoryBlocked&&kindOK&&sameLength&&earlier&&later&&!unapprovedLoss&&goldEqual&&realmEqual&&!activeSkill);
 const token=eligible?JSON.stringify([j.kind,j.at??null,snap.realm,snap.gold,before,after]):null;
 const reason=!kindOK?'Nur offene, kostenfreie Gathering-Journale dürfen so geprüft werden':
  bot.running||pending>0?'Bot muss pausiert sein; kein Auftrag darf mehr laufen':
  activeSkill?'Gathering läuft noch; zunächst vollständig beenden':
  !sameLength||!earlier||!later?'Inventar-Snapshot fehlt oder ist nicht eindeutig lesbar':
  !realmEqual||!goldEqual?'Gold oder Realm unterscheiden sich vom Journal':
  unapprovedLoss?'Mindestens eine nicht freigegebene Itemvariante fehlt: keine manuelle Freigabe':
  !bot.inventoryBlocked?'Keine bestehende Inventarsperre':
  reviewedPotionLoss?'Bis zu zwei normale mpot0 fehlen. Nur nach eigenem Abgleich des Trankverbrauchs und aller anderen Items manuell freigeben; Mining-Erfolg unbekannt':
  changes.length?'Bestandszuwächse erkannt; nach menschlichem Abgleich kann das Journal ausdrücklich bestätigt werden':
  inventoryEqual?'Inventar und Gold unverändert; Mining-Erfolg weiterhin unbekannt':
  'Nur die Anordnung der Gegenstände hat sich geändert; manuelle Prüfung erforderlich';
 return {eligible,kind:j.kind,inventoryEqual,goldEqual,realmEqual,activeSkill,pending,
  changes,manualPotionLoss:reviewedPotionLoss?Math.abs(losses[0].delta):0,token,reason,comparison:{before,after},snapshotAt:j.at??null};
}
export function saveMiningAudit(p,audit){
 if(p.headless)return null;
 try{
  const win=p.parent,doc=win?.document;
  if(!doc?.body||!win.URL?.createObjectURL||!win.Blob)throw Error('Browser-Download nicht verfügbar');
  const filename='albot-mining-bestandspruefung-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json';
  const record={format:'albot-mining-manual-audit',createdAt:new Date().toISOString(),
   kind:audit.kind,eligible:audit.eligible,reason:audit.reason,
   inventoryEqual:audit.inventoryEqual,goldEqual:audit.goldEqual,realmEqual:audit.realmEqual,
   changes:audit.changes,manualPotionLoss:audit.manualPotionLoss??0,before:audit.comparison?.before,after:audit.comparison?.after,snapshotAt:audit.snapshotAt};
  const url=win.URL.createObjectURL(new win.Blob([JSON.stringify(record,null,2)],{type:'application/json;charset=utf-8'}));
  const link=doc.createElement('a');link.href=url;link.download=filename;doc.body.append(link);link.click();link.remove();
  win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);
  return filename;
 }catch(e){p.log('Mining-Bestandsprüfung konnte nicht gespeichert werden: '+(e.message??e));return null;}
}
