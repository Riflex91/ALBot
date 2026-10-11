import {identity,fingerprint,variantCount} from '../core/policy.mjs';
export function createBank(bot){
 const {p,cfg,me}=bot,e=bot.economy;
 const pendingKey='albot:bank-partial:'+me.name;let pending=p.read(pendingKey)??null;
 const reclaimKey='albot:bank-reclaim:'+me.name;let reclaiming=p.read(reclaimKey)??null;
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
   e.perform('bank.partial.retrieve',{guard:()=>matches(p.c.bank?.[r.pack]?.[r.bankSlot],r.total)&&!p.c.items[r.dest]&&!p.c.items[r.splitSlot],call:()=>p.call('bank_retrieve',r.pack,r.bankSlot,r.dest),observe:()=>e.count(r.item)===r.before+r.total&&variantCount(p.c.bank?.[r.pack]??[],r.item)===r.bankBefore-r.total,details:{item:r.item.name,quantity:r.total,pack:r.pack,before:r.before}});return true;
  }
  if(inventory===r.before+r.total&&bank===r.bankBefore-r.total&&!row?.[r.bankSlot]){
   if(matches(p.c.items[r.dest],r.total)&&!p.c.items[r.splitSlot]&&p.c.items.findIndex(i=>!i)===r.splitSlot){
    e.perform('bank.partial.split',{slots:[r.dest],guard:()=>!p.c.items[r.splitSlot]&&p.c.items.findIndex(i=>!i)===r.splitSlot,call:()=>p.call('split',r.dest,r.take),observe:()=>matches(p.c.items[r.dest],rest)&&matches(p.c.items[r.splitSlot],r.take),details:{item:r.item.name,quantity:r.take}});return true;
   }
   if(matches(p.c.items[r.dest],rest)&&matches(p.c.items[r.splitSlot],r.take)){
    e.perform('bank.partial.return',{slots:[r.dest],guard:()=>!p.c.bank?.[r.pack]?.[r.bankSlot]&&matches(p.c.items[r.splitSlot],r.take),call:()=>p.call('bank_store',r.dest,r.pack,r.bankSlot),observe:()=>e.count(r.item)===r.before+r.take&&variantCount(p.c.bank?.[r.pack]??[],r.item)===r.bankBefore-r.take,details:{item:r.item.name,quantity:rest,pack:r.pack}});return true;
   }
  }
  bot.inventoryBlocked=true;e.note('Bank-Teilentnahme: Bestand weicht vom Checkpoint ab; manuell prüfen');return true;
 }
 let observed=false,stockRows=[],packEpoch=-1,packCache=null,stockObservedAt=0,stockObservedMap=null;
 // Server-approved plain stack candidates; require an exact item variant.
 const stackMax=i=>{const limit=bot.p.G.items?.[i?.name]?.s;return limit===true?9999:Number.isSafeInteger(limit)&&limit>1?limit:0;};
 const simple=i=>e.safe(i)&&stackMax(i)>1&&!i.data&&!i.p&&!i.title&&!i.stat_type&&!i.acc&&!i.rid&&!i.special&&!i.v;
 function consolidateInventory(){
  if(bot.journal||bot.inventoryBlocked||bot.logistics?.reserved)return false;
  for(let a=0;a<p.c.items.length;a++)for(let b=a+1;b<p.c.items.length;b++){
   const x=p.c.items[a],y=p.c.items[b];
   if(!simple(x)||!simple(y)||identity(x)!==identity(y)||!Number.isSafeInteger(x.q)||!Number.isSafeInteger(y.q)||x.q<1||y.q<1||x.q+y.q>stackMax(x))continue;
   const fa=fingerprint(x),fb=fingerprint(y),total=x.q+y.q;
   return e.perform('inventory.consolidate',{slots:[a,b],
    guard:()=>fingerprint(p.c.items[a])===fa&&fingerprint(p.c.items[b])===fb,
    call:()=>p.call('swap',a,b),
    observe:()=>identity(p.c.items[a])===identity(x)&&p.c.items[a]?.q===total&&!p.c.items[b],
    details:{item:x.name,quantity:total,from:b,to:a}});
  }
  return false;
 }
 const packs=()=>{if(packCache&&Number.isInteger(bot.decisionEpoch)&&packEpoch===bot.decisionEpoch)return packCache;const rows=Object.entries(p.c.bank??{}).filter(([name,items])=>/^items\d+$/.test(name)&&Array.isArray(items)).map(([name,items])=>[name,Array.from({length:Math.max(42,items.length)},(_,n)=>items[n]??null)]);if(rows.length){observed=true;stockObservedAt=Date.now();stockObservedMap=p.c.map;stockRows=rows.flatMap(([pack,items])=>items.filter(i=>e.safe(i)&&e.explicit(i)?.action!=='keep').map(i=>({pack,item:{...i}}))).slice(0,2000);}packEpoch=bot.decisionEpoch;packCache=rows;return rows;};
 const stock=(name,level,wanted=Infinity)=>{packs();if(Date.now()-stockObservedAt>120000||!p.c.bank||stockObservedMap!==p.c.map)return 0;return stockRows.reduce((n,r)=>n+(r.item.name===name&&(r.item.level??0)===level&&(cfg.merchant.partialBank||(r.item.q??1)<=wanted)?(r.item.q??1):0),0);};
 const packFor=item=>{packs();if(Date.now()-stockObservedAt>120000||!p.c.bank||stockObservedMap!==p.c.map)return null;return stockRows.find(r=>identity(r.item)===identity(item))?.pack;};
 const definitions=()=>p.G.bank_packs??p.root?.bank_packs??p.parent?.bank_packs??{};
 const packMap=pack=>definitions()[pack]?.[0]??(/^items[0-7]$/.test(pack)?'bank':null);
 const location=map=>({map,in:map,x:0,y:-100,radius:80});
 function ready(pack='items0',recovery=false){const map=packMap(pack);return !!map&&(cfg.merchant.bank||recovery)&&me.name===cfg.party.merchant&&e.travel(location(map),'Bank')&&!!p.c.bank;}
 function store(slot,r){
  const item=p.c.items[slot];if(!e.safe(item)||e.spare(slot,r)<1)return false;
  const allowed=e.spare(slot,r);if(allowed<(item.q??1)){
   if(bot.free()<=cfg.merchant.minFreeSlots)return false;const before=item.q,dest=p.c.items.findIndex(x=>!x);
   return e.perform('bank.split',{slots:[slot],rule:r,guard:()=>!p.c.items[dest]&&e.spare(slot,r)>=allowed,call:()=>p.call('split',slot,allowed),observe:()=>p.c.items[slot]?.q===before-allowed&&p.c.items.some((x,n)=>n!==slot&&identity(x)===identity(item)&&x.q===allowed),details:{item:item.name,quantity:allowed,before}});
  }
  const rows=packs(),preferred=r.pack||rows.find(([,items])=>items.some(i=>e.safe(i)&&identity(i)===identity(item)&&(i.q??1)+(item.q??1)<=(p.G.items[item.name]?.s??0)))?.[0]||rows.find(([,items])=>items.some(i=>!i))?.[0]||'items0';
  if(!ready(preferred))return false;
  for(const [pack,items] of packs()){
   if((r.pack&&r.pack!==pack)||packMap(pack)!==p.c.map)continue;
   const compatible=items.findIndex(i=>e.safe(i)&&identity(i)===identity(item)&&i.q&&(i.q+(item.q??1))<=(p.G.items[item.name]?.s??0));
   const dest=compatible>=0?compatible:items.findIndex(i=>!i);if(dest<0)continue;
   const before=e.count(item),bankBefore=variantCount(items,item),q=item.q??1;
   const targetPrint=fingerprint(p.c.bank[pack][dest]);
   const targetBefore=p.c.bank[pack][dest];
   const targetQuantity=targetBefore?(targetBefore.q??1):0;
   // A concurrent delivery or other legitimate inventory update can change
   // the character-wide quantity while the bank request is in flight. Observe
   // the exact source slot and addressed bank stack instead of an aggregate
   // count that is unrelated to the bank transfer's success.
   return e.perform('bank.store',{slots:[slot],rule:r,guard:()=>!!p.c.bank&&fingerprint(p.c.bank[pack][dest])===targetPrint&&e.spare(slot,r)>=q,
    call:()=>p.call('bank_store',slot,pack,dest),
    observe:()=>!p.c.items[slot]&&identity(p.c.bank?.[pack]?.[dest])===identity(item)&&(p.c.bank[pack][dest].q??1)===targetQuantity+q,
    details:{item:item.name,quantity:q,pack,before,sourceSlot:slot,bankSlot:dest,bankTargetBefore:targetPrint,bankTargetQuantity:targetQuantity}});
  }if(consolidate()||!r.pack&&expand()||reclaim())return true;e.note('Bank voll: kein freier erlaubter Platz; erlaubte Konsolidierung, Verkauf und Erweiterungsbudget geprüft');return false;
 }
 function retrieve(item,r,wanted){
  if(pending)return recover();
  if(!ready(r.pack||packFor(item)||'items0')||bot.free()<=cfg.merchant.minFreeSlots)return false;
  for(const [pack,items] of packs()){
   if((r.pack&&r.pack!==pack)||packMap(pack)!==p.c.map)continue;
   const slot=items.findIndex(i=>i&&identity(i)===identity(item)&&e.safe(i)&&(i.q??1)<=Math.min(wanted,r.batch,r.maxCount-e.count(item)));
   if(slot<0)continue;const actual=items[slot],q=actual.q??1,fp=fingerprint(actual),dest=p.c.items.findIndex(i=>!i),before=e.count(actual),bankBefore=variantCount(items,actual);
   return e.perform('bank.retrieve',{rule:r,guard:()=>fingerprint(p.c.bank?.[pack]?.[slot])===fp&&!p.c.items[dest],call:()=>p.call('bank_retrieve',pack,slot,dest),observe:()=>e.count(actual)===before+q&&variantCount(p.c.bank?.[pack]??[],actual)===bankBefore-q,details:{item:actual.name,quantity:q,pack,before}});
  }
  if(!cfg.merchant.partialBank)return false;
  const take=Math.floor(Math.min(wanted,r.batch,r.maxCount-e.count(item)));if(take<1||!e.remaining(r)||bot.journal||bot.logistics.reserved||bot.inventoryBlocked||bot.exec.busy('inventory')||bot.free()<cfg.merchant.minFreeSlots+2)return false;
  for(const [pack,items] of packs()){
   if((r.pack&&r.pack!==pack)||packMap(pack)!==p.c.map)continue;
   const bankSlot=items.findIndex(i=>e.safe(i)&&identity(i)===identity(item)&&Number.isSafeInteger(i.q)&&i.q>take&&i.q<=(cfg.merchant.partialBankMaxStack??9999));if(bankSlot<0)continue;
   const actual=structuredClone(items[bankSlot]),empty=p.c.items.map((i,n)=>i?-1:n).filter(n=>n>=0),record={pack,bankSlot,dest:empty[0],splitSlot:empty[1],item:actual,total:actual.q,take,before:e.count(actual),bankBefore:variantCount(items,actual)};
   if(!savePending(record))return false;
   const accepted=e.perform('bank.partial.retrieve',{rule:r,guard:()=>fingerprint(p.c.bank?.[pack]?.[bankSlot])===fingerprint(actual)&&!p.c.items[record.dest]&&!p.c.items[record.splitSlot],call:()=>p.call('bank_retrieve',pack,bankSlot,record.dest),observe:()=>e.count(actual)===record.before+record.total&&variantCount(p.c.bank?.[pack]??[],actual)===record.bankBefore-record.total,details:{item:actual.name,quantity:record.total,pack,before:record.before}});
   if(!accepted)savePending(null);return accepted;
  }return false;
 }
 function consolidate(){
  if(!cfg.merchant.bank||!cfg.merchant.consolidate||!p.c.bank)return false;
  for(const [pack,items] of packs())for(let a=0;a<items.length;a++)for(let b=a+1;b<items.length;b++){
   const x=items[a],y=items[b];if(packMap(pack)!==p.c.map||!simple(x)||!simple(y)||!Number.isSafeInteger(x.q)||!Number.isSafeInteger(y.q)||x.q<1||y.q<1||identity(x)!==identity(y)||x.q+y.q>stackMax(x))continue;
   const fa=fingerprint(x),fb=fingerprint(y),total=x.q+y.q;
   return e.perform('bank.consolidate',{guard:()=>fingerprint(p.c.bank?.[pack]?.[a])===fa&&fingerprint(p.c.bank?.[pack]?.[b])===fb,call:()=>p.call('bank_swap',pack,a,b),observe:()=>{const row=p.c.bank?.[pack];return !!row&&((!row[a]&&identity(row[b])===identity(x)&&row[b]?.q===total)||(!row[b]&&identity(row[a])===identity(x)&&row[a]?.q===total));},details:{item:x.name,quantity:total,pack}});
  }return false;
 }
 function expand(){
  if(!cfg.merchant.bank||!cfg.merchant.expandBank||!p.c.bank)return false;
  for(const [pack,def] of Object.entries(definitions()).sort((a,b)=>(a[1][1]??Infinity)-(b[1][1]??Infinity))){const cost=def[1];if(def[0]!==p.c.map||p.c.bank[pack]||!Number.isFinite(cost)||cost<=0||cost>cfg.merchant.bankBudget)continue;
   return e.perform('bank.expand',{cost,guard:()=>!!p.c.bank&&!p.c.bank[pack],call:()=>p.call('open_bank_pack',pack,'gold'),observe:()=>Array.isArray(p.c.bank?.[pack]),details:{pack}});
  }return false;
 }
 // v3-guided conservative capacity recovery: non-destructive measures
 // first, then the least-loss eligible item only.
 function eligibleBankSale(item){
  if(!e.safe(item)||item.data!==undefined||item.p||item.title||item.stat_type||item.acc||item.rid||item.skin||item.expires||item.special||item.v||(item.level??0)>0)return null;
  const meta=p.G.items?.[item.name],price=e.value(item),explicit=e.explicit(item),r=explicit??e.rules(item);
  if(meta&&(meta.quest||meta.q||meta.e||meta.exchange||meta.event||meta.cash||meta.cash_item||meta.soulbound||meta.compound||meta.upgrade||meta.rare||meta.rarity||meta.action||meta.onclick||meta.offering||meta.throw||meta.ignore||meta.wtype||meta.class||meta.grades||meta.tier))return null;
  if(!meta||!Number.isFinite(price)||price<0||r?.action!=='sell'||!e.remaining(r)||r.keep||r.teamReserve||(item.q??1)>r.batch||e.count(item)+(item.q??1)>r.maxCount||price<r.minPrice)return null;
  if(bot.production?.reserved(item)||bot.production?.reservedQuantity?.(item)>0||bot.production?.status()?.steps?.some(step=>step.item===item.name)||(cfg.production.goals??[]).some(g=>g.enabled&&g.item===item.name)||(cfg.production.gearTargets??[]).some(g=>g.enabled&&g.item===item.name)||bot.intelligence?.futureGear?.(item))return null;
  if(!explicit){
   // Synthetic permission only for one plain, stackable, low-risk material.
   if(!cfg.production.autoDisposition||!r._autoDisposition||(item.q??1)!==1||meta.type!=='material'||stackMax(item)<2)return null;
   if(meta.quest||meta.q||meta.e||meta.exchange||meta.event||meta.cash||meta.cash_item||meta.soulbound||meta.compound||meta.upgrade||meta.rare||meta.rarity||meta.action||meta.onclick||meta.offering||meta.throw||meta.ignore||meta.wtype||meta.class||meta.grades||meta.tier)return null;
  }
  const rarity=Number(meta.rarity??meta.rare??0),difficulty=Number(meta.difficulty??0);
  if(!Number.isFinite(rarity)||!Number.isFinite(difficulty)||rarity<0||difficulty<0)return null;
  return {r,price,lossScore:price+rarity*1000000+difficulty*100000+1000/Math.max(1,item.q??1)};
 }
 function reclaim(){
  if(!cfg.merchant.bankReclaim||!cfg.merchant.bank||bot.free()<=cfg.merchant.minFreeSlots)return false;
  const pressure=packs().some(([pack,items])=>packMap(pack)===p.c.map&&items.filter(i=>!i).length<(cfg.merchant.bankWorkspace??2));
  if(!pressure)return false;
  if(consolidate()||expand())return true;
  const candidates=[];
  for(const [pack,items] of packs()){
   if(packMap(pack)!==p.c.map||items.filter(i=>!i).length>=(cfg.merchant.bankWorkspace??2))continue;
   for(let slot=0;slot<items.length;slot++){
    const item=items[slot],safe=eligibleBankSale(item);
    if(safe)candidates.push({...safe,pack,slot,item});
   }
  }
  candidates.sort((a,b)=>a.lossScore-b.lossScore||a.price-b.price||a.item.name.localeCompare(b.item.name)||a.slot-b.slot);
  const selected=candidates[0];if(!selected)return false;
  const {item,pack,slot}=selected,q=item.q??1,dest=p.c.items.findIndex(i=>!i),before=e.count(item),bankBefore=variantCount(p.c.bank[pack],item),fp=fingerprint(item);
  if(dest<0)return false;
  const record={item:{...item},pack,slot,dest,before,bankBefore,quantity:q,gold:p.c.gold};
  if(!p.write(reclaimKey,record))return false;reclaiming=record;
  return e.perform('bank.reclaim',{guard:()=>fingerprint(p.c.bank?.[pack]?.[slot])===fp&&!p.c.items[dest]&&!!eligibleBankSale(p.c.bank[pack][slot]),
   call:()=>p.call('bank_retrieve',pack,slot,dest),
   observe:()=>e.count(item)===before+q&&variantCount(p.c.bank?.[pack]??[],item)===bankBefore-q,
   details:{item:item.name,quantity:q,pack,lossScore:selected.lossScore,reason:'Bankdruck: geringster risikobereinigter Verlust'}});
 }
 function recoverCapacity(){if(!reclaiming)return false;if(bot.journal||bot.inventoryBlocked)return true;const r=reclaiming;
  if(!r.item||!e.safe(r.item)||!/^items\d+$/.test(r.pack)||![r.quantity,r.before,r.bankBefore,r.dest,r.slot].every(Number.isSafeInteger)||r.quantity<1||r.dest<0||r.dest>=p.c.items.length){bot.inventoryBlocked=true;e.note('Bankfreigabe: ungültiger Checkpoint');return true;}
  const count=e.count(r.item),bank=variantCount(p.c.bank?.[r.pack]??[],r.item);
  if(count===r.before&&p.c.gold>r.gold){if(p.write(reclaimKey,null))reclaiming=null;return true;}
  if(count===r.before&&p.c.bank&&bank===r.bankBefore){if(p.write(reclaimKey,null))reclaiming=null;return true;}
  const item=p.c.items[r.dest],rule=item&&(e.explicit(item)??e.rules(item));
  if(count===r.before+r.quantity&&identity(item)===identity(r.item)&&rule?.action==='sell'&&!!eligibleBankSale(item)&&e.spare(r.dest,rule)>=r.quantity){e.npcSell(r.dest,{...rule,batch:r.quantity});return true;}
  e.note('Bankfreigabe: Bestand oder Verkaufsregel geändert; Auftrag benötigt Prüfung');return true;
 }
 function capacity(){return packs().map(([pack,items])=>({pack,map:packMap(pack),used:items.filter(Boolean).length,free:items.filter(i=>!i).length,workspace:cfg.merchant.bankWorkspace??0}));}
 function gold(){
  if(!cfg.merchant.bank||!cfg.merchant.bankGold||!p.c.bank||me.name!==cfg.party.merchant)return false;
  const commitments=Object.entries(p.c.slots??{}).reduce((n,[k,i])=>n+(k.startsWith('trade')&&i?.b?Math.max(0,Number(i.price)||0)*Math.max(1,Number(i.q)||1):0),0);
  const target=Math.max(cfg.merchant.goldTarget,cfg.merchant.goldReserve,me.goldReserve??0)+commitments,before=p.c.gold,stored=p.c.bank.gold;
  if(!Number.isFinite(stored)||before===target)return false;
  const depositing=before>target,q=depositing?before-target:Math.min(target-before,stored);if(q<=0)return false;
  return e.perform('bank.gold',{guard:()=>p.c.gold===before&&p.c.bank?.gold===stored,call:()=>p.call(depositing?'bank_deposit':'bank_withdraw',q),observe:()=>p.c.gold===before+(depositing?-q:q)&&p.c.bank?.gold===stored+(depositing?q:-q),details:{quantity:q,before}});
 }
 return {store,retrieve,consolidate,consolidateInventory,gold,expand,reclaim,recoverCapacity,capacity,packs,ready,recover,stock,inspect(){if(!ready())return false;packs();return observed;},get observed(){packs();return observed;},get reclaiming(){return !!reclaiming;},get pending(){return !!(pending||reclaiming);},status:()=>pending?{item:pending.item?.name,quantity:pending.take,total:pending.total,pack:pending.pack}:null};
}
