import {identity,fingerprint,variantCount} from '../core/policy.mjs';
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
export function createBank(bot){
 const {p,cfg,me}=bot,e=bot.economy;
 const pendingKey='albot:bank-partial:'+me.name;let pending=p.read(pendingKey)??null;
 const reclaimKey='albot:bank-reclaim:'+me.name;let reclaiming=p.read(reclaimKey)??null;
 const pressureKey='albot:bank-pressure:'+me.name;
 let pressure=p.read(pressureKey)??{observations:0,epoch:null,at:0};
 if(!Number.isInteger(pressure.observations)||!Number.isFinite(pressure.at))pressure={observations:0,epoch:null,at:0};
 const validPending=r=>r&&/^items\d+$/.test(r.pack)&&[r.bankSlot,r.dest,r.splitSlot].every(n=>Number.isInteger(n)&&n>=0&&n<1000)&&r.dest!==r.splitSlot&&r.item&&typeof r.item.name==='string'&&e.safe(r.item)&&[r.total,r.take,r.before,r.bankBefore].every(n=>Number.isSafeInteger(n)&&n>=0)&&r.take>0&&r.total>r.take&&r.bankBefore>=r.total;
 if(pending&&!validPending(pending)){bot.inventoryBlocked=true;e.note('Bank-Teilentnahme: ungültiger Checkpoint; Bestand prüfen');}
 function savePending(value){if(!p.write(pendingKey,value)){bot.inventoryBlocked=true;e.note('Bank-Teilentnahme: Checkpoint nicht gespeichert');return false;}pending=value;return true;}
 function recover(){
  if(!pending)return false;if(bot.inventoryBlocked||bot.journal||!bot.running||bot.logistics.reserved)return true;
  if(!validPending(pending)){bot.inventoryBlocked=true;return true;}const r=pending;
  if(!ready(r.pack,true))return true;
  e.note('Bank-Teilentnahme: '+r.take+' behalten, Rest zurücklagern');
  const row=p.c.bank?.[r.pack],inventory=e.count(r.item),bank=variantCount(row??[],r.item),rest=r.total-r.take;
  if(r.dest>=p.c.items.length||r.splitSlot>=p.c.items.length||r.bankSlot>=(row?.length??0)){bot.inventoryBlocked=true;e.note('Bank-Teilentnahme: gespeicherter Platz fehlt');return true;}
  if(inventory===r.before+r.take&&bank===r.bankBefore-r.take){if(savePending(null))bot.event('bank.partial.complete',{item:r.item.name,quantity:r.take,returned:rest});return true;}
  const matches=(i,q)=>e.safe(i)&&identity(i)===identity(r.item)&&(i.q??1)===q;
  if(inventory===r.before&&bank===r.bankBefore&&matches(row?.[r.bankSlot],r.total)&&!p.c.items[r.dest]&&!p.c.items[r.splitSlot]){
   e.perform('bank.partial.retrieve',{guard:()=>matches(p.c.bank?.[r.pack]?.[r.bankSlot],r.total)&&!p.c.items[r.dest]&&!p.c.items[r.splitSlot],call:()=>p.call('bank_retrieve',r.pack,r.bankSlot,r.dest),observe:()=>!p.c.bank?.[r.pack]?.[r.bankSlot]&&identity(p.c.items[r.dest])===identity(r.item)&&p.c.items[r.dest]?.q===r.total,details:{item:r.item.name,quantity:r.total,pack:r.pack,before:r.before}});return true;
  }
  if(inventory===r.before+r.total&&bank===r.bankBefore-r.total&&!row?.[r.bankSlot]){
   if(matches(p.c.items[r.dest],r.total)&&!p.c.items[r.splitSlot]&&p.c.items.findIndex(i=>!i)===r.splitSlot){
    e.perform('bank.partial.split',{slots:[r.dest],guard:()=>!p.c.items[r.splitSlot]&&p.c.items.findIndex(i=>!i)===r.splitSlot,call:()=>p.call('split',r.dest,r.take),observe:()=>matches(p.c.items[r.dest],rest)&&matches(p.c.items[r.splitSlot],r.take),details:{item:r.item.name,quantity:r.take}});return true;
   }
   if(matches(p.c.items[r.dest],rest)&&matches(p.c.items[r.splitSlot],r.take)){
    e.perform('bank.partial.return',{slots:[r.dest],guard:()=>!p.c.bank?.[r.pack]?.[r.bankSlot]&&matches(p.c.items[r.splitSlot],r.take),call:()=>p.call('bank_store',r.dest,r.pack,r.bankSlot),observe:()=>!p.c.items[r.dest]&&identity(p.c.items[r.splitSlot])===identity(r.item)&&p.c.items[r.splitSlot]?.q===r.take&&identity(p.c.bank?.[r.pack]?.[r.bankSlot])===identity(r.item)&&p.c.bank[r.pack][r.bankSlot]?.q===rest,details:{item:r.item.name,quantity:rest,pack:r.pack}});return true;
   }
  }
  bot.inventoryBlocked=true;e.note('Bank-Teilentnahme: Bestand weicht vom Checkpoint ab; manuell prüfen');return true;
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
   Array.isArray(items)).map(([name,items])=>[name,Array.from({length:items.length},
    (_,n)=>items[n]??null)]);
  // An abbreviated live pack is not proof that slots 0..41 exist. Normalize
  // sparse holes only WITHIN the server-observed array length. Any larger
  // pack must be confirmed by a later live bank observation before use.
  // Merely reading a retained p.c.bank object from outside its actual map
  // never renews the 120-second evidence TTL.
  const live=rows.length>0&&rows.some(([pack])=>packMap(pack)===p.c.map)&&
   !bot.inventoryBlocked&&!bot.journal;
  if(!live)lastAtBank=false;
  if(live){
   const current=rows.flatMap(([pack,items])=>packMap(pack)===p.c.map?
    items.flatMap((item,slot)=>item&&e.safe(item)?[{pack,slot,item:{...item}}]:[]):[]).slice(0,512);
   const fingerprintNow=JSON.stringify(rows.filter(([pack])=>packMap(pack)===p.c.map)
    .map(([pack,items])=>[pack,items.map(item=>item?fingerprint(item):null)]));
   if(!lastAtBank||fingerprintNow!==lastVerifiedFingerprint){
    // New verified visit or a server-observable bank state revision.
    const next={version:1,owner:me.name,realm:p.realm?.()??'',observedAt:Date.now(),
     revision:(catalog.revision??0)+1,rows:current};
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
 const location=map=>({map,in:map,x:0,y:-100,radius:80});
 function ready(pack='items0',recovery=false){const map=packMap(pack);return !!map&&(cfg.merchant.bank||recovery)&&me.name===cfg.party.merchant&&e.travel(location(map),'Bank')&&!!p.c.bank;}
 // Non-destructive capacity parking is a private, single-operation bank path.
 // Speculative production reservations remain intact: no sale, split or release.
 // The live bank destination and original item fingerprint are rechecked at dispatch.
 function parkable(slot){
  const item=p.c.items?.[slot],meta=p.G.items?.[item?.name];
  if(!cfg.merchant.bank||!cfg.production?.autoDisposition||!e.safe(item)||
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
  const item=p.c.items[slot],parkVerified=parking&&parkable(slot);
  if(!e.safe(item)||(!parkVerified&&e.spare(slot,r)<1))return false;
  const allowed=parkVerified?(item.q??1):e.spare(slot,r);if(allowed<(item.q??1)){
   if(bot.free()<1){e.note('Bank-Split '+item.name+': ein physisch freier Inventarplatz benötigt');return false;}const before=item.q,dest=p.c.items.findIndex(x=>!x);
   return e.perform('bank.split',{slots:[slot],rule:r,guard:()=>!p.c.items[dest]&&e.spare(slot,r)>=allowed,call:()=>p.call('split',slot,allowed),observe:()=>p.c.items[slot]?.q===before-allowed&&p.c.items.some((x,n)=>n!==slot&&identity(x)===identity(item)&&x.q===allowed),details:{item:item.name,quantity:allowed,before}});
  }
  const rows=packs(),preferred=r.pack||rows.find(([,items])=>items.some(i=>!i)&&
     items.some(i=>simple(i)&&identity(i)===identity(item)&&
       (i.q??1)<stackMax(i)))?.[0]||
     rows.find(([,items])=>items.some(i=>!i))?.[0]||'items0';
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
   return e.perform('bank.store',{slots:[slot],rule:r,guard:()=>!!p.c.bank&&!p.c.bank[pack][dest]&&p.c.bank[pack].filter(i=>!i).length>workspace&&fingerprint(p.c.bank[pack][dest])===targetPrint&&
     (parkVerified?parkable(slot)&&fingerprint(p.c.items[slot])===fingerprint(item):e.spare(slot,r)>=q),
    call:()=>p.call('bank_store',slot,pack,dest),
    observe:()=>!p.c.items[slot]&&identity(p.c.bank?.[pack]?.[dest])===identity(item)&&(p.c.bank[pack][dest].q??1)===targetQuantity+q,
    details:{item:item.name,quantity:q,pack,before,sourceSlot:slot,bankSlot:dest,bankTargetBefore:targetPrint,bankTargetQuantity:targetQuantity,
     capacityRecovery:parkVerified}});
  }if(consolidate()||!r.pack&&expand()||reclaim())return true;e.note('Bank voll: kein freier erlaubter Platz; erlaubte Konsolidierung, Verkauf und Erweiterungsbudget geprüft');return false;
 }
 function retrieve(item,r,wanted){
  if(pending)return recover();
  if(bot.free()<1){e.note('Bankentnahme '+item.name+': ein physisch freier Inventarplatz benötigt');return false;}
  if(!ready(r.pack||packFor(item)||'items0'))return false;
  for(const [pack,items] of packs()){
   if((r.pack&&r.pack!==pack)||packMap(pack)!==p.c.map)continue;
   const slot=items.findIndex(i=>i&&identity(i)===identity(item)&&e.safe(i)&&(i.q??1)<=Math.min(wanted,r.batch,r.maxCount-e.count(item)));
   if(slot<0)continue;const actual=items[slot],q=actual.q??1,fp=fingerprint(actual),dest=p.c.items.findIndex(i=>!i),before=e.count(actual),bankBefore=variantCount(items,actual);
   return e.perform('bank.retrieve',{rule:r,guard:()=>fingerprint(p.c.bank?.[pack]?.[slot])===fp&&!p.c.items[dest],call:()=>p.call('bank_retrieve',pack,slot,dest),observe:()=>!p.c.bank?.[pack]?.[slot]&&identity(p.c.items[dest])===identity(actual)&&(p.c.items[dest]?.q??1)===q,details:{item:actual.name,quantity:q,pack,before}});
  }
  if(!cfg.merchant.partialBank)return false;
  const take=Math.floor(Math.min(wanted,r.batch,r.maxCount-e.count(item)));if(take<1||!e.remaining(r)||bot.journal||bot.logistics.reserved||bot.inventoryBlocked||bot.exec.busy('inventory')||bot.free()<2)return false;
  for(const [pack,items] of packs()){
   if((r.pack&&r.pack!==pack)||packMap(pack)!==p.c.map)continue;
   const bankSlot=items.findIndex(i=>e.safe(i)&&identity(i)===identity(item)&&Number.isSafeInteger(i.q)&&i.q>take&&i.q<=(cfg.merchant.partialBankMaxStack??9999));if(bankSlot<0)continue;
   const actual=structuredClone(items[bankSlot]),empty=p.c.items.map((i,n)=>i?-1:n).filter(n=>n>=0),record={pack,bankSlot,dest:empty[0],splitSlot:empty[1],item:actual,total:actual.q,take,before:e.count(actual),bankBefore:variantCount(items,actual)};
   if(!savePending(record))return false;
   const accepted=e.perform('bank.partial.retrieve',{rule:r,guard:()=>fingerprint(p.c.bank?.[pack]?.[bankSlot])===fingerprint(actual)&&!p.c.items[record.dest]&&!p.c.items[record.splitSlot],call:()=>p.call('bank_retrieve',pack,bankSlot,record.dest),observe:()=>!p.c.bank?.[pack]?.[bankSlot]&&identity(p.c.items[record.dest])===identity(actual)&&p.c.items[record.dest]?.q===record.total,details:{item:actual.name,quantity:record.total,pack,before:record.before}});
   if(!accepted)savePending(null);return accepted;
  }return false;
 }
 function consolidate(){
  if(!cfg.merchant.bank||!cfg.merchant.consolidate||!p.c.bank)return false;
  for(const [pack,items] of packs())for(let a=0;a<items.length;a++)for(let b=a+1;b<items.length;b++){
   const x=items[a],y=items[b],qa=x?.q??1,qb=y?.q??1;if(packMap(pack)!==p.c.map||!simple(x)||!simple(y)||!Number.isSafeInteger(qa)||!Number.isSafeInteger(qb)||qa<1||qb<1||identity(x)!==identity(y)||qa+qb>stackMax(x))continue;
   const fa=fingerprint(x),fb=fingerprint(y),total=qa+qb;
   return e.perform('bank.consolidate',{guard:()=>fingerprint(p.c.bank?.[pack]?.[a])===fa&&fingerprint(p.c.bank?.[pack]?.[b])===fb,call:()=>p.call('bank_swap',pack,a,b),observe:()=>{const row=p.c.bank?.[pack];return !!row&&((!row[a]&&identity(row[b])===identity(x)&&row[b]?.q===total)||(!row[b]&&identity(row[a])===identity(x)&&row[a]?.q===total));},details:{item:x.name,quantity:total,pack}});
  }return false;
 }
 // Consolidate exact stack variants across bank packs and inventory.
 // Each withdrawal has an independent journal; the normal inventory merger
 // then reduces the stacks. Never place into an occupied bank slot: the
 // server may SWAP instead of merging.
 function consolidateAcross(){
  if(!cfg.merchant.bank||!cfg.merchant.consolidate||!p.c.bank||
     bot.journal||bot.inventoryBlocked||bot.logistics?.reserved||
     pending||reclaiming||bot.exec.busy('inventory'))return false;
  const rows=packs().filter(([pack])=>packMap(pack)===p.c.map);
  const dest=p.c.items.findIndex(x=>!x);if(dest<0||!rows.length)return false;
  const sourceItems=rows.flatMap(([pack,items])=>items.map((item,slot)=>({pack,slot,item}))
    .filter(r=>simple(r.item)));
  for(const source of sourceItems){
   const q=source.item.q??1,max=stackMax(source.item);
   const carried=p.c.items.some(i=>simple(i)&&identity(i)===identity(source.item)&&
     (i.q??1)+q<=max);
   // Bank-only cross-pack candidates have no *carried* merge partner.
   // Retrieving them only causes the storage task to put them back unchanged.
   // An eventual two-retrieval cross-pack merge needs its own durable journal.
   if(!carried)continue;
   const fp=fingerprint(source.item),item={...source.item};
   return e.perform('bank.merge.retrieve',{guard:()=>!!p.c.bank&&
     !p.c.items[dest]&&fingerprint(p.c.bank?.[source.pack]?.[source.slot])===fp,
    call:()=>p.call('bank_retrieve',source.pack,source.slot,dest),
    observe:()=>!p.c.bank?.[source.pack]?.[source.slot]&&
      identity(p.c.items[dest])===identity(item)&&
      (p.c.items[dest]?.q??1)===q,
    details:{item:item.name,pack:source.pack,bankSlot:source.slot,
      inventorySlot:dest,quantity:q,reason:'cross-pack-merge'}});
  }
  return false;
 }
 // Maintain exactly ONE ordinary merchant stand, stored in the bank
 // unless an actual marketplace listing/wishlist needs it. Extra ordinary
 // stand0 copies are sold at NPC only when a live bank copy is verified.
 // Never sell locked, variant-bearing, equipped or other special stands.
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
     pending||reclaiming||bot.exec.busy('inventory'))return false;
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
      !bankExpansionAffordable(cost,p.c.gold,cfg.merchant.bankBudget,
       cfg.merchant.bankExpandGoldFraction??.75))continue;
   // Selecting an individually affordable pack after earlier expansions
   // would otherwise enqueue an action that fails only on the durable charge.
   if(e.bankExpansionAvailable?.(cost)!==true){
    cumulativeBudgetBlocked=true;continue;
   }
   const allowed=()=>bankExpansionAffordable(cost,p.c.gold,cfg.merchant.bankBudget,
    cfg.merchant.bankExpandGoldFraction??.75)&&e.bankExpansionAvailable(cost);
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
 function eligibleBankSale(item){
  if(!e.safe(item)||item.data!==undefined||item.p||item.title||item.stat_type||item.acc||item.rid||item.skin||item.expires||item.special||item.v||(item.level??0)>0)return null;
  const meta=p.G.items?.[item.name],price=e.value(item),explicit=e.explicit(item),original=explicit??e.rules(item);
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
 function reclaim(){
  if(!cfg.merchant.bankReclaim||!cfg.merchant.bank||bot.free()<1)return false;
  const rows=packs().filter(([pack])=>packMap(pack)===p.c.map);
  const free=rows.reduce((n,[,items])=>n+items.filter(i=>!i).length,0);
  const pressed=rows.length>0&&free<(cfg.merchant.bankWorkspace??2);
  if(!pressed){
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
  const {item,pack,slot}=selected,q=item.q??1,dest=p.c.items.findIndex(i=>!i),before=e.count(item),bankBefore=variantCount(p.c.bank[pack],item),fp=fingerprint(item);
  if(dest<0)return false;
  const record={item:{...item},pack,slot,dest,before,bankBefore,quantity:q,gold:p.c.gold,sourcePrint:fp,expectedSaleGold:e.value(item)*q};
  if(!p.write(reclaimKey,record))return false;reclaiming=record;
  return e.perform('bank.reclaim',{guard:()=>fingerprint(p.c.bank?.[pack]?.[slot])===fp&&!p.c.items[dest]&&!!eligibleBankSale(p.c.bank[pack][slot]),
   call:()=>p.call('bank_retrieve',pack,slot,dest),
   observe:()=>!p.c.bank?.[pack]?.[slot]&&identity(p.c.items[dest])===identity(item)&&(p.c.items[dest]?.q??1)===q,
   details:{item:item.name,quantity:q,pack,lossScore:selected.lossScore,reason:'Bankdruck: geringster risikobereinigter Verlust'}});
 }
 function recoverCapacity(){if(!reclaiming)return false;if(bot.journal||bot.inventoryBlocked)return true;const r=reclaiming;
  if(!r.item||!e.safe(r.item)||!/^items\d+$/.test(r.pack)||![r.quantity,r.before,r.bankBefore,r.dest,r.slot].every(Number.isSafeInteger)||r.quantity<1||r.dest<0||r.dest>=p.c.items.length){bot.inventoryBlocked=true;e.note('Bankfreigabe: ungültiger Checkpoint');return true;}
  const count=e.count(r.item),bank=variantCount(p.c.bank?.[r.pack]??[],r.item);
  // A global item count or unrelated gold income cannot prove a sale.
  // Require both addressed slots and the exact NPC receipt.
  if(count===r.before&&
     !p.c.bank?.[r.pack]?.[r.slot]&&
     !p.c.items[r.dest]&&
     Number.isSafeInteger(r.expectedSaleGold)&&
     r.saleConfirmed===true){
    if(p.write(reclaimKey,null))reclaiming=null;return true;
  }
  if(count===r.before&&p.c.bank&&bank===r.bankBefore&&
     fingerprint(p.c.bank?.[r.pack]?.[r.slot])===r.sourcePrint&&!p.c.items[r.dest]){
     if(p.write(reclaimKey,null))reclaiming=null;return true;
  }
  const item=p.c.items[r.dest],rule=item?eligibleBankSale(item)?.r:null;
  if(count===r.before+r.quantity&&identity(item)===identity(r.item)&&rule?.action==='sell'&&!!eligibleBankSale(item)&&e.spare(r.dest,rule)>=r.quantity){e.npcSell(r.dest,{...rule,batch:r.quantity},{onConfirmed:()=>{
   const next={...r,saleConfirmed:true};if(!p.write(reclaimKey,next))return false;
   reclaiming=next;return true;
  }});return true;}
  e.note('Bankfreigabe: Bestand oder Verkaufsregel geändert; Auftrag benötigt Prüfung');return true;
 }
 function capacity(){return packs().map(([pack,items])=>({pack,map:packMap(pack),size:items.length,used:items.filter(Boolean).length,free:items.filter(i=>!i).length,workspace:cfg.merchant.bankWorkspace??0}));}
 function gold(){
  if(!cfg.merchant.bank||!cfg.merchant.bankGold||!p.c.bank||me.name!==cfg.party.merchant)return false;
  const commitments=Object.entries(p.c.slots??{}).reduce((n,[k,i])=>n+(k.startsWith('trade')&&i?.b?Math.max(0,Number(i.price)||0)*Math.max(1,Number(i.q)||1):0),0);
  const target=Math.max(cfg.merchant.goldTarget,cfg.merchant.goldReserve,me.goldReserve??0)+commitments,before=p.c.gold,stored=p.c.bank.gold;
  if(!Number.isFinite(stored)||before===target)return false;
  const depositing=before>target,q=depositing?before-target:Math.min(target-before,stored);if(q<=0)return false;
  return e.perform('bank.gold',{guard:()=>p.c.gold===before&&p.c.bank?.gold===stored,call:()=>p.call(depositing?'bank_deposit':'bank_withdraw',q),observe:()=>p.c.gold===before+(depositing?-q:q)&&p.c.bank?.gold===stored+(depositing?q:-q),details:{quantity:q,before}});
 }
 // Safe consolidation precedes evidence-based, rule-bound bank reclaim.
 function audit(){if(!cfg.merchant.bank||!p.c.bank||bot.inventoryBlocked||bot.journal)return false;
  return consolidateInventory()||consolidate()||consolidateAcross()||reclaim();}
 return {store,park,retrieve,consolidate,consolidateAcross,consolidateInventory,audit,manageStand,gold,expand,reclaim,recoverCapacity,capacity,packs,catalogStock,catalogStatus:()=>({revision:catalog.revision,observedAt:catalog.observedAt,ageMs:catalog.observedAt?Date.now()-catalog.observedAt:null,planningRows:catalogStock().length}),ready,recover,stock,pressureStatus:()=>({...pressure}),inspect(){if(!ready())return false;packs();return observed;},get observed(){packs();return observed;},get reclaiming(){return !!reclaiming;},get pending(){return !!(pending||reclaiming);},status:()=>pending?{item:pending.item?.name,quantity:pending.take,total:pending.total,pack:pending.pack}:null};
}
