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
 let observed=false,stockRows=[],packEpoch=-1,packCache=null;
 const packs=()=>{if(packCache&&Number.isInteger(bot.decisionEpoch)&&packEpoch===bot.decisionEpoch)return packCache;const rows=Object.entries(p.c.bank??{}).filter(([name,items])=>/^items\d+$/.test(name)&&Array.isArray(items)).map(([name,items])=>[name,Array.from({length:Math.max(42,items.length)},(_,n)=>items[n]??null)]);if(rows.length){observed=true;stockRows=rows.flatMap(([pack,items])=>items.filter(i=>e.safe(i)&&e.explicit(i)?.action!=='keep').map(i=>({pack,item:{...i}}))).slice(0,2000);}packEpoch=bot.decisionEpoch;packCache=rows;return rows;};
 const stock=(name,level,wanted=Infinity)=>{packs();return stockRows.reduce((n,r)=>n+(r.item.name===name&&(r.item.level??0)===level&&(cfg.merchant.partialBank||(r.item.q??1)<=wanted)?(r.item.q??1):0),0);};
 const packFor=item=>{packs();return stockRows.find(r=>identity(r.item)===identity(item))?.pack;};
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
   return e.perform('bank.store',{slots:[slot],rule:r,guard:()=>!!p.c.bank&&fingerprint(p.c.bank[pack][dest])===targetPrint&&e.spare(slot,r)>=q,
    call:()=>p.call('bank_store',slot,pack,dest),observe:()=>e.count(item)===before-q&&variantCount(p.c.bank?.[pack]??[],item)===bankBefore+q,details:{item:item.name,quantity:q,pack,before}});
  }if(consolidate()||reclaim()||!r.pack&&expand())return true;e.note('Bank voll: kein freier erlaubter Platz; erlaubte Konsolidierung, Verkauf und Erweiterungsbudget geprüft');return false;
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
   const x=items[a],y=items[b];if(packMap(pack)!==p.c.map||!e.safe(x)||!e.safe(y)||!x.q||!y.q||identity(x)!==identity(y)||x.q+y.q>(p.G.items[x.name]?.s??0))continue;
   const fa=fingerprint(x),fb=fingerprint(y),total=x.q+y.q;
   return e.perform('bank.consolidate',{guard:()=>fingerprint(p.c.bank?.[pack]?.[a])===fa&&fingerprint(p.c.bank?.[pack]?.[b])===fb,call:()=>p.call('bank_swap',pack,a,b),observe:()=>{const row=p.c.bank?.[pack];return !!row&&((!row[a]&&row[b]?.q===total)||(!row[b]&&row[a]?.q===total));},details:{item:x.name,quantity:total,pack}});
  }return false;
 }
 function expand(){
  if(!cfg.merchant.bank||!cfg.merchant.expandBank||!p.c.bank)return false;
  for(const [pack,def] of Object.entries(definitions()).sort((a,b)=>(a[1][1]??Infinity)-(b[1][1]??Infinity))){const cost=def[1];if(def[0]!==p.c.map||p.c.bank[pack]||!Number.isFinite(cost)||cost<=0||cost>cfg.merchant.bankBudget)continue;
   return e.perform('bank.expand',{cost,guard:()=>!!p.c.bank&&!p.c.bank[pack],call:()=>p.call('open_bank_pack',pack,'gold'),observe:()=>Array.isArray(p.c.bank?.[pack]),details:{pack}});
  }return false;
 }
 function reclaim(){if(!cfg.merchant.bankReclaim||!cfg.merchant.bank||bot.free()<=cfg.merchant.minFreeSlots)return false;
  for(const [pack,items] of packs()){if(packMap(pack)!==p.c.map||items.filter(i=>!i).length>=(cfg.merchant.bankWorkspace??2))continue;
   for(let slot=0;slot<items.length;slot++){const item=items[slot],r=item&&(e.explicit(item)??bot.intelligence?.disposition(item));if(!e.safe(item)||r?.action!=='sell'||!e.remaining(r)||r.keep||r.teamReserve||(item.q??1)>r.batch||e.count(item)+(item.q??1)>r.maxCount||!Number.isFinite(e.value(item))||e.value(item)<r.minPrice||bot.production?.reserved(item)||bot.production?.status().steps?.some(s=>s.item===item.name)||(cfg.production.goals??[]).some(g=>g.enabled&&g.item===item.name)||(cfg.production.gearTargets??[]).some(g=>g.enabled&&g.item===item.name))continue;
    const before=e.count(item),bankBefore=variantCount(items,item),fp=fingerprint(item),dest=p.c.items.findIndex(i=>!i),q=item.q??1;
    const record={item:{...item},pack,slot,dest,before,bankBefore,quantity:q,gold:p.c.gold};if(!p.write(reclaimKey,record))return false;reclaiming=record;
    return e.perform('bank.reclaim',{guard:()=>fingerprint(p.c.bank?.[pack]?.[slot])===fp&&!p.c.items[dest],call:()=>p.call('bank_retrieve',pack,slot,dest),observe:()=>e.count(item)===before+q&&variantCount(p.c.bank?.[pack]??[],item)===bankBefore-q,details:{item:item.name,quantity:q,pack,reason:'Bankdruck; explizite NPC-Verkaufsregel ohne Reserven'}});
   }
  }return false;
 }
 function recoverCapacity(){if(!reclaiming)return false;if(bot.journal||bot.inventoryBlocked)return true;const r=reclaiming;
  if(!r.item||!e.safe(r.item)||!/^items\d+$/.test(r.pack)||![r.quantity,r.before,r.bankBefore,r.dest,r.slot].every(Number.isSafeInteger)||r.quantity<1||r.dest<0||r.dest>=p.c.items.length){bot.inventoryBlocked=true;e.note('Bankfreigabe: ungültiger Checkpoint');return true;}
  const count=e.count(r.item),bank=variantCount(p.c.bank?.[r.pack]??[],r.item);
  if(count===r.before&&p.c.gold>r.gold){if(p.write(reclaimKey,null))reclaiming=null;return true;}
  if(count===r.before&&p.c.bank&&bank===r.bankBefore){if(p.write(reclaimKey,null))reclaiming=null;return true;}
  const item=p.c.items[r.dest],rule=item&&(e.explicit(item)??bot.intelligence?.disposition(item));
  if(count===r.before+r.quantity&&identity(item)===identity(r.item)&&rule?.action==='sell'&&e.spare(r.dest,rule)>=r.quantity){e.npcSell(r.dest,{...rule,batch:r.quantity});return true;}
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
 return {store,retrieve,consolidate,gold,expand,reclaim,recoverCapacity,capacity,packs,ready,recover,stock,inspect(){if(!ready())return false;packs();return observed;},get observed(){packs();return observed;},get reclaiming(){return !!reclaiming;},get pending(){return !!(pending||reclaiming);},status:()=>pending?{item:pending.item?.name,quantity:pending.take,total:pending.total,pack:pending.pack}:null};
}
