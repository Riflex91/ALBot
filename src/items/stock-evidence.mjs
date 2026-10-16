import {protectedItem} from '../core/policy.mjs';

// Read-only, bounded evidence. A heartbeat is peer-attested, NOT a transfer
// receipt or permission to spend, sell, send, retrieve, or equip any item.
const accountStockFields=['stat_type','p','title','acc','rid','data'];
const accountStockKey=i=>JSON.stringify([i.name,i.level??0,...accountStockFields.map(k=>i[k]??null)]);
const accountStockValidId=x=>typeof x==='string'&&x.length>0&&x.length<=100;
const accountStockInt=(x,max=1e7)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
export function inventoryStockEvidence(items,{
 owner,session,realm,at=Date.now(),maxRows=12,reserved=()=>0
}={}){
 const bad=reason=>({version:1,owner,session,realm,at,
  complete:false,reason,rows:[],slotCount:0});
 if(!Array.isArray(items)||items.length>50||!accountStockValidId(owner)||
    !accountStockValidId(session)||!accountStockValidId(realm)||!accountStockInt(at,Number.MAX_SAFE_INTEGER)||
    !accountStockInt(maxRows,32)||maxRows<1)return bad('invalid-inventory-context');
 const rows=new Map();
 for(const entry of items){
  if(!entry)continue;
  if(!accountStockValidId(entry.name)||!accountStockInt(entry.level??0,99)||
     !accountStockInt(entry.q??1)||!(entry.q??1)||
     accountStockFields.some(k=>entry[k]!==undefined&&(
       ['acc','rid'].includes(k)?!['string','number'].includes(typeof entry[k]):
       k==='data'?typeof entry[k]!=='string'||entry[k].length>120:
       typeof entry[k]!=='string'||entry[k].length>80)))
   return bad('unknown-inventory-variant');
  const signature={name:entry.name,level:entry.level??0};
  for(const k of accountStockFields)if(entry[k]!==undefined)signature[k]=entry[k];
  const key=accountStockKey(signature),quantity=entry.q??1;
  let row=rows.get(key);
  if(!row){
   if(rows.size>=maxRows)return bad('inventory-exceeds-heartbeat-budget');
   row={item:signature,quantity:0,protectedUnits:0,reservedUnits:0};
   rows.set(key,row);
  }
  if(!accountStockInt(row.quantity+quantity))return bad('inventory-count-overflow');
  row.quantity+=quantity;
  if(protectedItem(entry))row.protectedUnits+=quantity;
  else{
   let held;try{held=reserved(entry);}catch{return bad('reservation-unverified');}
   if(!accountStockInt(held))return bad('reservation-unverified');
   // One owner-level reservation applies to a whole variant, not per stack.
   row.reservedUnits=Math.max(row.reservedUnits,held);
  }
 }
 return {version:1,owner,session,realm,at,
  complete:true,reason:null,rows:[...rows.values()],slotCount:items.filter(Boolean).length};
}
export function reconcileStockEvidence({
 local,peers=[],bank=[],owner,session,realm,now=Date.now(),
 ttlMs=10000,expected=[]
}={}){
 const reasons=[],sources=[],bankRows=[];
 const valid=(r,s)=>{
  if(!r||r.version!==1||r.complete!==true||
    r.owner!==s.owner||r.session!==s.session||r.realm!==realm||
    !accountStockInt(r.at,Number.MAX_SAFE_INTEGER)||r.at>now||
    now-r.at>ttlMs||!Array.isArray(r.rows)||r.rows.length>12||
    !accountStockInt(r.slotCount,50))return false;
  const unique=new Set();
  for(const x of r.rows){
   if(!accountStockValidId(x?.item?.name)||
     !accountStockInt(x.item.level??0,99)||
     accountStockFields.some(k=>x.item[k]!==undefined&&(
       ['acc','rid'].includes(k)?
        !['string','number'].includes(typeof x.item[k]):
       typeof x.item[k]!=='string'||x.item[k].length>(k==='data'?120:80)))||
     !accountStockInt(x.quantity)||x.quantity<1||
     !accountStockInt(x.protectedUnits)||
     !accountStockInt(x.reservedUnits)||
     x.protectedUnits>x.quantity)return false;
   const key=accountStockKey(x.item);
   if(unique.has(key))return false;
   unique.add(key);
  }
  return r.slotCount>=r.rows.length;
 };
 const emit=(name,proof,trusted)=>{
  const status=trusted&&valid(proof,{owner:name,session:trusted.session})?
   'fresh':'unverified';
  if(status!=='fresh')reasons.push(name+':'+(proof?.reason??'missing-or-stale-evidence'));
  sources.push({owner:name,session:trusted?.session??null,realm,status,
   rows:status==='fresh'?proof.rows:[]});
 };
 const liveIdentity=accountStockValidId(owner)&&accountStockValidId(session)&&accountStockValidId(realm);
 emit(owner,local,liveIdentity?{session}:null);
 const seen=new Set([owner]);
 for(const peer of peers){
  const name=peer?.name;if(!accountStockValidId(name)||seen.has(name))continue;
  seen.add(name);
  const eligible=peer.running===true&&!peer.rip&&peer.realm===realm&&
   accountStockValidId(peer.session)&&accountStockInt(peer.received,Number.MAX_SAFE_INTEGER)&&
   peer.received<=now&&now-peer.received<=ttlMs&&
   !peer.inventoryBlocked&&!peer.journal&&!peer.reserved&&!peer.lifecycleChanging;
  emit(name,peer.inventoryEvidence,eligible?{session:peer.session}:null);
 }
 for(const name of expected){
  if(accountStockValidId(name)&&!seen.has(name)){
   seen.add(name);emit(name,null,null);
  }
 }
 // Persisted bank catalog is deliberately NOT authoritative for a current
 // physical stock balance, because the bank can have changed since inspection.
 for(const row of bank.slice(0,128)){
  if(!accountStockValidId(row?.item?.name))continue;
  bankRows.push({item:row.item.name,level:row.item.level??0,
   quantity:row.item.q??1,source:'bank-catalog',
   observedAt:row.evidence?.observedAt??null,
   verified:false});
 }
 const complete=sources.length>0&&sources.every(x=>x.status==='fresh');
 function quantity(name,level=0,variant=null){
  if(!complete||!accountStockValidId(name)||!accountStockInt(level,99))return null;
  let total=0;
  for(const s of sources)for(const row of s.rows){
   const item=row.item;
   if(item.name!==name||item.level!==level||
      variant&&Object.entries(variant).some(([k,v])=>!accountStockFields.includes(k)||
       JSON.stringify(item[k]??null)!==JSON.stringify(v)))continue;
   const free=Math.max(0,row.quantity-row.protectedUnits-row.reservedUnits);
   total+=free;
   if(!accountStockInt(total))return null;
  }
  return total;
 }
 return {version:1,mode:'shadow-only',authority:'none',owner,session,realm,
  at:now,complete,reasons:reasons.slice(0,16),
  sources:sources.map(x=>({owner:x.owner,session:x.session,
   status:x.status,variants:x.rows.length})),bank:bankRows,
  quantity,executable:false};
}
