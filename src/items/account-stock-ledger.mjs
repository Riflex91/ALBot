import {inventoryStockEvidence,reconcileStockEvidence} from './stock-evidence.mjs';
// Phase 4 accounting is intentionally read-only. No combined remote snapshot
// can authorize item transfers, upgrades, bank actions or liquidation.
export function accountPhysicalLedger({local,peers=[],bank=null,equipment={},
 journal=null,owner,session,realm,now=Date.now(),ttlMs=10000,
 reserved=()=>0,expected=[]}={}){
 const inventory=inventoryStockEvidence(local??[],{owner,session,realm,at:now,maxRows:32,allowOpaque:true,reserved});
 const localExpanded=inventory;
 const team=reconcileStockEvidence({local:inventory,peers,bank:[],owner,
  session,realm,now,ttlMs,expected});
 const bankCurrent=bank?.complete===true&&bank.owner===owner&&
  bank.session===session&&bank.realm===realm&&
  Number.isSafeInteger(bank.at)&&bank.at<=now&&now-bank.at<=ttlMs?
  bank:null;
 const slots=Object.entries(equipment??{}).filter(([key])=>
  !key.startsWith('trade')&&!key.startsWith('cosmetic')).slice(0,24)
  .map(([slot,item])=>item?.name&&typeof item.name==='string'?
   {slot,item:{name:item.name,level:item.level??0,
    stat_type:item.stat_type??'',p:item.p??'',title:item.title??''},
    quantity:1,transferable:false}:null).filter(Boolean);
 const unresolved=!!journal||peers.some(h=>h?.journal||h?.reserved||
   h?.inventoryBlocked||h?.lifecycleChanging);
 const rows=new Map();
 const add=(item,count,source,protectedUnits=0,reservedUnits=0)=>{
  if(!item?.name||!Number.isSafeInteger(count)||count<0)return;
  const key=JSON.stringify([item.name,item.level??0,
   item.stat_type??'',item.p??'',item.title??'',item.acc??null,
   item.rid??null,item.data??null]);
  const row=rows.get(key)??{item,quantity:0,protectedUnits:0,
   reservedUnits:0,locations:[]};
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
 const quantities=[...rows.values()].slice(0,120).map(x=>({
  ...x,freeEstimate:Math.max(0,x.quantity-x.protectedUnits-x.reservedUnits)}));
 return {version:1,mode:'shadow-only',authority:'none',executable:false,
  owner,session,realm,at:now,teamComplete:team.complete,
  bankScope:bankCurrent?'verified-current-map':'unverified-or-not-visible',
  transferUnresolved:unresolved,complete:team.complete&&!!bankCurrent&&!unresolved,
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
   journal:bot.journal,owner:me.name,session:bot.session,realm,now,
   ttlMs:bot.cfg.general?.messageTtlMs??10000,
   reserved:item=>bot.production?.reservedQuantity?.(item)??0,
   expected:peers.map(x=>x.name)});
 }
 return {snapshot};
}
