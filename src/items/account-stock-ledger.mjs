import {inventoryStockEvidence,reconcileStockEvidence} from './stock-evidence.mjs';
import {previewAccountStockPolicy} from './account-stock-policy.mjs';
// Phase 4 accounting is intentionally read-only. No combined remote snapshot
// can authorize item transfers, upgrades, bank actions or liquidation.
// The bank view is a SECOND physical source and must be verified as strictly
// as the peer heartbeats; its "complete" flag alone is never evidence.
const validStockName=v=>typeof v==='string'&&v.length>0&&v.length<=100;
const validCount=v=>Number.isSafeInteger(v)&&v>=0&&v<=10000000;
const variantFields=['stat_type','p','title','acc','rid','data'];
function physicalStockKey(item){
 if(!validStockName(item?.name)||!validCount(item?.level??0)||
    (item.level??0)>99)return null;
 for(const field of variantFields){
  const value=item[field];
  if(value===undefined||value===null)continue;
  if((field==='acc'||field==='rid')&&
     (typeof value==='string'&&value.length<=80||
      Number.isSafeInteger(value)&&value>=0))continue;
  if(typeof value!=='string'||value.length>(field==='data'?120:80))
   return null;
 }
 try{
  const key=JSON.stringify([item.name,item.level??0,
   ...variantFields.map(field=>item[field]??null)]);
  return typeof key==='string'&&key.length<=1024?key:null;
 }catch{return null;}
}
export function verifiedAccountBankView(bank,{owner,session,realm,map,now,ttlMs}={}){
 if(!bank||bank.version!==1||bank.complete!==true||
    bank.mode!=='shadow-only'||bank.authority!=='none'||
    bank.executable!==false||bank.scope!=='current-map-only'||
    !validStockName(owner)||!validStockName(session)||
    !validStockName(realm)||!validStockName(map)||
    bank.owner!==owner||bank.session!==session||
    bank.realm!==realm||bank.map!==map||
    !Number.isSafeInteger(now)||!validCount(ttlMs)||
    !Number.isSafeInteger(bank.at)||bank.at>now||
    now-bank.at>ttlMs||!Array.isArray(bank.rows)||
    bank.rows.length>128||!Array.isArray(bank.packs)||
    bank.packs.length<1||bank.packs.length>12)return false;
 const packs=new Set(),variants=new Set();
 for(const pack of bank.packs){
  if(!pack||typeof pack.name!=='string'||
     !/^items[0-9]+$/.test(pack.name)||packs.has(pack.name)||
     pack.map!==map||pack.size!==42||
     !Number.isSafeInteger(pack.used)||pack.used<0||pack.used>42)
   return false;
  packs.add(pack.name);
 }
 for(const row of bank.rows){
  const key=physicalStockKey(row?.item);
  if(!key||variants.has(key)||!validCount(row.quantity)||
     row.quantity<1||!validCount(row.protectedUnits)||
     !validCount(row.reservedUnits)||
     row.protectedUnits>row.quantity||
     row.reservedUnits>row.quantity)return false;
  variants.add(key);
 }
 return true;
}
export function accountPhysicalLedger({local,peers=[],bank=null,equipment={},
 journal=null,owner,session,realm,map=null,now=Date.now(),ttlMs=10000,
 reserved=()=>0,expected=[]}={}){
 const inventory=inventoryStockEvidence(local??[],{owner,session,realm,at:now,maxRows:32,allowOpaque:true,reserved});
 const localExpanded=inventory;
 const team=reconcileStockEvidence({local:inventory,peers,bank:[],owner,
  session,realm,now,ttlMs,expected});
 const bankCurrent=verifiedAccountBankView(bank,{
  owner,session,realm,map,now,ttlMs})?bank:null;
 // Equipped copies are physical account stock, but NEVER spendable.
 // Do not strip unique item identity (acc/rid/data) or drop nonempty slots
 // beyond a display cap: either the entire equipped view is represented,
 // or the account ledger explicitly reports incomplete physical evidence.
 const equipmentValid=!!equipment&&typeof equipment==='object'&&
  !Array.isArray(equipment);
 const equippedEntries=equipmentValid?Object.entries(equipment)
  .filter(([key,item])=>!key.startsWith('trade')&&
    !key.startsWith('cosmetic')&&item!=null):[];
 const invalidEquipment=!equipmentValid||equippedEntries.length>24||
  equippedEntries.some(([slot,item])=>typeof slot!=='string'||
   !slot||slot.length>100||!item||typeof item!=='object'||
   Array.isArray(item)||!physicalStockKey(item));
 const slots=invalidEquipment?[]:equippedEntries.map(([slot,item])=>{
  const signature={name:item.name,level:item.level??0};
  for(const field of variantFields)
   if(item[field]!==undefined)signature[field]=item[field];
  return {slot,item:signature,quantity:1,transferable:false};
 });
 const unresolved=!!journal||peers.some(h=>h?.journal||h?.reserved||
   h?.inventoryBlocked||h?.lifecycleChanging);
 const rows=new Map();let invalidAggregate=invalidEquipment;
 const add=(item,count,source,protectedUnits=0,reservedUnits=0)=>{
  const key=physicalStockKey(item);
  if(!key||!validCount(count)||!validCount(protectedUnits)||
     !validCount(reservedUnits)||protectedUnits>count){
   invalidAggregate=true;return;
  }
  const row=rows.get(key)??{item,quantity:0,protectedUnits:0,
   reservedUnits:0,locations:[]};
  if(!validCount(row.quantity+count)||
     !validCount(row.protectedUnits+protectedUnits)||
     !validCount(row.reservedUnits+reservedUnits)){
   invalidAggregate=true;return;
  }
  row.quantity+=count;row.protectedUnits+=protectedUnits;
  row.reservedUnits+=reservedUnits;row.locations.push(source);rows.set(key,row);
 };
 for(const source of team.sources){
  if(source.status!=='fresh')continue;
  // Source summaries in reconcileStockEvidence omit rows intentionally;
  // use validated local evidence or independently validated peer evidence.
  const evidence=source.owner===owner?localExpanded:
   peers.find(h=>h.name===source.owner&&h.session===source.session)?.inventoryEvidence;
  for(const row of evidence?.rows??[])add(row.item,row.quantity,
   {owner:source.owner,place:'inventory',at:evidence.at},
   row.protectedUnits,row.reservedUnits);
 }
 if(!team.sources.some(x=>x.owner===owner&&x.status==='fresh'))
  for(const row of localExpanded.complete?localExpanded.rows:[])add(row.item,
   row.quantity,{owner,place:'inventory-local-only',at:localExpanded.at},
   row.protectedUnits,row.reservedUnits);
 for(const row of bankCurrent?.rows??[])add(row.item,row.quantity,
  {owner,place:'bank-current-map',map:bankCurrent.map,at:bankCurrent.at},
  row.protectedUnits,0);
 for(const slot of slots)add(slot.item,1,{owner,place:'equipped',slot:slot.slot,at:now},1,0);
 const reasons=[...team.reasons];
 if(!inventory.complete)reasons.push('local-inventory-proof-incomplete');
 if(!localExpanded.complete)reasons.push('local-inventory-variant-unverified');
 if(!bankCurrent)reasons.push('bank-current-map-not-verified');
 if(unresolved)reasons.push('unresolved-transfer-or-value-journal');
 if(invalidEquipment)reasons.push('equipped-variant-evidence-incomplete');
 if(invalidAggregate)reasons.push('account-variant-aggregation-unverified');
 if(rows.size>120)reasons.push('account-variant-output-truncated');
 const quantities=invalidAggregate?[]:[...rows.values()].slice(0,120)
  .map(x=>({...x,
   freeEstimate:Math.max(0,x.quantity-x.protectedUnits-x.reservedUnits)}));
 return {version:1,mode:'shadow-only',authority:'none',executable:false,
  owner,session,realm,at:now,teamComplete:team.complete,
  bankScope:bankCurrent?'verified-current-map':'unverified-or-not-visible',
  coverage:{allBankPacks:false,reason:'off-map-bank-packs-not-authoritatively-observed'},
  transferUnresolved:unresolved,
  complete:team.complete&&!!bankCurrent&&!unresolved&&
   !invalidAggregate&&rows.size<=120,
  reasons:reasons.slice(0,16),sources:team.sources,
  equipped:slots,variants:quantities,
  bankPacks:bankCurrent?.packs?.map(p=>p.name)??[]};
}
export function createAccountStockLedger(bot){
 const {p,me}=bot;
 function snapshot(){
  const realm=p.realm(),now=Date.now();
  const names=[...new Set((bot.farmers??[]).concat(me.name))];
  if(bot.cfg.party?.merchant)names.push(bot.cfg.party.merchant);
  const peers=[...new Set(names)].filter(n=>n!==me.name)
   .map(n=>bot.transport?.fresh?.(n)??{name:n});
  return accountPhysicalLedger({local:p.c.items??[],peers,
   bank:bot.bank?.liveEvidence?.(),equipment:p.c.slots,
   journal:bot.journal,owner:me.name,session:bot.session,realm,
   map:p.c.map,now,
   ttlMs:bot.cfg.general?.messageTtlMs??10000,
   reserved:item=>bot.production?.reservedQuantity?.(item)??0,
   expected:peers.map(x=>x.name)});
 }
 return {snapshot,preview:(item,limits={})=>previewAccountStockPolicy({
  ledger:snapshot(),item:typeof item==='string'?{name:item,level:0}:item,
  ...limits
 })};
}
