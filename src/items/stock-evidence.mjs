import {protectedItem} from '../core/policy.mjs';

// Read-only, bounded evidence. A heartbeat is peer-attested, NOT a transfer
// receipt or permission to spend, sell, send, retrieve, or equip any item.
const accountStockFields=['stat_type','p','title','acc','rid','data'];
const accountStockKey=i=>JSON.stringify([i.name,i.level??0,...accountStockFields.map(k=>i[k]??null)]);
const accountStockValidId=x=>typeof x==='string'&&x.length>0&&x.length<=100;
const accountStockInt=(x,max=1e7)=>Number.isSafeInteger(x)&&x>=0&&x<=max;
export function inventoryStockEvidence(items,{
 owner,session,realm,at=Date.now(),maxRows=12,allowOpaque=false,reserved=()=>0
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
     !accountStockInt(entry.q??1)||!(entry.q??1))
   return bad('unknown-inventory-variant');
  const signature={name:entry.name,level:entry.level??0};
  let opaque=false;
  for(const k of accountStockFields)if(entry[k]!==undefined){
   const v=entry[k];
   // The game serializes absent property modifiers as null on ordinary gear.
   // Null means no variant, not an opaque unspendable property. Structured
   // non-null properties still require explicit opaque shadow treatment.
   if(v===null)continue;
   if(['acc','rid'].includes(k)&&['string','number'].includes(typeof v)){
    signature[k]=v;continue;
   }
   if(typeof v==='string'&&v.length<=(k==='data'?120:80)){
    signature[k]=v;continue;
   }
   // Data payloads and property variants can be structured by the game.
   // Represent them as distinct opaque SHADOW variants, never spendable units.
   // Unknown/unbounded payloads fail the whole inventory proof closed.
   let encoded;try{encoded=JSON.stringify(v);}catch{}
   const max=k==='data'?120:80;
   if(!allowOpaque)return bad('unknown-inventory-variant:'+entry.name+':'+k);
   if(typeof encoded!=='string'||encoded.length+5>max)
    return bad('unknown-inventory-variant:'+entry.name+':'+k);
   signature[k]='json:'+encoded;opaque=true;
  }
  // A stock proof never represents an unmodelled modifier as freely movable.
  if(Object.keys(entry).some(k=>!['name','level','q','stat_type','p','title',
      'acc','rid','data','l','b','bound','locked','equipped','reserved','giveaway'].includes(k)))
   opaque=true;
  if(opaque&&!allowOpaque)return bad('unknown-inventory-variant:'+entry.name);
  const key=accountStockKey(signature),quantity=entry.q??1;
  let row=rows.get(key);
  if(!row){
   if(rows.size>=maxRows)return bad('inventory-exceeds-heartbeat-budget');
   row={item:signature,quantity:0,protectedUnits:0,reservedUnits:0};
   rows.set(key,row);
  }
  if(!accountStockInt(row.quantity+quantity))return bad('inventory-count-overflow');
  row.quantity+=quantity;
  if(protectedItem(entry)||opaque)row.protectedUnits+=quantity;
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
    now-r.at>ttlMs||!Array.isArray(r.rows)||r.rows.length>32||
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

 // A status heartbeat has a strict byte budget. Encode physical evidence as
 // bounded tuples; never truncate an inventory and call it complete.
export function packInventoryEvidence(e){
 if(!e||e.version!==1||!Array.isArray(e.rows)||e.rows.length>32)
  return null;
 return {v:1,o:e.owner,s:e.session,r:e.realm,t:e.at,
  c:e.complete===true?1:0,n:e.slotCount,
  ...(e.complete===true?{}:{e:String(e.reason??'unverified').slice(0,90)}),
  x:e.rows.map(row=>[row.item.name,row.item.level??0,
   ...accountStockFields.map(k=>row.item[k]??null),
   row.quantity,row.protectedUnits,row.reservedUnits])};
}
export function unpackInventoryEvidence(w){
 if(!w||w.v!==1||!accountStockValidId(w.o)||
   !accountStockValidId(w.s)||!accountStockValidId(w.r)||
   !accountStockInt(w.t,Number.MAX_SAFE_INTEGER)||
   !accountStockInt(w.n,50)||![0,1].includes(w.c)||
   !Array.isArray(w.x)||w.x.length>32)return null;
 const rows=[];
 for(const values of w.x){
  if(!Array.isArray(values)||values.length!==11)return null;
  const [name,level,...rest]=values;
  const fields=rest.slice(0,6),[quantity,protectedUnits,reservedUnits]=rest.slice(6);
  if(!accountStockValidId(name)||!accountStockInt(level,99)||
    !accountStockInt(quantity)||quantity<1||
    !accountStockInt(protectedUnits)||!accountStockInt(reservedUnits)||
    protectedUnits>quantity||reservedUnits>quantity)return null;
  const item={name,level};
  for(let i=0;i<fields.length;i++)if(fields[i]!==null){
   const key=accountStockFields[i],val=fields[i];
   if(['acc','rid'].includes(key)){
    if(!['number','string'].includes(typeof val))return null;
   }else if(typeof val!=='string'||val.length>(key==='data'?120:80))
    return null;
   item[key]=val;
  }
  rows.push({item,quantity,protectedUnits,reservedUnits});
 }
 return {version:1,owner:w.o,session:w.s,realm:w.r,at:w.t,
  complete:w.c===1,reason:w.c===1?null:String(w.e??'unverified').slice(0,90),
  slotCount:w.n,rows};
}
