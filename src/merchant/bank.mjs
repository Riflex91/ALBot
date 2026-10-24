import {bankOperatingStockRule,bankOperatingReserveNeed} from '../items/operating-stock.mjs';
import {identity,fingerprint,variantCount} from '../core/policy.mjs';
import {inspectBankEvidence} from '../items/bank-evidence.mjs';
import {scanBankDispositionWindow} from './bank-disposition.mjs';
import {validReserveChain,reserveChainObservation} from './bank-reserve-chain.mjs';
import {verifiedProductionStockQuantity} from '../items/stock-policy.mjs';
import {validateBankReclaimRecord,classifyBankReclaimRecord,inspectOffsiteBankReclaim} from './bank-reclaim-recovery.mjs';
import {validateBankPartialRecord,classifyBankPartialRecord,partialDispatchDecision} from './bank-partial-recovery.mjs';
import {validateBankSingleRecord,classifyBankSingleRecord} from './bank-single-recovery.mjs';
import {validateBankStoreRecord,classifyBankStoreRecord} from './bank-store-recovery.mjs';
import {validateBankSwapRecord,classifyBankSwapRecord} from './bank-swap-recovery.mjs';
// Evaluate against live carried gold, never stale bank balances or a
// hypothetical future deposit. Keep the independent hourly/reserve budgets.
export function emergencyMaterialSaleAllowed(meta,price,quantity,maxUnitValue){
 return meta?.type==='material'&&Number.isSafeInteger(quantity)&&quantity>0&&quantity<=9999&&
  Number.isFinite(price)&&price>=0&&Number.isFinite(maxUnitValue)&&maxUnitValue>=0&&
  price<=maxUnitValue&&Number.isSafeInteger(price*quantity)&&price*quantity<=10000;
}
export function bankExpansionAffordable(cost,gold,staticBudget,fraction=.75){
 return Number.isFinite(cost)&&cost>0&&Number.isFinite(gold)&&gold>=0&&
   Number.isFinite(staticBudget)&&staticBudget>=cost&&
   Number.isFinite(fraction)&&fraction>=0&&fraction<=1&&
   cost<=Math.floor(gold*fraction);
}
// W03: an observed bank-gold transfer must account for ALL open buy-stand
// bids, with no rounding, coercion or overflow. This is planning evidence,
// never an authorization to call the game bank API by itself.
export function bankGoldTransferPlan({wallet,bankGold,slots={},goldTarget,
 goldReserve,characterReserve=0,purchaseMinimum=0}={}){
 const values=[wallet,bankGold,goldTarget,goldReserve,characterReserve,purchaseMinimum];
 if(values.some(v=>!Number.isSafeInteger(v)||v<0)||
    !slots||typeof slots!=='object'||Array.isArray(slots))return null;
 let committed=0;
 for(const [slot,bid] of Object.entries(slots)){
  if(!/^trade([1-9]|1[0-6])$/.test(slot)||!bid)continue;
  // A malformed buy flag cannot be silently interpreted as an offer.
  if(bid.b!==undefined&&typeof bid.b!=='boolean')return null;
  if(bid.b!==true)continue;
  // Only an ABSENT quantity represents an ordinary one-unit offer.
  // Explicit null is not evidence of a spendable (or reserved) unit.
  const price=bid.price,quantity=bid.q===undefined?1:bid.q;
  if(!Number.isSafeInteger(price)||price<1||
     !Number.isSafeInteger(quantity)||quantity<1||
     !Number.isSafeInteger(price*quantity)||
     !Number.isSafeInteger(committed+price*quantity))return null;
  committed+=price*quantity;
 }
 const reserve=Math.max(goldTarget,goldReserve,characterReserve),
  target=Math.max(reserve+committed,purchaseMinimum);
 if(!Number.isSafeInteger(target)||wallet===target)return null;
 const depositing=wallet>target;
 const quantity=depositing?wallet-target:Math.min(target-wallet,bankGold);
 if(!Number.isSafeInteger(quantity)||quantity<=0)return null;
 return {method:depositing?'bank_deposit':'bank_withdraw',
  quantity,target,committed};
}

// Every bank pack keeps its own workspace reserve. Summing free slots
// across different packs can report usable capacity when NONE of the packs
// can accept one more regular deposit.
export function bankCapacityPressure(rows,workspace=2,localMap=null,G=null){
 const denied=()=>({pressed:false,locallyBlocked:false,usablePacks:0});
 if(!Array.isArray(rows)||rows.length>16||
    !Number.isSafeInteger(workspace)||workspace<0||workspace>42||
    typeof localMap!=='string'||!localMap||
    G!==null&&(!G?.items||typeof G.items!=='object'))
  return denied();
 const observed=[];
 for(const row of rows){
  // Every opened local/remote pack needs physical evidence before any
  // irreversible sale; unknown map/shape must never be silently ignored.
  if(!row||typeof row.map!=='string'||!row.map||
     !Array.isArray(row.items)||row.items.length>42)return denied();
  let occupied=0;
  for(const item of row.items){
   if(item===null||item===undefined)continue;
   if(typeof item!=='object'||Array.isArray(item)||
      typeof item.name!=='string'||!item.name)return denied();
   const q=item.q===undefined?1:item.q;
   if(!Number.isSafeInteger(q)||q<1)return denied();
   if(G!==null){
    const meta=G.items[item.name];
    if(!meta&&q!==1)return denied();
    if(meta){
     if(typeof meta!=='object')return denied();
     const size=meta.s,limit=size===true?9999:
      Number.isSafeInteger(size)&&size>1?size:1;
     if(q>limit)return denied();
    }
   }
   occupied++;
  }
  // Adventure Land compact arrays still describe all 42 normal bank slots.
  observed.push({map:row.map,free:42-occupied});
 }
 const usablePacks=observed.filter(row=>row.free>workspace).length;
 const local=observed.filter(row=>row.map===localMap);
 return {pressed:local.length>0&&usablePacks===0,
  locallyBlocked:local.length>0&&local.every(row=>row.free<=workspace),
  usablePacks};
}
// A revoked/not-reproducible emergency sale can be rolled back by storing
// the exact retrieved, unmodified stack into the SAME empty bank slot.
// Never guess a slot or clear the checkpoint on incomplete evidence.
export function reclaimRollbackEvidence(record,carried,bankSlot,bankCount,G=null){
 const meta=G?.items?.[record?.item?.name];
 const max=meta?.s===true?9999:
  Number.isSafeInteger(meta?.s)&&meta.s>1?meta.s:1;
 if((G&&!meta)||!record?.item||!Number.isSafeInteger(record.before)||
    !Number.isSafeInteger(record.quantity)||record.quantity<=0||
    !Number.isSafeInteger(record.bankBefore)||record.bankBefore<record.quantity||
    !carried||bankSlot!==null||
    identity(carried)!==identity(record.item)||
    (carried.q===undefined?1:carried.q)!==record.quantity||
    (record.item.q===undefined?1:record.item.q)!==record.quantity||
    (G&&record.quantity>max)||
    !Number.isSafeInteger(bankCount)||
    bankCount!==record.bankBefore-record.quantity)
  return false;
 return true;
}
export function createBank(bot){
 const {p,cfg,me}=bot,e=bot.economy;
 const pendingKey='albot:bank-partial:'+me.name;let pending=p.read(pendingKey)??null;
 const reclaimKey='albot:bank-reclaim:'+me.name;let reclaiming=p.read(reclaimKey)??null;
 const singleKey='albot:bank-single:'+me.name;let single=p.read(singleKey)??null;
 const storeKey='albot:bank-store:'+me.name;let storing=p.read(storeKey)??null;
 const swapKey='albot:bank-swap:'+me.name;let swapping=p.read(swapKey)??null;
 const chainKey='albot:bank-reserve-chain:'+me.name;
 let reserveChain=p.read(chainKey)??null;
 if(reserveChain&&!validReserveChain(reserveChain,{
  owner:me.name,realm:p.realm(),now:Date.now()})){
  bot.inventoryBlocked=true;
  e.note('Bankreserve: ungültige persistente Folge; manuell prüfen');
 }
 function saveReserveChain(value){
  if(p.write(chainKey,value)!==true){
   bot.inventoryBlocked=true;e.note('Bankreserve: Folgejournal nicht gespeichert');
   return false;
  }
  reserveChain=value;return true;
 }
 // A reserve-chain write is a cursor, not game-action authorization.
 // The existing exact bank value journal is additionally mandatory.
 function prepareReserveChainDispatch(r){
  if(!r.reserveStage)return true;
  const variant=identity(r.item),floor=r.reserveStage.floor,
   take=r.take??r.quantity,quantity=r.item.q??1,
   slot=r.bankSlot??r.slot,now=Date.now(),old=reserveChain;
  if(old?.phase==='prepared'){
   const a=old.source;
   return validReserveChain(old,{owner:me.name,realm:p.realm(),now})&&
    old.variant===variant&&old.floor===floor&&old.carried===r.before&&
    a.pack===r.pack&&a.slot===slot&&a.before===r.sourcePrint&&
    a.held===r.before&&a.take===take;
  }
  if(old&&(!validReserveChain(old,{owner:me.name,realm:p.realm(),now})||
     old.phase!=='ready'||old.floor!==floor||old.variant!==variant||
     old.carried!==r.before||old.steps>=16))return false;
  const candidate={version:1,owner:me.name,realm:p.realm(),
   variant,item:{...r.item},floor,carried:r.before,
   steps:old?.steps??0,started:old?.started??now,updated:now,
   phase:'prepared',source:{pack:r.pack,slot,before:r.sourcePrint,
    after:take===quantity?null:fingerprint({...r.item,q:quantity-take}),
    held:r.before,take,quantity}};
  return validReserveChain(candidate,{owner:me.name,realm:p.realm(),now})&&
   saveReserveChain(candidate);
 }
 function markReserveChainDispatch(r){
  if(!r.reserveStage)return true;
  if(!reserveChain||reserveChain.phase!=='prepared'||
     reserveChain.source.before!==r.sourcePrint)return false;
  return saveReserveChain({...reserveChain,phase:'dispatched',
   updated:Date.now()});
 }
 const crossToken=Symbol();
 const pressureKey='albot:bank-pressure:'+me.name;
 let pressure=p.read(pressureKey)??{observations:0,epoch:null,at:0};
 if(!Number.isInteger(pressure.observations)||!Number.isFinite(pressure.at))pressure={observations:0,epoch:null,at:0};
 const validPending=r=>validateBankPartialRecord(r,{
  owner:me.name,realm:p.realm?.()??''}).valid;
 if(pending&&!validPending(pending)){
  bot.inventoryBlocked=true;e.note('Bank-Teilentnahme: alter oder ungültiger Checkpoint; Bestand prüfen');
 }
 if(reclaiming&&!validateBankReclaimRecord(reclaiming,{owner:me.name,realm:p.realm(),G:p.G}).valid){
  bot.inventoryBlocked=true;e.note('Bankfreigabe: altes oder ungültiges Journal; Wertaktionen gesperrt');
 }
 // Two independent bank value intents must never be interpreted as one
 // recoverable sequence. Neither journal is safe to clear without an
 // independent server receipt; reject even if both individually look valid.
 if(single&&!validateBankSingleRecord(single,{
   owner:me.name,realm:p.realm()}).valid){
  bot.inventoryBlocked=true;e.note('Bankentnahme: ungültiges Einzeljournal; Bestand prüfen');
 }
 if(storing&&!validateBankStoreRecord(storing,{owner:me.name,realm:p.realm()}).valid){
  bot.inventoryBlocked=true;e.note('Bankeinlagerung: ungültiges Journal');
 }
 if(swapping&&!validateBankSwapRecord(swapping,{owner:me.name,realm:p.realm()}).valid){
  bot.inventoryBlocked=true;e.note('Bank-Swap: ungültiges Journal');
 }
 if([pending,reclaiming,single,storing,swapping].filter(Boolean).length>1){
  bot.inventoryBlocked=true;
  e.note('Bankkonflikt: mehrere Bankwertjournale; manuell prüfen');
 }
 function savePending(value){
  if(value&&(reclaiming||single||storing||swapping)){
   bot.inventoryBlocked=true;
   e.note('Bankkonflikt: neues Teilentnahme-Journal bei aktivem Bankverkauf verweigert');
   return false;
  }
  if(!p.write(pendingKey,value)){
   bot.inventoryBlocked=true;e.note('Bank-Teilentnahme: Checkpoint nicht gespeichert');
   return false;
  }
  pending=value;return true;
 }
 function saveSingle(value){
  if(value&&(pending||reclaiming||single||storing||swapping)){
   bot.inventoryBlocked=true;
   e.note('Bankentnahme: konkurrierendes Bankjournal; kein neuer Abruf');
   return false;
  }
  if(p.write(singleKey,value)!==true){
   bot.inventoryBlocked=true;
   e.note('Bankentnahme: Einzeljournal nicht speicherbar');
   return false;
  }
  single=value;return true;
 }
 function saveStore(value){
  if(value&&(pending||reclaiming||single||storing||swapping)){
   bot.inventoryBlocked=true;e.note('Bankeinlagerung: konkurrierendes Journal');
   return false;
  }
  if(p.write(storeKey,value)!==true){
   bot.inventoryBlocked=true;e.note('Bankeinlagerung: Journal nicht gespeichert');
   return false;
  }
  storing=value;return true;
 }
 function saveSwap(value){
  if(value&&(pending||reclaiming||single||storing||swapping)){
   bot.inventoryBlocked=true;e.note('Swap: Journal-Konflikt');
   return false;
  }
  if(p.write(swapKey,value)!==true){
   bot.inventoryBlocked=true;e.note('Swap: Speichern fehlgeschlagen');
   return false;
  }
  swapping=value;return true;
 }
 function swapEvidence(r){
  return classifyBankSwapRecord(r,{owner:me.name,realm:p.realm(),
   bank:p.c?.bank,map:p.c?.map,packMap});
 }
 function recoverSwap(){
  if(!swapping)return false;
  if(pending||reclaiming||single||storing){
   bot.inventoryBlocked=true;e.note('Bankkonflikt: Swap-Journal');
   return true;
  }
  if(bot.journal||bot.exec?.busy?.('inventory')||
     bot.exec?.frame?.some?.(x=>x.resources?.includes?.('inventory')))return true;
  const phase=swapEvidence(swapping).phase;
  if(phase==='unobserved'){ready(swapping.pack,true);return true;}
  if(['prepared-unchanged','merged-a','merged-b'].includes(phase)){
   if(!saveSwap(null))bot.inventoryBlocked=true;
   return true;
  }
  bot.inventoryBlocked=true;
  e.note('Swap: unbestätigt ('+phase+')');
  return true;
 }
 function storeEvidence(r){
  return classifyBankStoreRecord(r,{owner:me.name,realm:p.realm(),
   inventory:p.c?.items,bank:p.c?.bank,map:p.c?.map,packMap});
 }
 function recoverStore(){
  if(!storing)return false;
  if(pending||reclaiming||single){
   bot.inventoryBlocked=true;e.note('Bankkonflikt: mehrere Bankwertjournale');
   return true;
  }
  if(bot.journal||bot.exec?.busy?.('inventory')||
     bot.exec?.frame?.some?.(x=>x.resources?.includes?.('inventory')))return true;
  const phase=storeEvidence(storing).phase;
  if(phase==='unobserved'){ready(storing.pack,true);return true;}
  if(phase==='prepared-unchanged'||phase==='stored'){
   if(!saveStore(null))bot.inventoryBlocked=true;
   return true;
  }
  bot.inventoryBlocked=true;
  e.note('Bankeinlagerung: Serverausgang unklar ('+phase+'); manuell prüfen');
  return true;
 }
 function singleEvidence(r){
  return classifyBankSingleRecord(r,{
   owner:me.name,realm:p.realm(),inventory:p.c.items,
   bank:p.c.bank,map:p.c.map,packMap});
 }
 function recoverSingle(){
  if(!single)return false;
  if(pending||reclaiming){
   bot.inventoryBlocked=true;e.note('Bankkonflikt: parallele Wertjournale; keine Einzelentnahme');
   return true;
  }
  if(bot.journal||bot.exec?.busy?.('inventory')||
     bot.exec?.frame?.some?.(x=>x.resources?.includes?.('inventory')))return true;
  const state=singleEvidence(single);
  if(state.phase==='unobserved'){
   ready(single.pack,true); // no off-map bank source can prove a withdrawal
   return true;
  }
  if(state.phase==='prepared-unchanged'||state.phase==='withdrawn'){
   if(p.write(singleKey,null)===true)single=null;
   else{
    bot.inventoryBlocked=true;e.note('Bankentnahme: belegtes Journal nicht löschbar');
   }
   return true;
  }
  bot.inventoryBlocked=true;
  e.note('Bankentnahme: API-Ergebnis unklar ('+state.phase+'); manuell prüfen');
  return true;
 }
 function partialEvidence(r){
  return classifyBankPartialRecord(r,{
   owner:me.name,realm:p.realm?.()??'',inventory:p.c?.items,
   bank:p.c?.bank,map:p.c?.map,packMap});
 }
 // A partial reserve staging intent is verified against a live LOCAL
 // bank pack, still-missing physical floor and unchanged explicit policy.
 // Only the FIRST dispatch requires the policy; once withdrawn, finishing
 // split/return is necessary even if the user changes a rule.
 function reserveStageAllowed(r){
  if(!r.reserveStage||cfg.merchant.bank!==true||
     cfg.merchant.bankReclaim!==true||
     cfg.merchant.preventiveStorage!==true||
     cfg.merchant.partialBank!==true||
     !bot.running||me.name!==cfg.party.merchant||
     !p.c.bank||packMap(r.pack)!==p.c.map||bot.free()<2)
   return false;
  const live=p.c.bank[r.pack]?.[r.bankSlot],
   need=bankOperatingReserveNeed(bot,live);
  if(!live||fingerprint(live)!==r.sourcePrint||
     identity(live)!==r.reserveStage.variant||
     !need||need.floor!==r.reserveStage.floor||
     r.take>need.missing)return false;
  const bankHeld=observedLocalReserveStock(live);
  return bankHeld!==null&&Number.isSafeInteger(need.held+bankHeld)&&
   need.held+bankHeld>need.floor;
 }
 function partialReady(r,phase){
  return pending===r&&partialEvidence(r).phase===phase&&
   partialDispatchDecision(r,phase).allowed&&
   typeof bot.session==='string'&&!!bot.session&&
   (!r.reserveStage||phase!=='original'||reserveStageAllowed(r));
 }
 function callPartialStep(r,phase,invoke){
  // Guard again at the actual API dispatch. A persisted receipt is
  // mandatory before any bank_retrieve / split / bank_store request.
  if(!partialReady(r,phase)){
   bot.inventoryBlocked=true;
   throw Error('Bank-Teilentnahme: Ausgangszustand vor API-Aufruf unklar');
  }
  if(phase==='original'&&r.reserveStage&&!prepareReserveChainDispatch(r)){
   bot.inventoryBlocked=true;
   throw Error('Bankreserve: Teilentnahme-Folge nicht belegbar');
  }
  const next={...r,dispatches:[...r.dispatches,{
   phase,session:bot.session,at:Date.now(),realm:r.realm,pack:r.pack,
   bankSlot:r.bankSlot,dest:r.dest,splitSlot:r.splitSlot,
   sourcePrint:r.sourcePrint}]};
  if(!validPending(next)||!savePending(next)){
   bot.inventoryBlocked=true;
   throw Error('Bank-Teilentnahme: Dispatch-Beleg konnte nicht dauerhaft gespeichert werden');
  }
  if(phase==='original'&&r.reserveStage&&!markReserveChainDispatch(r)){
   bot.inventoryBlocked=true;
   throw Error('Bankreserve: Teilentnahme-Dispatchfolge unklar');
  }
  return invoke();
 }
 function recover(){
  if(swapping)return recoverSwap();
   if(storing)return recoverStore();
   if(single)return recoverSingle();
  if(!pending)return false;
  if(reclaiming){
   bot.inventoryBlocked=true;
   e.note('Bankkonflikt: mehrere offene Wertjournale; keine Teilentnahme');
   return true;
  }
  if(bot.inventoryBlocked||bot.journal||!bot.running||
     bot.logistics?.reserved||bot.exec?.busy?.('inventory')||
     bot.exec?.frame?.some?.(x=>x.resources?.includes?.('inventory')))
   return true;
  if(!validPending(pending)){
   bot.inventoryBlocked=true;e.note('Bank-Teilentnahme: ungültiger Checkpoint');
   return true;
  }
  const r=pending;
  if(!ready(r.pack,true))return true;
  const evidence=partialEvidence(r);
  if(evidence.phase==='invalid'||evidence.phase==='ambiguous'){
   bot.inventoryBlocked=true;
   e.note('Bank-Teilentnahme: adressierte Slots nicht belegbar; manuell prüfen');
   return true;
  }
  if(evidence.phase==='unobserved'){
   e.note('Bank-Teilentnahme: aktuelle Quellbank fehlt; keine Wiederholung');
   return true;
  }
  const permission=partialDispatchDecision(r,evidence.phase);
  if(!permission.allowed){
   bot.inventoryBlocked=true;
   e.note('Bank-Teilentnahme: unquittierter oder alter Dispatch ('+
    permission.reason+'); manuell prüfen');
   return true;
  }
  if(evidence.phase==='returned'){
   if(savePending(null))
    bot.event?.('bank.partial.complete',{
     item:r.item.name,quantity:r.take,returned:r.total-r.take});
   return true;
  }
  // Nothing was dispatched and BOTH before-images still match. A changed
  // keep rule may safely cancel this prepared reserve without stranding a
  // bank journal. After any dispatch, never guess or retry an uncertain API.
  if(r.reserveStage&&evidence.phase==='original'&&
     r.dispatches.length===0&&!reserveStageAllowed(r)){
   if(!savePending(null))bot.inventoryBlocked=true;
   return true;
  }
  // No already queued or unresolved value operation: the NEXT real step is
  // proven by its exact currently addressed predecessor snapshot. Guards
  // repeat that proof immediately at executor dispatch.
  const actions={
   original:()=>{
    return e.perform('bank.partial.retrieve',{
     guard:()=>partialReady(r,'original'),
     call:()=>callPartialStep(r,'original',()=>
      p.call('bank_retrieve',r.pack,r.bankSlot,r.dest)),
     observe:()=>partialEvidence(r).phase==='withdrawn',
     details:{item:r.item.name,quantity:r.total,pack:r.pack,before:r.before}});
   },
   withdrawn:()=>{
    // Split requires a true extra physical destination. In Adventure Land
    // the split operation uses the first empty slot.
    if(bot.free()<1||p.c.items.findIndex(i=>!i)!==r.splitSlot)return false;
    return e.perform('bank.partial.split',{slots:[r.dest],
     guard:()=>bot.free()>0&&p.c.items.findIndex(i=>!i)===r.splitSlot&&
      partialReady(r,'withdrawn'),
     call:()=>callPartialStep(r,'withdrawn',()=>
      p.call('split',r.dest,r.take)),
     observe:()=>partialEvidence(r).phase==='split',
     details:{item:r.item.name,quantity:r.take,pack:r.pack}});
   },
   split:()=>{
    return e.perform('bank.partial.return',{slots:[r.dest],
     guard:()=>partialReady(r,'split'),
     call:()=>callPartialStep(r,'split',()=>
      p.call('bank_store',r.dest,r.pack,r.bankSlot)),
     observe:()=>partialEvidence(r).phase==='returned',
     details:{item:r.item.name,quantity:r.total-r.take,pack:r.pack}});
   }
  };
  const phase=evidence.phase;
  if(!actions[phase]){
   bot.inventoryBlocked=true;e.note('Bank-Teilentnahme: unbekannte Phase; Wertaktionen gesperrt');
   return true;
  }
  actions[phase]();
  return true;
 }
 let observed=false,stockRows=[],packEpoch=-1,packCache=null,stockObservedAt=0,stockObservedMap=null;
 const catalogKey='albot:bank-catalog:v1:'+me.name;
 const stored=p.read(catalogKey),realm=p.realm?.()??'';
 let catalog=stored?.version===1&&stored.owner===me.name&&stored.realm===realm&&
   Number.isSafeInteger(stored.observedAt)&&stored.observedAt>0&&
   stored.observedAt<=Date.now()&&Array.isArray(stored.rows)&&stored.rows.length<=512?
   stored:{version:1,owner:me.name,realm,observedAt:0,revision:0,rows:[]};
 let lastVerifiedFingerprint=null,lastAtBank=false;
 // Reloaded stock is planning evidence only. Never authorize a bank mutation
 // against this catalog: retrieve/store still demand a live pack/slot.
 function catalogStock(maxAge=120000){
  if(catalog.realm!==(p.realm?.()??'')||Date.now()-catalog.observedAt>maxAge||
     catalog.observedAt<=0||bot.inventoryBlocked)return [];
  return catalog.rows.filter(x=>x&&typeof x.pack==='string'&&Number.isSafeInteger(x.slot)&&
   x.slot>=0&&x.item&&e.safe(x.item)).map(x=>({...x,owner:me.name,
    evidence:{observedAt:catalog.observedAt,revision:catalog.revision,verified:false}}));
 }

 // Server-approved plain stack candidates; require an exact item variant.
 const stackMax=i=>{const limit=bot.p.G.items?.[i?.name]?.s;return limit===true?9999:Number.isSafeInteger(limit)&&limit>1?limit:0;};
 const simple=i=>e.safe(i)&&stackMax(i)>1&&!i.data&&!i.p&&!i.title&&!i.stat_type&&!i.acc&&!i.rid&&!i.special&&!i.v;
 function consolidateInventory(){
  if(bot.journal||bot.inventoryBlocked||bot.logistics?.reserved)return false;
  for(let a=0;a<p.c.items.length;a++)for(let b=a+1;b<p.c.items.length;b++){
   const x=p.c.items[a],y=p.c.items[b],qa=x?.q??1,qb=y?.q??1;
   if(!simple(x)||!simple(y)||identity(x)!==identity(y)||!Number.isSafeInteger(qa)||!Number.isSafeInteger(qb)||qa<1||qb<1||qa+qb>stackMax(x))continue;
   // Do not re-merge a bank-split sibling queued for storage.
   const bankPart=([a,b]).some(slot=>{
    const item=p.c.items[slot],rule=e.rules?.(item,'inventory')??e.rules?.(item);
    return rule?.action==='bank'&&e.spare(slot,rule)===(item?.q??1);
   });
   if(bankPart)continue;
   const fa=fingerprint(x),fb=fingerprint(y),total=qa+qb;
   return e.perform('inventory.consolidate',{slots:[a,b],
    guard:()=>fingerprint(p.c.items[a])===fa&&fingerprint(p.c.items[b])===fb,
    call:()=>p.call('swap',a,b),
    observe:()=>identity(p.c.items[a])===identity(x)&&p.c.items[a]?.q===total&&!p.c.items[b],
    details:{item:x.name,quantity:total,from:b,to:a}});
  }
  return false;
 }
 const packs=()=>{
  // Live bank arrays may change between planner epochs after a confirmed
  // transaction. Never reuse slot snapshots for authoritative mutations.
  const rows=Object.entries(p.c.bank??{}).filter(([name,items])=>/^items\d+$/.test(name)&&
   Array.isArray(items)).map(([name,items])=>[name,Array.from({length:Math.max(42,items.length)},
    (_,n)=>items[n]??null)]);
  // Normalize compact empty packs; off-map reads never refresh evidence.
  const live=rows.length>0&&rows.some(([pack])=>packMap(pack)===p.c.map)&&
   !bot.inventoryBlocked&&!bot.journal;
  if(!live)lastAtBank=false;
  if(live){
   const current=rows.flatMap(([pack,items])=>packMap(pack)===p.c.map?
    items.flatMap((item,slot)=>item&&e.safe(item)?[{pack,slot,item:{...item}}]:[]):[]).slice(0,512);
   const fingerprintNow=JSON.stringify(rows.filter(([pack])=>packMap(pack)===p.c.map)
    .map(([pack,items])=>[pack,items.map(item=>item?fingerprint(item):null)]));
   const liveGold=Number.isSafeInteger(p.c.bank?.gold)&&p.c.bank.gold>=0?p.c.bank.gold:null;
   if(!lastAtBank||fingerprintNow!==lastVerifiedFingerprint||catalog.gold!==liveGold||Date.now()-catalog.observedAt>120000){
    // New verified visit or a server-observable bank state revision.
    const next={version:1,owner:me.name,realm:p.realm?.()??'',observedAt:Date.now(),gold:liveGold,
     revision:(catalog.revision??0)+1,rows:current,capacity:rows.map(([pack,items])=>({pack,map:packMap(pack),size:items.length,free:items.filter(i=>!i).length}))};
    // Verified in-session evidence is useful even in a minimal or readonly
    // client; persistence is best effort and never grants mutation authority.
    catalog=next;observed=true;
    stockObservedAt=next.observedAt;stockObservedMap=p.c.map;
    stockRows=current.filter(x=>e.explicit?.(x.item)?.action!=='keep');
    p.write?.(catalogKey,next);
    lastVerifiedFingerprint=fingerprintNow;
   }
   lastAtBank=true;
  }
  packEpoch=bot.decisionEpoch;packCache=rows;return rows;
 };
 const stock=(name,level,wanted=Infinity)=>{
  packs();
  return catalogStock().reduce((n,r)=>n+(r.item.name===name&&
   (r.item.level??0)===level&&e.explicit?.(r.item)?.action!=='keep'&&
   (cfg.merchant.partialBank||(r.item.q??1)<=wanted)?(r.item.q??1):0),0);
 };
 const packFor=item=>{packs();return catalogStock().find(r=>
   identity(r.item)===identity(item)&&e.explicit?.(r.item)?.action!=='keep')?.pack??null;};
 const definitions=()=>p.G?.bank_packs??p.root?.bank_packs??p.parent?.bank_packs??{};
 const packMap=pack=>definitions()[pack]?.[0]??(/^items[0-7]$/.test(pack)?'bank':null);
 // W04: use ALL currently visible same-realm local bank packs for backing,
 // not just the source pack's immutable before-image. This is a read-only
 // check, never an account-wide authorization or a replacement for receipts.
 // A malformed matching stack cannot help establish sellable excess.
 function observedLocalReserveStock(item){
  const variant=identity(item);
  if(!variant)return null;
  let total=0,localPacks=0;
  for(const [pack,items] of packs()){
   if(packMap(pack)!==p.c.map)continue;
   // A second pack can change after the bounded disposition scan. Do not
   // treat a malformed 43+ slot pack as backing for a queued full/partial
   // reserve withdrawal, even when the addressed source pack is unchanged.
   if(items.length>42)return null;
   localPacks++;
   for(const held of items){
    if(!held||identity(held)!==variant)continue;
    // Only an absent q represents an unstacked single item. Explicit
    // null must not be counted as reserve backing for a later sale.
    const q=held.q===undefined?1:held.q;
    if(!e.safe(held)||!Number.isSafeInteger(q)||q<1||
       q>stackMax(held)||!Number.isSafeInteger(total+q))return null;
    total+=q;
   }
  }
  return localPacks?total:null;
 }
 // W04: finish a reserve with a single ordinary full stack when split is
 // disabled. This is ONLY an automatic, NPC-replaceable working-stock path:
 // an explicit keep/maxCount/batch is never relaxed for an overfill.
 // The existing durable single/partial withdrawal journal remains the
 // mandatory authorization and recovery mechanism for each physical step.
 function reserveStagingTake(item,need){
  if(!need||!Number.isSafeInteger(need.floor)||need.floor<1||
     !Number.isSafeInteger(need.held)||!Number.isSafeInteger(need.missing)||
     need.missing<1)return null;
  const q=item?.q===undefined?1:item?.q;
  if(!Number.isSafeInteger(q)||q<1)return null;
  const source=e.explicit(item,'inventory');
  const partial=q>need.missing&&cfg.merchant.partialBank===true&&
    bot.free()>=2&&q<=(cfg.merchant.partialBankMaxStack??9999);
  let take=q;
  if(partial)take=need.missing;
  else if(q>need.missing){
   // A full final stack can exceed the missing reserve, but not the
   // entire bounded floor; the excess remains physically carried and
   // is subject to normal inventory-surplus disposition.
   if(cfg.merchant.partialBank===true||source||
      q>need.floor)return null;
  }
  if(source&&(!Number.isSafeInteger(source.batch)||
     source.batch<take))return null;
  return {take,extra:Math.max(0,take-need.missing)};
 }
 const location=map=>({map,in:map,x:0,y:-100,radius:80});
 function ready(pack='items0',recovery=false){const map=packMap(pack);return !!map&&(cfg.merchant.bank||recovery)&&me.name===cfg.party.merchant&&e.travel(location(map),'Bank')&&!!p.c.bank;}
 // Non-destructive capacity parking is a private, single-operation bank path.
 // Speculative production reservations remain intact: no sale, split or release.
 // The live bank destination and original item fingerprint are rechecked at dispatch.
 function parkable(slot){
  const item=p.c.items?.[slot],meta=p.G.items?.[item?.name];
  if(!cfg.merchant.bank||!cfg.production?.autoDisposition||!e.safe(item)||
     // The private emergency park route must never move an exchange source
     // away from the NPC production hub merely because a market plan is active.
     // Only the ordinary explicit bank rule can deliberately store it.
     (Number.isSafeInteger(meta?.e)&&meta.e>0)||
     !meta||!['ring','earring','belt','amulet','helmet','chest','pants','shoes','gloves',
      'cape','orb','weapon','shield','source','quiver','misc_offhand','material'].includes(meta.type)||
     e.explicit(item)||e.explicit(item,'production')||e.explicit(item,'acquisition')||
     item.data!==undefined||item.acc||item.rid||item.p||item.title||item.stat_type||
     item.skin||item.special||item.expires||item.v||
     !Number.isSafeInteger(item.q??1)||(item.q??1)<1)return false;
  // Do not shuttle the inputs of the very production step currently executing.
  const steps=bot.production?.status?.()?.steps??[];
  return !steps.some(s=>s.item===item.name&&(s.level??0)===(item.level??0));
 }
 function park(slot){
  if(!parkable(slot))return false;
  const item=p.c.items[slot],q=item.q??1;
  const rule={name:'Bankentlastung '+item.name,item:item.name,action:'bank',
   enabled:true,batch:q,keep:0,teamReserve:0,maxActions:0,
   goldBudget:0,lossBudget:0,_capacityRecovery:true};
  return store(slot,rule,true);
 }
 function store(slot,r,parking=false){
  if(swapping)return recoverSwap();
  if(storing)return recoverStore();
  if(pending||reclaiming||single){
   bot.inventoryBlocked=true;e.note('Bankeinlagerung: Bankjournal-Konflikt');return false;
  }
  const item=p.c.items[slot],parkVerified=parking&&parkable(slot);
  if(!e.safe(item)||(!parkVerified&&e.spare(slot,r)<1))return false;
  const allowed=parkVerified?(item.q??1):e.spare(slot,r);if(allowed<(item.q??1)){
   // A prior split already created a wholly storable sibling. Finish that
   // bank deposit first; never split the 131 remainder again while 100 is
   // waiting in slot 26. The delegated store retains live server checks.
   const sibling=p.c.items.findIndex((candidate,index)=>index!==slot&&
    simple(candidate)&&identity(candidate)===identity(item)&&
    Number.isSafeInteger(candidate.q)&&candidate.q>0&&
    candidate.q<=allowed&&e.spare(index,r)===candidate.q);
   if(sibling>=0)return store(sibling,r,parking);
   if(bot.free()<1){e.note('Bank-Split '+item.name+': ein physisch freier Inventarplatz benötigt');return false;}const before=item.q,dest=p.c.items.findIndex(x=>!x);
   return e.perform('bank.split',{slots:[slot],rule:r,guard:()=>bot.free()>0&&!p.c.items[dest]&&e.spare(slot,r)>=allowed,call:()=>p.call('split',slot,allowed),observe:()=>p.c.items[slot]?.q===before-allowed&&p.c.items.some((x,n)=>n!==slot&&identity(x)===identity(item)&&x.q===allowed),details:{item:item.name,quantity:allowed,before}});
  }
  const rows=packs(),workspace=parkVerified?0:(cfg.merchant.bankWorkspace??0);
  // A merely empty slot is NOT available to ordinary stores if using it
  // would eat into the configured bank workspace. Select from opened packs
  // that can actually receive a whole stack; stay on the current bank map
  // when equivalent destinations are already reachable here.
  const eligible=rows.filter(([pack,items])=>(!r.pack||r.pack===pack)&&
    !!packMap(pack)&&items.filter(i=>!i).length>workspace);
  // Full or workspace-reserved packs are not destinations. Never leave
  // an upgrade NPC merely to re-observe the same full bank. While physically
  // at the bank, reversible consolidation/expansion/reclaim remain available.
  const preferred=eligible.find(([pack])=>packMap(pack)===p.c.map)?.[0]||
    eligible[0]?.[0]||null;
  if(!preferred){
   if(p.c.map!=='bank')return false;
   if(consolidate()||!r.pack&&expand()||reclaim())return true;
   e.note('Bank voll: kein belegter freier Ablageplatz; keine weitere Bankfahrt');
   return false;
  }
  if(!ready(preferred))return false;
  for(const [pack,items] of packs()){
   if((r.pack&&r.pack!==pack)||packMap(pack)!==p.c.map)continue;
   // Adventure Land bank_store to an occupied slot can SWAP the stacks, not
   // combine them. Never dispatch against an occupied bank slot: the observed
   // live failure returned the previous bank stack to the inventory source.
   // The configured bank workspace is a preference, not a prohibition on
   // reversible emergency parking. Only a private verified park may use it.
   const workspace=parkVerified?0:(cfg.merchant.bankWorkspace??0);
   const dest=items.findIndex(i=>!i);if(dest<0||items.filter(i=>!i).length<=workspace)continue;
   const before=e.count(item),bankBefore=variantCount(items,item),q=item.q??1;
   const targetPrint=fingerprint(p.c.bank[pack][dest]);
   const targetBefore=p.c.bank[pack][dest];
   const targetQuantity=targetBefore?(targetBefore.q??1):0;
   // A concurrent delivery or other legitimate inventory update can change
   // the character-wide quantity while the bank request is in flight. Observe
   // the exact source slot and addressed bank stack instead of an aggregate
   // count that is unrelated to the bank transfer's success.
   const at=Date.now(),sourcePrint=fingerprint(item),record={
     version:1,owner:me.name,realm:p.realm(),at,pack,source:slot,dest,
     item:{...item},sourcePrint,quantity:q,
     prepared:{kind:'bank.store',session:bot.session,at,realm:p.realm(),
      pack,source:slot,dest,sourcePrint}};
    if(!validateBankStoreRecord(record,{owner:me.name,realm:p.realm()}).valid||
       !saveStore(record))return false;
    const storeGuard=()=>storing===record&&
     storeEvidence(record).phase==='prepared-unchanged'&&
     (packs().find(([name])=>name===pack)?.[1]?.filter(i=>!i).length??0)>workspace&&
     (parkVerified?parkable(slot):e.spare(slot,r)>=q);
    const accepted=e.perform('bank.store',{slots:[slot],rule:r,guard:storeGuard,
     call:()=>{
      if(!storeGuard()){
       bot.inventoryBlocked=true;
       throw Error('Bankeinlagerung: Vorzustand vor Serveraufruf unklar');
      }
      const next={...record,dispatch:{kind:'bank.store',session:bot.session,
       at:Date.now(),realm:record.realm,pack,source:slot,dest,sourcePrint}};
      if(!validateBankStoreRecord(next,{owner:me.name,realm:p.realm()}).valid||
         p.write(storeKey,next)!==true){
       bot.inventoryBlocked=true;
       throw Error('Bankeinlagerung: Dispatch-Beleg nicht gespeichert');
      }
      storing=next;return p.call('bank_store',slot,pack,dest);
     },
     observe:()=>!!storing&&storeEvidence(storing).phase==='stored',
     onConfirmed:()=>!!storing&&storeEvidence(storing).phase==='stored'&&
      saveStore(null),
     details:{item:item.name,quantity:q,pack,before,sourceSlot:slot,
      bankSlot:dest,bankTargetBefore:targetPrint,
      bankTargetQuantity:targetQuantity,capacityRecovery:parkVerified}});
    if(!accepted&&!bot.journal&&!bot.exec?.busy?.('inventory')&&
       storeGuard())saveStore(null);
    return accepted;
  }if(consolidate()||!r.pack&&expand()||reclaim())return true;e.note('Bank voll: kein freier erlaubter Platz; erlaubte Konsolidierung, Verkauf und Erweiterungsbudget geprüft');return false;
 }
 function retrieve(item,r,wanted,purpose=null,targetSlot=-1,reserveStage=null){
  const cross=purpose===crossToken;
  if(swapping||storing)return recover();
  if(single||pending)return recover();
  if(reclaiming){
   bot.inventoryBlocked=true;
   e.note('Bankkonflikt: neuer Bankabruf bei offenem Reclaim verweigert');
   return false;
  }
  if(bot.free()<1){e.note('Bankentnahme '+item.name+': ein physisch freier Inventarplatz benötigt');return false;}
  if(!ready(r.pack||packFor(item)||'items0'))return false;
  for(const [pack,items] of packs()){
   if((r.pack&&r.pack!==pack)||packMap(pack)!==p.c.map)continue;
   const slot=items.findIndex((i,n)=>(targetSlot<0||n===targetSlot)&&i&&identity(i)===identity(item)&&e.safe(i)&&(i.q??1)<=Math.min(wanted,r.batch,r.maxCount-e.count(item)));
   if(slot<0)continue;const actual=items[slot],q=actual.q??1,fp=fingerprint(actual),dest=p.c.items.findIndex(i=>!i),before=e.count(actual),bankBefore=variantCount(items,actual);
   // This full-stack retrieval needs its own durable before/after evidence.
   const at=Date.now(),sourcePrint=fp,record={
    version:1,owner:me.name,realm:p.realm(),at,pack,slot,dest,
    item:{...actual},sourcePrint,quantity:q,before,bankBefore,
    ...(reserveStage?{reserveStage:{floor:reserveStage.floor,variant:reserveStage.variant}}:{}),
    prepared:{kind:'bank.retrieve',session:bot.session,at,realm:p.realm(),
     pack,slot,dest,sourcePrint}};
   if(!validateBankSingleRecord(record,{owner:me.name,realm:p.realm()}).valid||
      !saveSingle(record))return false;
   const guard=()=>single===record&&singleEvidence(record).phase==='prepared-unchanged'&&
     (!cross||cfg.merchant.consolidate===true&&p.c.items.some(i=>
      simple(i)&&identity(i)===identity(actual)&&(i.q??1)+q<=stackMax(i)))&&
     (!reserveStage||reserveStage.guard?.()===true);
   const accepted=e.perform(cross?'bank.merge.retrieve':'bank.retrieve',{
    rule:cross?null:r,guard,
    call:()=>{
     if(!guard()){
      bot.inventoryBlocked=true;
      throw Error('Bankentnahme: Quellzustand vor Server-Dispatch unklar');
     }
     if(reserveStage&&!prepareReserveChainDispatch(record)){
      bot.inventoryBlocked=true;
      throw Error('Bankreserve: Einzelentnahme-Folge nicht belegbar');
     }
     const next={...record,dispatch:{
      kind:'bank.retrieve',session:bot.session,at:Date.now(),
      realm:record.realm,pack,slot,dest,sourcePrint}};
     if(!validateBankSingleRecord(next,{owner:me.name,realm:p.realm()}).valid||
        p.write(singleKey,next)!==true){
      bot.inventoryBlocked=true;
      throw Error('Bankentnahme: Dispatch-Journal nicht gespeichert');
     }
     single=next;
     if(reserveStage&&!markReserveChainDispatch(record)){
      bot.inventoryBlocked=true;
      throw Error('Bankreserve: Einzelentnahme-Dispatchfolge unklar');
     }
     return p.call('bank_retrieve',pack,slot,dest);
    },
    observe:()=>!!single&&singleEvidence(single).phase==='withdrawn',
    onConfirmed:()=>!!single&&singleEvidence(single).phase==='withdrawn'&&saveSingle(null),
    details:{item:actual.name,quantity:q,pack,before}});
   if(!accepted&&!bot.journal&&!bot.exec?.busy?.('inventory')&&guard())
    saveSingle(null);
   return accepted;
  }
  if(cross||!cfg.merchant.partialBank)return false;
  const take=Math.floor(Math.min(wanted,r.batch,r.maxCount-e.count(item)));if(take<1||!e.remaining(r)||bot.journal||bot.logistics.reserved||bot.inventoryBlocked||bot.exec.busy('inventory')||bot.free()<2)return false;
  for(const [pack,items] of packs()){
   if((r.pack&&r.pack!==pack)||packMap(pack)!==p.c.map)continue;
   const bankSlot=items.findIndex((i,n)=>(targetSlot<0||n===targetSlot)&&e.safe(i)&&identity(i)===identity(item)&&Number.isSafeInteger(i.q)&&i.q>take&&i.q<=(cfg.merchant.partialBankMaxStack??9999));if(bankSlot<0)continue;
   const actual=structuredClone(items[bankSlot]),
    empty=p.c.items.map((i,n)=>i?-1:n).filter(n=>n>=0),
    record={version:2,owner:me.name,realm:p.realm(),at:Date.now(),
     pack,bankSlot,dest:empty[0],splitSlot:empty[1],
     item:actual,sourcePrint:fingerprint(actual),
     total:actual.q,take,before:e.count(actual),
     bankBefore:variantCount(items,actual),
     ...(reserveStage?{reserveStage:{
      floor:reserveStage.floor,variant:reserveStage.variant}}:{}),
     prepared:{at:Date.now(),session:bot.session,realm:p.realm(),
      pack,bankSlot,dest:empty[0],splitSlot:empty[1],
      sourcePrint:fingerprint(actual)},dispatches:[]};
   if(!validPending(record)||!savePending(record))return false;
   const accepted=e.perform('bank.partial.retrieve',{rule:r,
    guard:()=>partialReady(record,'original'),
    call:()=>callPartialStep(record,'original',()=>
     p.call('bank_retrieve',pack,bankSlot,record.dest)),
    observe:()=>partialEvidence(record).phase==='withdrawn',
    details:{item:actual.name,quantity:record.total,pack,before:record.before}});
   if(!accepted&&!bot.journal&&!bot.exec?.busy?.('inventory')&&
      partialReady(record,'original'))savePending(null);
   return accepted;
  }return false;
 }
 function consolidate(){
  if(swapping)return recoverSwap();
  if(pending||reclaiming||single||storing||bot.inventoryBlocked||
     bot.journal||bot.logistics?.reserved||bot.exec?.busy?.('inventory')||
     !cfg.merchant.bank||!cfg.merchant.consolidate||!p.c.bank)return false;
  for(const [pack,items] of packs())for(let a=0;a<items.length;a++)for(let b=a+1;b<items.length;b++){
   const x=items[a],y=items[b],qa=x?.q??1,qb=y?.q??1;
   if(packMap(pack)!==p.c.map||!simple(x)||!simple(y)||
      !Number.isSafeInteger(qa)||!Number.isSafeInteger(qb)||qa<1||qb<1||
      identity(x)!==identity(y)||qa+qb>stackMax(x))continue;
   const at=Date.now(),fa=fingerprint(x),fb=fingerprint(y),total=qa+qb,
    kind='bank.consolidate',realm=p.realm();
   const record={version:1,owner:me.name,realm,at,pack,a,b,
    first:{...x},second:{...y},qa,qb,total,fa,fb,
    prepared:{kind,session:bot.session,at,realm,pack,a,b,fa,fb}};
   if(!validateBankSwapRecord(record,{owner:me.name,realm:p.realm()}).valid||
      !saveSwap(record))return false;
   const guard=()=>{
    const row=p.c.bank?.[pack];
    return swapping===record&&
     swapEvidence(record).phase==='prepared-unchanged'&&
     cfg.merchant.bank===true&&cfg.merchant.consolidate===true&&
     simple(row?.[a])&&simple(row?.[b])&&
     (row[a].q??1)+(row[b].q??1)<=stackMax(row[a]);
   };
   const done=()=>!!swapping&&['merged-a','merged-b'].includes(swapEvidence(swapping).phase);
   const accepted=e.perform(kind,{guard,
    call:()=>{
     if(!guard()){
      bot.inventoryBlocked=true;
      throw Error('Swap: Quelle verändert');
     }
     const next={...record,dispatch:{kind,session:bot.session,
      at:Date.now(),realm,pack,a,b,fa,fb}};
     if(!validateBankSwapRecord(next,{owner:me.name,realm:p.realm()}).valid||
        p.write(swapKey,next)!==true){
      bot.inventoryBlocked=true;
      throw Error('Swap: Dispatchbeleg fehlt');
     }
     swapping=next;return p.call('bank_swap',pack,a,b);
    },
    observe:done,onConfirmed:()=>done()&&saveSwap(null),
    details:{item:x.name,quantity:total,pack}});
   if(!accepted&&!bot.journal&&!bot.exec?.busy?.('inventory')&&guard())
    saveSwap(null);
   return accepted;
  }
  return false;
 }
 // Cross-pack full-stack transfer uses one durable single-retrieve journal.
 function consolidateAcross(){
  if(single||pending||reclaiming||storing||swapping||bot.inventoryBlocked||
     bot.journal||bot.logistics?.reserved||bot.exec?.busy?.('inventory')||
     !cfg.merchant.bank||!cfg.merchant.consolidate||!p.c.bank)return false;
  if(!p.c.items.some(i=>!i))return false;
  for(const [pack,items] of packs()){
   if(packMap(pack)!==p.c.map)continue;
   for(let slot=0;slot<items.length;slot++){
    const item=items[slot],q=item?.q??1,max=stackMax(item);
    if(!simple(item)||!p.c.items.some(i=>simple(i)&&
       identity(i)===identity(item)&&(i.q??1)+q<=max))continue;
    const before=e.count(item);
    if(!Number.isSafeInteger(before)||before<0||
       !Number.isSafeInteger(before+q))return false;
    return retrieve(item,{pack,batch:q,maxCount:before+q},
     q,crossToken,slot);
   }
  }
  return false;
 }
 // Keep one ordinary stand; sell surplus only after bank evidence.
 const ordinaryStand=i=>i?.name==='stand0'&&(i.level??0)===0&&e.safe(i)&&
   !i.data&&!i.p&&!i.title&&!i.stat_type&&!i.acc&&!i.rid&&
   !i.special&&!i.v;
 const standRule=(action,price=0)=>({enabled:true,name:'Stand-Depot',item:'stand0',
   action,role:'merchant',batch:1,keep:0,teamReserve:0,minPrice:price,
   goldBudget:0,lossBudget:0,maxCount:9999});
 const liveStands=()=>p.c.map==='bank'&&!!p.c.bank?
   packs().filter(([pack])=>packMap(pack)===p.c.map)
     .flatMap(([pack,items])=>items.map((item,slot)=>({pack,slot,item}))
       .filter(row=>ordinaryStand(row.item))):[];
 let standSaleVerified=false;
 function manageStand({active=false}={}){
  if(active||!cfg.merchant.bank||me.name!==cfg.party.merchant||
     bot.journal||bot.inventoryBlocked||bot.logistics?.reserved||
     pending||reclaiming||single||storing||swapping||bot.exec.busy('inventory'))return false;
  const carried=(p.c.items??[]).map((item,slot)=>({item,slot}))
    .filter(row=>ordinaryStand(row.item));
  // Never interrupt live trade offers. Closing the stand and its storage
  // are driven by the controller after the final offer has been removed.
  if(p.c.stand||Object.entries(p.c.slots??{}).some(([k,i])=>
       /^trade([1-9]|1[0-6])$/.test(k)&&!!i))return false;
  if(standSaleVerified&&carried.length){
   const row=carried[0],price=e.value(row.item);
   if(!Number.isFinite(price)||price<0)return false;
   const accepted=e.npcSell(row.slot,standRule('sell',price));
   return !!accepted||bot.movement?.order?.owner==='economy';
  }
  if(standSaleVerified&&!carried.length)standSaleVerified=false;
  if(!carried.length&&p.c.map!=='bank')return false;
  if(p.c.map!=='bank'||!p.c.bank){
   ready('items0');return bot.movement?.order?.owner==='economy';
  }
  const bankStands=liveStands();
  if(bankStands.length&&carried.length){
   standSaleVerified=true;
   const row=carried[0],price=e.value(row.item);
   if(!Number.isFinite(price)||price<0)return false;
   const accepted=e.npcSell(row.slot,standRule('sell',price));
   return !!accepted||bot.movement?.order?.owner==='economy';
  }
  if(!bankStands.length&&carried.length){
   const accepted=store(carried[0].slot,standRule('bank'));
   return !!accepted||bot.movement?.order?.owner==='economy';
  }
  if(bankStands.length>1){
   const source=bankStands[bankStands.length-1];
   const destination=p.c.items.findIndex(i=>!i);
   if(destination<0)return false;
   const fp=fingerprint(source.item),item={...source.item},quantity=item.q??1;
   return e.perform('bank.stand.surplus',{
    guard:()=>!!p.c.bank&&!p.c.items[destination]&&
      fingerprint(p.c.bank?.[source.pack]?.[source.slot])===fp&&
      liveStands().length>1,
    call:()=>p.call('bank_retrieve',source.pack,source.slot,destination),
    observe:()=>!p.c.bank?.[source.pack]?.[source.slot]&&
      identity(p.c.items[destination])===identity(item)&&
      (p.c.items[destination]?.q??1)===quantity,
    details:{item:item.name,pack:source.pack,bankSlot:source.slot,
      sourceSlot:destination,quantity,reason:'ordinary-stand-surplus'}});
  }
  return false;
 }
 function expand(){
  if(!cfg.merchant.bank||!cfg.merchant.expandBank||!p.c.bank)return false;
  let cumulativeBudgetBlocked=false;
  for(const [pack,def] of Object.entries(definitions()).sort((a,b)=>(a[1]?.[1]??Infinity)-(b[1]?.[1]??Infinity))){
   const cost=def?.[1];
   if(def?.[0]!==p.c.map||p.c.bank[pack]||
      !bankExpansionAffordable(cost,p.c.gold,cfg.merchant.budgetMode==='account-loss'?Number.MAX_SAFE_INTEGER:cfg.merchant.bankBudget,
       cfg.merchant.budgetMode==='account-loss'?1:cfg.merchant.bankExpandGoldFraction??.75))continue;
   // Selecting an individually affordable pack after earlier expansions
   // would otherwise enqueue an action that fails only on the durable charge.
   if(e.bankExpansionAvailable?.(cost)!==true){
    cumulativeBudgetBlocked=true;continue;
   }
   const allowed=()=>bankExpansionAffordable(cost,p.c.gold,cfg.merchant.budgetMode==='account-loss'?Number.MAX_SAFE_INTEGER:cfg.merchant.bankBudget,
    cfg.merchant.budgetMode==='account-loss'?1:cfg.merchant.bankExpandGoldFraction??.75)&&e.bankExpansionAvailable(cost);
   return e.perform('bank.expand',{cost,guard:()=>!!p.c.bank&&!p.c.bank[pack]&&
    definitions()[pack]?.[0]===p.c.map&&definitions()[pack]?.[1]===cost&&allowed(),
    call:()=>p.call('open_bank_pack',pack,'gold'),
    observe:()=>Array.isArray(p.c.bank?.[pack]),details:{pack}});
  }
  if(cumulativeBudgetBlocked)e.note('Bankerweiterung: kumulatives Goldbudget ausgeschöpft; keine kostenpflichtige Erweiterung einplanen');
  return false;
 }
 // v3-guided conservative capacity recovery: non-destructive measures
 // first, then the least-loss eligible item only.
 function eligibleBankSale(item,{carried=false}={}){
  if(!e.safe(item)||item.data!==undefined||item.p||item.title||item.stat_type||item.acc||item.rid||item.skin||item.expires||item.special||item.v||(item.level??0)>0)return null;
  const operating=bankOperatingStockRule(bot,item,{carried});
  if(operating)return {r:operating,price:e.value(item),lossScore:e.value(item)+1000/Math.max(1,item.q??1)};
  const meta=p.G.items?.[item.name],price=e.value(item),explicit=e.explicit(item),original=explicit??e.rules(item);
  const planned=bot.storage?.lowQualityRule?.(item);
  if(planned)return {r:planned,price,lossScore:price+1000/Math.max(1,item.q??1)};
  // Under confirmed bank pressure, allow only a bounded, plain low-value
  // material to be sold even if autonomous disposition normally stores it.
  // An explicit user bank/keep/protection rule always wins.
  const autoSale=!explicit&&cfg.production.autoDisposition&&
   (!original||original._autoDisposition===true)&&stackMax(item)>1&&
   emergencyMaterialSaleAllowed(meta,price,item.q??1,cfg.production.autoSellMaxValue??0);
  const r=autoSale?{...original,enabled:true,name:'Banknotverkauf '+item.name,
   item:item.name,action:'sell',batch:item.q??1,keep:0,teamReserve:0,
   minPrice:0,maxCount:999999,goldBudget:0,lossBudget:0,maxActions:0,_autoDisposition:true}:original;
  if(meta&&(meta.quest||meta.q||meta.e||meta.exchange||meta.event||meta.cash||meta.cash_item||meta.soulbound||meta.compound||meta.upgrade||meta.rare||meta.rarity||meta.action||meta.onclick||meta.offering||meta.throw||meta.ignore||meta.wtype||meta.class||meta.grades||meta.tier))return null;
  if(!meta||!Number.isFinite(price)||price<0||r?.action!=='sell'||!e.remaining(r)||r.keep||r.teamReserve||(item.q??1)>r.batch||e.count(item)+(item.q??1)>r.maxCount||price<r.minPrice)return null;
  if(bot.production?.reserved(item)||bot.production?.reservedQuantity?.(item)>0||bot.production?.status()?.steps?.some(step=>step.item===item.name)||(cfg.production.goals??[]).some(g=>g.enabled&&g.item===item.name)||(cfg.production.gearTargets??[]).some(g=>g.enabled&&g.item===item.name)||bot.intelligence?.futureGear?.(item))return null;
  if(!explicit){
   // Synthetic permission only for one plain, stackable, low-risk material.
   if(!cfg.production.autoDisposition||!r._autoDisposition||meta.type!=='material'||stackMax(item)<2||!autoSale)return null;
   if(meta.quest||meta.q||meta.e||meta.exchange||meta.event||meta.cash||meta.cash_item||meta.soulbound||meta.compound||meta.upgrade||meta.rare||meta.rarity||meta.action||meta.onclick||meta.offering||meta.throw||meta.ignore||meta.wtype||meta.class||meta.grades||meta.tier)return null;
  }
  const rarity=Number(meta.rarity??meta.rare??0),difficulty=Number(meta.difficulty??0);
  if(!Number.isFinite(rarity)||!Number.isFinite(difficulty)||rarity<0||difficulty<0)return null;
  return {r,price,lossScore:price+rarity*1000000+difficulty*100000+1000/Math.max(1,item.q??1)};
 }
 // A single durable transaction path for BOTH pressure recovery and
 // preventive, explicitly authorized bank sales. No retained/offsite catalog
 // may be the source of a withdrawal or a subsequent sale.
 // A queued emergency sale must re-prove current physical bank pressure.
 function liveBankPressure(workspace){
  const bank=p.c.bank;
  if(!bank||typeof bank!=='object'||Array.isArray(bank)||
     Object.entries(bank).some(([name,items])=>
      /^items\d+$/.test(name)&&(!Array.isArray(items)||items.length>42)))
   return {pressed:false,locallyBlocked:false,usablePacks:0};
  return bankCapacityPressure(packs().map(([pack,items])=>({
   map:packMap(pack),items
  })),workspace,p.c.map,p.G);
 }
 function stageBankSale(selected,reason,explicitOnly=false,pressureWorkspace=null){
  if(pending||reclaiming||single||storing||swapping||bot.journal||bot.inventoryBlocked||
     bot.logistics?.reserved||bot.exec?.busy?.('inventory')||bot.free()<1||
     !p.c.bank||me.name!==cfg.party.merchant)return false;
  const {item,pack,slot}=selected,q=item.q??1,
   dest=p.c.items.findIndex(i=>!i),before=e.count(item),
   bankBefore=variantCount(p.c.bank?.[pack]??[],item),
   fp=fingerprint(item);
  const admitted=live=>{
   if(!live||packMap(pack)!==p.c.map||fingerprint(live)!==fp||
      !Number.isSafeInteger(q)||q<1||bot.free()<1||
      !!p.c.items[dest]||!cfg.merchant.bankReclaim||
      (pressureWorkspace!==null&&
       (pressure.observations<2||
        !liveBankPressure(pressureWorkspace).pressed)))return false;
   const safe=eligibleBankSale(live);
   return !!safe&&(!explicitOnly||
     cfg.merchant.preventiveStorage===true&&
     e.explicit(live)?.action==='sell'&&safe.r===e.explicit(live));
  };
  if(dest<0||!admitted(p.c.bank?.[pack]?.[slot]))return false;
  const record={version:2,owner:me.name,realm:p.realm(),at:Date.now(),
   item:{...item},pack,slot,dest,before,bankBefore,
   quantity:q,gold:p.c.gold,sourcePrint:fp,
   expectedSaleGold:e.value(item)*q,reason,explicitOnly,
   prepared:{at:Date.now(),kind:'bank.reclaim',session:bot.session,
    realm:p.realm(),pack,slot,dest,sourcePrint:fp}};
  if(!validateBankReclaimRecord(record,{owner:me.name,realm:p.realm(),G:p.G}).valid)
   return false;
  if(!p.write(reclaimKey,record))return false;
  reclaiming=record;
  const accepted=e.perform('bank.reclaim',{guard:()=>admitted(p.c.bank?.[pack]?.[slot]),
   call:()=>{
    // Persist an exact dispatch receipt BEFORE the server API is called.
    // A stale 'unchanged' snapshot is no longer proof of a missing request.
    const current=reclaiming;
    if(current!==record||classifyBankReclaimRecord(current,{
     owner:me.name,realm:p.realm(),inventory:p.c.items,
     bank:p.c.bank,map:p.c.map,packMap,G:p.G}).phase!=='unchanged'){
     bot.inventoryBlocked=true;
     throw Error('Bankfreigabe: Quelle vor API-Aufruf nicht eindeutig');
    }
    const next={...current,dispatch:{
     at:Date.now(),kind:'bank.reclaim',session:bot.session,
     realm:current.realm,pack:current.pack,slot:current.slot,
     dest:current.dest,sourcePrint:current.sourcePrint}};
    if(!validateBankReclaimRecord(next,{owner:me.name,realm:p.realm(),G:p.G}).valid||
       p.write(reclaimKey,next)!==true){
     bot.inventoryBlocked=true;
     e.note('Bankfreigabe: API-Dispatch-Beleg nicht dauerhaft gespeichert');
     throw Error('Bankfreigabe: API-Dispatch ohne dauerhaften Beleg verweigert');
    }
    reclaiming=next;
    return p.call('bank_retrieve',pack,slot,dest);
   },
   observe:()=>!p.c.bank?.[pack]?.[slot]&&
     identity(p.c.items[dest])===identity(item)&&
     (p.c.items[dest]?.q??1)===q,
   details:{item:item.name,quantity:q,pack,lossScore:selected.lossScore,
    reason}});
  // A rejected enqueue has NOT invoked the server API. Persistently
  // release this intent only if both addressed before-images still match.
  // If anything is unknown or the clearing write fails, retain the journal.
  if(!accepted&&!bot.journal&&!bot.exec?.busy?.('inventory')){
   const evidence=classifyBankReclaimRecord(record,{
    owner:me.name,realm:p.realm(),inventory:p.c.items,bank:p.c.bank,
    map:p.c.map,packMap,G:p.G});
   if(evidence.phase==='unchanged'&&p.write(reclaimKey,null)===true)
    reclaiming=null;
  }
  return accepted;
 }
 // Across reloads, the chain is reconciled ONLY against fresh physical
 // bank slots and verified local inventory, never an old planning catalogue.
 function reconcileReserveChain(){
  if(!reserveChain)return true;
  if(!validReserveChain(reserveChain,{
   owner:me.name,realm:p.realm(),now:Date.now()})){
   bot.inventoryBlocked=true;return false;
  }
  if(single||pending||reclaiming||storing||swapping)return false;
  const r=reserveChain,
   held=verifiedProductionStockQuantity(p.G,p.c.items,r.item);
  if(!Number.isSafeInteger(held))return false;
  if(r.phase!=='ready'){
   if(packMap(r.source.pack)!==p.c.map||
      !Array.isArray(p.c.bank?.[r.source.pack])||
      p.c.bank[r.source.pack].length>42)return false;
   const live=p.c.bank[r.source.pack][r.source.slot]??null;
   const outcome=reserveChainObservation(r,{held,
    source:live?fingerprint(live):null});
   if(!['prepared-unchanged','confirmed-physical-step'].includes(outcome)){
    bot.inventoryBlocked=true;
    e.note('Bankreserve: Quell- oder Bestandsdrift ('+outcome+')');
    return false;
   }
   const proven=outcome==='confirmed-physical-step';
   if(!saveReserveChain({...r,phase:'ready',source:null,carried:held,
     steps:r.steps+(proven?1:0),updated:Date.now()}))return false;
  }else if(held!==r.carried){
   bot.inventoryBlocked=true;
   e.note('Bankreserve: unbekannte Bestandsänderung im Folgestaging');
   return false;
  }
  // No sale from a durable cursor. Clearing it is a separate persisted
  // transition after the floor is ACTUALLY held in the local inventory.
  if(reserveChain.carried>=reserveChain.floor)
   return saveReserveChain(null);
  return true;
 }
 let preventiveScan={revision:null,map:null,defs:null,cursor:0,
  checked:0,total:0,best:null,completedAt:0,reason:'not-observed'};
 function resetPreventive(reason='snapshot-changed'){
  preventiveScan={revision:catalog.revision,map:p.c.map,defs:p.G.items,
   cursor:0,checked:0,total:0,best:null,completedAt:0,reason};
 }
 function preventiveDisposition(){
  // W04 is opt-in to existing preventive storage AND bank reclaim settings.
  // Explicit keep+excessAction and autonomous replaceable operating stock
  // need the full reserve physically carried. Other keep/low-quality rules
  // are not reinterpreted as preventive bank liquidation permission.
  if(cfg.merchant.preventiveStorage!==true||!cfg.merchant.bankReclaim||
     !cfg.merchant.bank||!bot.running||me.name!==cfg.party.merchant||
     pending||reclaiming||single||storing||swapping||
     bot.journal||bot.inventoryBlocked||
     bot.logistics?.reserved||bot.exec.busy('inventory'))return false;
  const rows=packs();
  if(!lastAtBank||!observed||!p.c.bank||!catalog.observedAt||
     catalog.realm!==(p.realm?.()??'')||
     Date.now()-catalog.observedAt>120000)return false;
  if(!reconcileReserveChain())return false;
  if(preventiveScan.revision!==catalog.revision||
     preventiveScan.map!==p.c.map||
     preventiveScan.defs!==p.G.items)resetPreventive();
  if(preventiveScan.completedAt){
   if(Date.now()-preventiveScan.completedAt<60000)return false;
   resetPreventive('periodic-recheck');
  }
  const batch=scanBankDispositionWindow(rows,{map:p.c.map,packMap,
   cursor:preventiveScan.cursor,limit:24,admit:(item,pack,slot)=>{
    if(reserveChain&&identity(item)!==reserveChain.variant)return null;
    const explicit=e.explicit(item);
    const safe=reserveChain?null:eligibleBankSale(item);
    if(safe&&(safe.r._bankOperatingStock||
       explicit?.enabled&&explicit.action==='sell'&&safe.r===explicit))
     return {price:safe.price,lossScore:safe.lossScore};
    // Before selling a different bank stack, stage a missing physical floor.
    const need=bankOperatingReserveNeed(bot,item),q=item?.q??1;
    const stage=reserveStagingTake(item,need);
    if(!stage)return null;
    const localBank=observedLocalReserveStock(item);
    if(localBank===null||!Number.isSafeInteger(need.held+localBank)||
       need.held+localBank<=need.floor)return null;
    // Prefer the closest *physically feasible* replenishment, avoiding
    // unnecessary whole-stack overfill when a smaller stack will suffice.
    return {price:0,lossScore:-1e9+
      Math.abs(q-need.missing)+(q>need.missing?0.5:0),reserveStage:true};
   }});
  if(!batch.valid){
   preventiveScan.reason=batch.reason;return false;
  }
  preventiveScan.cursor=batch.nextCursor;
  preventiveScan.checked+=batch.scanned;
  preventiveScan.total=batch.total;
  for(const row of batch.candidates){
   const value={pack:row.pack,slot:row.slot,
    lossScore:row.admission.lossScore,price:row.admission.price,
    variant:identity(row.item),sourcePrint:fingerprint(row.item),
     reserveStage:row.admission.reserveStage===true};
   const old=preventiveScan.best;
   if(!old||value.lossScore<old.lossScore||
      value.lossScore===old.lossScore&&
      (value.price<old.price||value.price===old.price&&
       (value.pack.localeCompare(old.pack)<0||
        value.pack===old.pack&&value.slot<old.slot)))
    preventiveScan.best=value;
  }
  preventiveScan.reason=batch.complete?'complete':'scanning';
  if(!batch.complete)return false;
  preventiveScan.completedAt=Date.now();
  const selected=preventiveScan.best;
  if(!selected||bot.free()<1)return false;
  // Revalidate against the addressed LIVE bank stack. Completion of a
  // read-only scan is not a withdrawal or a value permission.
  const item=p.c.bank?.[selected.pack]?.[selected.slot];
  if(!item||fingerprint(item)!==selected.sourcePrint||
     identity(item)!==selected.variant)return false;
  if(selected.reserveStage){
   const need=bankOperatingReserveNeed(bot,item),q=item.q??1;
   if(reserveChain&&(reserveChain.phase!=='ready'||
      reserveChain.variant!==identity(item)||
      reserveChain.floor!==need?.floor||
      reserveChain.carried!==need?.held||
      reserveChain.steps>=16))return false;
   const stagePlan=reserveStagingTake(item,need);
   if(!stagePlan)return false;
   const take=stagePlan.take;
   const localBank=observedLocalReserveStock(item);
   if(localBank===null||!Number.isSafeInteger(need.held+localBank)||
      need.held+localBank<=need.floor)return false;
   // The existing single-bank journal durably records this reserved stage
   // before API dispatch and recovers exact slot evidence after interruption.
   const stage={floor:need.floor,variant:identity(item),guard:()=>{
    const live=p.c.bank?.[selected.pack]?.[selected.slot],
     current=bankOperatingReserveNeed(bot,live);
    const remaining=live?observedLocalReserveStock(live):null;
    const updated=reserveStagingTake(live,current);
    return !!current&&current.floor===need.floor&&
     current.held===need.held&&current.missing===need.missing&&
     identity(live)===identity(item)&&fingerprint(live)===selected.sourcePrint&&
     updated?.take===take&&
     remaining!==null&&Number.isSafeInteger(current.held+remaining)&&
     current.held+remaining>current.floor&&
     packMap(selected.pack)===p.c.map;
   }};
   return retrieve(item,{enabled:true,name:'Bank-Reservestaging',
    item:item.name,action:'retrieve',pack:selected.pack,
    batch:take,maxCount:need.held+take,keep:0,teamReserve:0},
    take,null,selected.slot,stage);
  }
  const safe=eligibleBankSale(item),source=e.explicit(item),operating=!!safe?.r._bankOperatingStock;
  if(!safe||!operating&&(safe.r!==source||source?.action!=='sell'))return false;
  return stageBankSale({...safe,item,pack:selected.pack,
   slot:selected.slot},operating?'Vorbeugend: Betriebsvorrat physisch vollständig gedeckt':'Vorbeugend: explizite Bank-Verkaufsregel',!operating);
 }
 const preventiveStatus=()=>({
  revision:preventiveScan.revision,map:preventiveScan.map,
  checked:preventiveScan.checked,total:preventiveScan.total,
  cursor:preventiveScan.cursor,complete:!!preventiveScan.completedAt,
  candidate:preventiveScan.best?{
   pack:preventiveScan.best.pack,slot:preventiveScan.best.slot}:null,
  reason:preventiveScan.reason,mode:'observation-not-authorization',
   reserveStage:!!preventiveScan.best?.reserveStage
 });
 function reclaim(preventiveWorkspace=null){
  if(!cfg.merchant.bankReclaim||!cfg.merchant.bank||bot.free()<1)return false;
  const workspace=Math.max(0,Number.isSafeInteger(preventiveWorkspace)?
   Math.min(40,preventiveWorkspace):cfg.merchant.bankWorkspace??2);
  const bankPressure=liveBankPressure(workspace);
  // This threshold must agree with ordinary bank.store: a slot reserved
  // for workspace cannot be used by ordinary inventory cleanup. Never
  // reclaim/sell if a remote opened bank pack could accept a safe deposit.
  if(!bankPressure.pressed){
   if(pressure.observations&&p.write(pressureKey,null))pressure={observations:0,epoch:null,at:0};
   return false;
  }
  // Two distinct, recent decision observations are required before an
  // irreversible emergency sale, even if a single pack is temporarily full.
  const now=Date.now(),epoch=Number.isInteger(bot.decisionEpoch)?bot.decisionEpoch:Math.floor(now/2000);
  if(pressure.epoch!==epoch){
   const next={observations:Math.min(2,now-pressure.at<=60000?pressure.observations+1:1),epoch,at:now};
   if(!p.write(pressureKey,next)){e.note('Bankdruck: Beobachtung nicht dauerhaft gespeichert; kein Notverkauf');return false;}
   pressure=next;
  }
  if(consolidate()||expand())return true;
  if(pressure.observations<2){e.note('Bankdruck: zweite bestätigte Bestandsbeobachtung vor Notverkauf erforderlich');return false;}
  const candidates=[];
  for(const [pack,items] of packs()){
   if(packMap(pack)!==p.c.map)continue;
   for(let slot=0;slot<items.length;slot++){
    const item=items[slot],safe=eligibleBankSale(item);
    if(safe)candidates.push({...safe,pack,slot,item});
   }
  }
  candidates.sort((a,b)=>a.lossScore-b.lossScore||a.price-b.price||a.item.name.localeCompare(b.item.name)||a.slot-b.slot);
  const selected=candidates[0];if(!selected){e.note('Bankdruck: kein ausdrücklich freigegebenes unreserviertes Item für sicheren Notverkauf');return false;}
  return stageBankSale(selected,'Bankdruck: geringster risikobereinigter Verlust',
   false,workspace);
 }
 function dispatchRollback(record){
  const state=classifyBankReclaimRecord(record,{owner:me.name,realm:p.realm(),
   inventory:p.c.items,bank:p.c.bank,map:p.c.map,packMap,G:p.G});
  if(state.phase==='restored'){
   if(p.write(reclaimKey,null)===true)reclaiming=null;else bot.inventoryBlocked=true;
   return true;
  }
  if(state.phase==='rollback-dispatched-unchanged'){
   bot.inventoryBlocked=true;e.note('Bankrücklagerung: API bereits aufgerufen');return true;
  }
  if(state.phase!=='rollback-prepared')return true;
  const phase=()=>classifyBankReclaimRecord(record,{owner:me.name,realm:p.realm(),
   inventory:p.c.items,bank:p.c.bank,map:p.c.map,packMap,G:p.G}).phase;
  const guard=()=>reclaiming===record&&phase()==='rollback-prepared'&&
   e.safe(p.c.items[record.dest])&&
   reclaimRollbackEvidence(record,p.c.items[record.dest],
    p.c.bank?.[record.pack]?.[record.slot]??null,
    variantCount(p.c.bank?.[record.pack]??[],record.item),p.G);
  e.perform('bank.store',{slots:[record.dest],guard,
   call:()=>{
    if(!guard()){bot.inventoryBlocked=true;throw Error('Rücklagerung: Slotbeleg verändert');}
    const next={...record,rollback:{...record.rollback,dispatchedAt:Date.now()}};
    if(!validateBankReclaimRecord(next,{owner:me.name,realm:p.realm(),G:p.G}).valid||
       p.write(reclaimKey,next)!==true){
     bot.inventoryBlocked=true;throw Error('Rücklagerung: Dispatchbeleg fehlt');
    }
    reclaiming=next;return p.call('bank_store',record.dest,record.pack,record.slot);
   },
   observe:()=>!!reclaiming&&classifyBankReclaimRecord(reclaiming,{
    owner:me.name,realm:p.realm(),inventory:p.c.items,bank:p.c.bank,
    map:p.c.map,packMap,G:p.G}).phase==='restored',
   onConfirmed:()=>{
    if(!reclaiming||classifyBankReclaimRecord(reclaiming,{
     owner:me.name,realm:p.realm(),inventory:p.c.items,bank:p.c.bank,
     map:p.c.map,packMap,G:p.G}).phase!=='restored')return false;
    if(p.write(reclaimKey,null)!==true){bot.inventoryBlocked=true;return false;}
    reclaiming=null;return true;
   },
   details:{item:record.item.name,quantity:record.quantity,
    pack:record.pack,sourceSlot:record.dest,bankSlot:record.slot,
    bankTargetBefore:fingerprint(null),bankTargetQuantity:0,
    reason:'revoked-emergency-sale-rollback'}});
  return true;
 }
 function recoverCapacity(){
  if(!reclaiming)return false;
  if(single||storing||swapping){bot.inventoryBlocked=true;e.note('Bankkonflikt: weitere Bankwertaktion und Reclaim');return true;}
  if(pending){
   bot.inventoryBlocked=true;
   e.note('Bankkonflikt: mehrere offene Wertjournale; kein Bankverkauf');
   return true;
  }
  if(bot.journal||bot.inventoryBlocked||bot.exec?.busy?.('inventory')||
     bot.exec?.frame?.some?.(x=>x.resources?.includes?.('inventory')))
   return true;
  let r=reclaiming;
  const evidence=classifyBankReclaimRecord(r,{
   owner:me.name,realm:p.realm(),inventory:p.c.items,bank:p.c.bank,
   map:p.c.map,packMap,G:p.G});
  if(evidence.phase==='invalid'){
   bot.inventoryBlocked=true;
   e.note('Bankfreigabe: ungültiges Journal ('+evidence.reason+'); Wertaktionen gesperrt');
   return true;
  }
  if(evidence.phase==='unobserved'){
   // The source bank pack is NOT visible on the NPC map. An already
   // durably confirmed withdrawal can follow its explicitly permitted
   // sale path using the exact LIVE carried stack, but cannot treat the
   // off-map bank as empty. Other states first return for fresh evidence.
   if(r.saleConfirmed===true){
    ready(r.pack,true); // move back to the bank, never sell a second time
    return true;
   }
   const offsite=inspectOffsiteBankReclaim(r,{
    owner:me.name,realm:p.realm(),inventory:p.c.items,G:p.G});
   if(!offsite.eligible){
    ready(r.pack,true); // re-prove the bank source before any further value step
    e.note('Bankfreigabe: Quellbank nicht beobachtet ('+offsite.reason+'); Rückkehr zur Bank');
    return true;
   }
  }else if(evidence.phase==='legacy-unchanged-uncertain'){
   // V2 written before the pre-dispatch protocol never proves a request
   // was unsent. Preserve it and require an independently checked outcome.
   bot.inventoryBlocked=true;
   e.note('Bankfreigabe: altes V2-Journal ohne Versandsnachweis; manuell prüfen');
   return true;
  }else if(evidence.phase==='dispatched-unchanged'){
   // A dispatched request can complete after the last observation or
   // after a browser restart. Do not clear or repeat it automatically.
   bot.inventoryBlocked=true;
   e.note('Bankfreigabe: Entnahme-API aufgerufen, Ausgang unbekannt; manuell prüfen');
   return true;
  }else if(evidence.phase==='restored'){
   if(p.write(reclaimKey,null)===true)reclaiming=null;
   else bot.inventoryBlocked=true;
   return true;
  }else if(evidence.phase==='rollback-dispatched-unchanged'){
   bot.inventoryBlocked=true;e.note('Bankrücklagerung: Versand unklar; nicht wiederholen');return true;
  }else if(evidence.phase==='rollback-prepared')return dispatchRollback(r);
  else if(evidence.phase==='unchanged'||evidence.phase==='sold'){
   // Both source AND inventory were independently reconciled. Only
   // saleConfirmed from an earlier onConfirmed receipt qualifies as sold.
   if(p.write(reclaimKey,null)===true)reclaiming=null;
   else e.note('Bankfreigabe: bestätigter Endzustand; Journal nicht löschbar');
   return true;
  }else if(evidence.phase==='withdrawn'){
   // Persist the full addressed withdrawal receipt BEFORE moving to a
   // different map. This is NOT an NPC-sale receipt or permission to drop
   // the checkpoint. On any storage error, the Merchant remains blocked.
   if(!r.withdrawal){
    const next={...r,withdrawal:{
     at:Date.now(),realm:r.realm,pack:r.pack,slot:r.slot,
     dest:r.dest,sourcePrint:r.sourcePrint,
     inventoryCount:r.before+r.quantity,
     bankCount:r.bankBefore-r.quantity}};
    if(!validateBankReclaimRecord(next,{owner:me.name,realm:p.realm(),G:p.G}).valid||
       p.write(reclaimKey,next)!==true){
     bot.inventoryBlocked=true;
     e.note('Bankfreigabe: Entnahmebeleg nicht dauerhaft gespeichert');
     return true;
    }
    reclaiming=next;r=next;
   }
  }else{
   e.note('Bankfreigabe: Quell- oder Zielslot weicht ab; manuell prüfen');
   return true;
  }
  // A verified withdrawal may now travel to an NPC. Offsite continuations
  // additionally require the persisted source-bank receipt and exact local
  // inventory evidence; sale rights are re-evaluated on every new attempt.
  const item=p.c.items[r.dest],sale=eligibleBankSale(item,{carried:true}),
   source=r.explicitOnly?e.explicit(item):null,
   authorized=!!sale&&cfg.merchant.bankReclaim===true&&
    (!r.explicitOnly||(cfg.merchant.preventiveStorage===true&&
     source?.action==='sell'&&source.enabled===true&&sale.r===source)),
   rule=authorized?sale.r:null;
  if(rule?.action==='sell'&&e.spare(r.dest,rule)>=r.quantity){
   e.npcSell(r.dest,{...rule,batch:r.quantity,
    ...(r.explicitOnly?{_bankExplicitSource:source}:{})},{onConfirmed:()=>{
    const next={...r,saleConfirmed:true};
    if(!p.write(reclaimKey,next))return false;
    reclaiming=next;return true;
   }});
   return true;
  }
  if(!r.rollback&&r.dispatch&&r.withdrawal&&e.safe(item)&&
     p.c.map===packMap(r.pack)&&Array.isArray(p.c.bank?.[r.pack])&&
     reclaimRollbackEvidence(r,item,p.c.bank[r.pack][r.slot]??null,
      variantCount(p.c.bank[r.pack],r.item),p.G)){
   const at=Date.now();
   const next={...r,rollback:{at,session:bot.session,realm:r.realm,
    pack:r.pack,source:r.dest,dest:r.slot,sourcePrint:r.sourcePrint}};
   if(validateBankReclaimRecord(next,{owner:me.name,realm:p.realm(),G:p.G}).valid&&
      p.write(reclaimKey,next)===true){reclaiming=next;return dispatchRollback(next);}
   bot.inventoryBlocked=true;e.note('Bankrücklagerung: Journal nicht gespeichert');return true;
  }
  if(r.rollback)return dispatchRollback(r);
  e.note('Bankfreigabe: Verkaufsberechtigung widerrufen; sichere Aufklärung erforderlich');
  return true;
 }
 // Read-only evidence view for the operator. It performs no travel, game
 // call, checkpoint write or automatic resolution of contradictory journals.
 function recoveryStatus(){
  const collision=[pending,reclaiming,single,storing,swapping].filter(Boolean).length>1,
   partial=pending?partialEvidence(pending):null,
   reclaim=reclaiming?classifyBankReclaimRecord(reclaiming,{
    owner:me.name,realm:p.realm?.()??'',inventory:p.c?.items,
    bank:p.c?.bank,map:p.c?.map,packMap,G:p.G}):null,
   singleResult=single?singleEvidence(single):null,
    storeResult=storing?storeEvidence(storing):null,
    swapResult=swapping?swapEvidence(swapping):null,
   offsite=reclaiming&&reclaim?.phase==='unobserved'?
    inspectOffsiteBankReclaim(reclaiming,{
     owner:me.name,realm:p.realm?.()??'',inventory:p.c?.items,G:p.G}):null;
  const needsReview=collision||
   ['ambiguous','invalid'].includes(partial?.phase)||
   (pending&&partial&&partial.phase!=='unobserved'&&
    !partialDispatchDecision(pending,partial.phase).allowed)||
   ['ambiguous','invalid','dispatched-unchanged',
    'legacy-unchanged-uncertain'].includes(reclaim?.phase)||
   ['invalid','ambiguous','dispatched-unchanged',
    'unproven-withdrawal'].includes(singleResult?.phase)||
   ['invalid','ambiguous','dispatched-unchanged','unproven-store'].includes(storeResult?.phase)||
    ['invalid','ambiguous','dispatched-unchanged','unproven-merge'].includes(swapResult?.phase);
  return {
   mode:'read-only-no-authorization',executable:false,
   blocked:collision||!!bot.inventoryBlocked||!!bot.journal,
   conflict:collision?'simultaneous-bank-value-journals':null,
   requiresManualReview:!!needsReview||
    !!reserveChain&&!validReserveChain(reserveChain,{
     owner:me.name,realm:p.realm(),now:Date.now()}),
   reserveChain:reserveChain?{phase:reserveChain.phase,
    variant:reserveChain.variant,floor:reserveChain.floor,
    carried:reserveChain.carried,steps:reserveChain.steps,
    source:reserveChain.source?{pack:reserveChain.source.pack,
     slot:reserveChain.source.slot,take:reserveChain.source.take}:null}:null,
   swap:swapping?{
     phase:collision?'conflict':swapResult.phase,reason:swapResult.reason,
     pack:swapping.pack,firstSlot:swapping.a,secondSlot:swapping.b,
     item:swapping.first?.name,quantity:swapping.total,
     preparationRecorded:!!swapping.prepared,dispatchRecorded:!!swapping.dispatch}:null,
    store:storing?{
     phase:collision?'conflict':storeResult.phase,reason:storeResult.reason,
     pack:storing.pack,sourceSlot:storing.source,bankSlot:storing.dest,
     item:storing.item?.name,quantity:storing.quantity,
     preparationRecorded:!!storing.prepared,dispatchRecorded:!!storing.dispatch}:null,
    single:single?{
    phase:collision?'conflict':singleResult.phase,reason:singleResult.reason,
    pack:single.pack,sourceSlot:single.slot,inventorySlot:single.dest,
    item:single.item?.name??null,quantity:single.quantity,
    preparationRecorded:!!single.prepared,dispatchRecorded:!!single.dispatch,
     reserveStage:single.reserveStage??null}:null,
   partial:pending?{
    phase:collision?'conflict':partial.phase,reason:partial.reason,
    pack:pending.pack,sourceSlot:pending.bankSlot,
    inventorySlot:pending.dest,splitSlot:pending.splitSlot,
    item:pending.item?.name??null,quantity:pending.take,
    preparationRecorded:!!pending.prepared,
    dispatchCount:pending.dispatches?.length??null,
    dispatchReason:partial&&partial.phase!=='unobserved'?
     partialDispatchDecision(pending,partial.phase).reason:null}:null,
   reclaim:reclaiming?{
    phase:collision?'conflict':reclaim.phase,reason:reclaim.reason,
    pack:reclaiming.pack,sourceSlot:reclaiming.slot,
    inventorySlot:reclaiming.dest,item:reclaiming.item?.name??null,
    quantity:reclaiming.quantity,
    withdrawalRecorded:!!reclaiming.withdrawal,
    dispatchRecorded:!!reclaiming.dispatch,
    preparationRecorded:!!reclaiming.prepared,
    saleConfirmed:reclaiming.saleConfirmed===true,
    offsiteEligible:offsite?.eligible??false,
    offsiteReason:offsite?.reason??null}:null
  };
 }
 function capacity(){return packs().map(([pack,items])=>({pack,map:packMap(pack),size:items.length,observedLength:p.c.bank?.[pack]?.length??null,used:items.filter(Boolean).length,free:items.filter(i=>!i).length,workspace:cfg.merchant.bankWorkspace??0}));}
 function gold(){
  if(cfg.merchant.bank!==true||cfg.merchant.bankGold!==true||
     !p.c.bank||me.name!==cfg.party.merchant)return false;
  // Merely retaining an off-map bank object does not prove that a live
  // bank balance may be mutated. Require an observed local pack.
  const local=()=>Object.entries(p.c.bank??{}).some(([pack,items])=>
   /^items\d+$/.test(pack)&&packMap(pack)===p.c.map&&
   Array.isArray(items)&&items.length<=42);
  if(!local())return false;
  const input=()=>({wallet:p.c.gold,bankGold:p.c.bank?.gold,
   slots:p.c.slots,goldTarget:cfg.merchant.goldTarget,
   goldReserve:cfg.merchant.goldReserve,
   characterReserve:me.goldReserve??0,
   purchaseMinimum:bot.market?.fundingMinimumGold?.()??0});
  const plan=bankGoldTransferPlan(input());
  if(!plan)return false;
  const {method,quantity:q,target,committed}=plan;
  const before=p.c.gold,stored=p.c.bank.gold;
  // A bid that changes after planning cannot reuse an old bank transfer.
  const guard=()=>{
   const live=local()?bankGoldTransferPlan(input()):null;
   return cfg.merchant.bank===true&&cfg.merchant.bankGold===true&&
    live?.method===method&&live.quantity===q&&
    live.target===target&&live.committed===committed&&
    p.c.gold===before&&p.c.bank?.gold===stored;
  };
  return e.perform('bank.gold',{guard,
   call:()=>p.call(method,q),
   observe:()=>p.c.gold===before+(method==='bank_deposit'?-q:q)&&
    p.c.bank?.gold===stored+(method==='bank_deposit'?q:-q),
   details:{quantity:q,before}});
 }
 // Safe consolidation precedes evidence-based, rule-bound bank reclaim.
 function audit(){if(!cfg.merchant.bank||!p.c.bank||bot.inventoryBlocked||bot.journal)return false;
  return consolidateInventory()||consolidate()||consolidateAcross()||reclaim();}
 return {liveEvidence(){return inspectBankEvidence(p.c.bank,{
   owner:me.name,session:bot.session,realm:p.realm(),map:p.c.map,
   packMap,blocked:!!bot.inventoryBlocked||!!bot.journal||!!pending||!!reclaiming||!!single||!!storing||!!swapping
  });},capacityEvidence(){packs();return catalog.realm===(p.realm?.()??'')&&catalog.observedAt>0&&catalog.observedAt<=Date.now()&&Date.now()-catalog.observedAt<=120000&&Array.isArray(catalog.capacity)?{at:catalog.observedAt,rows:catalog.capacity.map(r=>({...r}))}:null;},goldEvidence(){packs();return !bot.journal&&!bot.inventoryBlocked&&!pending&&!reclaiming&&!single&&!storing&&!swapping&&catalog.realm===(p.realm?.()??'')&&catalog.observedAt>0&&catalog.observedAt<=Date.now()&&Date.now()-catalog.observedAt<=120000&&Number.isSafeInteger(catalog.gold)&&catalog.gold>=0?{gold:catalog.gold,at:catalog.observedAt,realm:catalog.realm,owner:me.name}:null;},store,park,retrieve,consolidate,consolidateAcross,consolidateInventory,audit,manageStand,gold,expand,reclaim,preventiveDisposition,preventiveStatus,recoverCapacity,capacity,packs,catalogStock,catalogStatus:()=>({revision:catalog.revision,observedAt:catalog.observedAt,ageMs:catalog.observedAt?Date.now()-catalog.observedAt:null,planningRows:catalogStock().length}),ready,recover,recoveryStatus,stock,pressureStatus:()=>({...pressure}),inspect(){if(!ready())return false;packs();return observed;},get observed(){packs();return observed&&catalog.realm===(p.realm?.()??'')&&catalog.observedAt>0&&Date.now()-catalog.observedAt<=120000;},get reclaiming(){return !!reclaiming;},get rollbackPending(){return !!reclaiming?.rollback&&!reclaiming.rollback.dispatchedAt;},get singlePending(){return !!single;},get storePending(){return !!storing;},get swapPending(){return !!swapping;},get pending(){return !!(pending||reclaiming||single||storing||swapping);},status:()=>pending?{item:pending.item?.name,quantity:pending.take,total:pending.total,pack:pending.pack}:null};
}
