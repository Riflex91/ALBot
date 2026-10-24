import test from 'node:test';
import assert from 'node:assert/strict';
import {accountPhysicalLedger,verifiedAccountBankView}
 from '../src/items/account-stock-ledger.mjs';
import {inventoryStockEvidence} from '../src/items/stock-evidence.mjs';
import {inspectBankEvidence} from '../src/items/bank-evidence.mjs';

const at=1000000,owner='Merchant',session='merchant-1',realm='EUI',map='bank';
const local=item=>[item].filter(Boolean);
function liveBank(items={items0:[{name:'ore',q:4}]}){
 return inspectBankEvidence(items,{owner,session,realm,map,packMap:()=>map,now:at});
}
function account({bank=liveBank(),inventory=local({name:'ore',q:2}),
 peers=[],equipment={},overrides={}}={}){
 return accountPhysicalLedger({local:inventory,peers,bank,equipment,
  owner,session,realm,map,now:at,ttlMs:10000,
  reserved:()=>0,expected:peers.map(p=>p.name),...overrides});
}
function peer(items,extras={}){
 const evidence=inventoryStockEvidence(items,{owner:'Ranger',
  session:'ranger-1',realm,at,maxRows:32});
 return {name:'Ranger',session:'ranger-1',realm,received:at,
  running:true,rip:false,inventoryEvidence:evidence,...extras};
}
test('W10 verified physical account view includes local, peer, bank and protected equipment',()=>{
 const view=account({peers:[peer([{name:'ore',q:3}])],
  equipment:{mainhand:{name:'staff',level:2},trade1:{name:'other'}}});
 assert.equal(view.complete,true);
 assert.equal(view.executable,false);
 assert.equal(view.authority,'none');
 assert.equal(view.bankScope,'verified-current-map');
 const ore=view.variants.find(r=>r.item.name==='ore');
 assert.equal(ore?.quantity,9);
 assert.equal(ore?.freeEstimate,9);
 assert.deepEqual(ore.locations.map(r=>r.place),
  ['inventory','inventory','bank-current-map']);
 const gear=view.variants.find(r=>r.item.name==='staff');
 assert.equal(gear?.quantity,1);
 assert.equal(gear?.protectedUnits,1);
 assert.equal(gear?.freeEstimate,0);
 assert.equal(view.variants.some(r=>r.item.name==='other'),false);
});

test('W10 forged bank complete bit is not enough to prove current-map stock',()=>{
 const valid=liveBank();
 assert.equal(valid.complete,true);
 assert.equal(verifiedAccountBankView(valid,{owner,session,realm,map,now:at,ttlMs:10000}),true);
 const changes=[
  b=>{b.session='other';},b=>{b.realm='USV';},
  b=>{b.map='main';},b=>{b.at=at-10001;},
  b=>{b.scope='all-maps';},b=>{b.authority='transfer';},
  b=>{b.executable=true;},b=>{b.packs=[];},
  b=>{b.rows[0].quantity=-1;},b=>{b.rows[0].quantity=Infinity;},
  b=>{b.rows[0].protectedUnits=999;},
  b=>{b.rows.push({...b.rows[0]});},
  b=>{b.packs[0].map='main';},
  b=>{b.packs[0].size=999;}
 ];
 for(const change of changes){
  const b={...valid,rows:structuredClone(valid.rows),packs:structuredClone(valid.packs)};change(b);
  assert.equal(verifiedAccountBankView(b,{owner,session,realm,map,now:at,ttlMs:10000}),false);
  const x=account({bank:b,inventory:[]});
  assert.equal(x.complete,false);
  assert.equal(x.bankScope,'unverified-or-not-visible');
  assert.equal(x.variants.some(r=>r.item.name==='ore'),false);
  assert.ok(x.reasons.includes('bank-current-map-not-verified'));
 }
});

test('W10 cyclic or non-serializable bank variants never enter shadow account quantities',()=>{
 const valid=liveBank(),corrupt={source:'unexpected'};
 corrupt.self=corrupt;
 for(const value of [corrupt,{n:1n}]) {
  const b={...valid,rows:structuredClone(valid.rows),packs:structuredClone(valid.packs)};
  b.rows[0].item.data=value;
  assert.doesNotThrow(()=>account({bank:b,inventory:[]}));
  const v=account({bank:b,inventory:[]});
  assert.equal(v.complete,false);
  assert.equal(v.variants.length,0);
 }
});

test('W10 aggregate stock overflow fails closed without publishing partial free units',()=>{
 const b=liveBank({items0:[{name:'ore',q:1}]});
 const view=account({bank:b,inventory:[{name:'ore',q:10000000}]});
 assert.equal(view.complete,false);
 assert.deepEqual(view.variants,[]);
 assert.ok(view.reasons.includes('account-variant-aggregation-unverified'));
});

test('W10 account view cannot claim complete when 120-row display truncates evidence',()=>{
 const bankPacks={};
 for(let pack=0;pack<4;pack++)
  bankPacks['items'+pack]=Array.from({length:31},(_,i)=>({
   name:'stock'+(pack*31+i),q:1
  }));
 const b=liveBank(bankPacks);
 assert.equal(b.complete,true);
 assert.equal(b.rows.length,124);
 const view=account({bank:b,inventory:[]});
 assert.equal(view.variants.length,120);
 assert.equal(view.complete,false);
 assert.ok(view.reasons.includes('account-variant-output-truncated'));
 assert.equal(view.authority,'none');
});

test('W10 invalid equipped variant is not silently counted as trustworthy stock',()=>{
 const cycled={};cycled.self=cycled;
 const view=account({equipment:{mainhand:{
  name:'staff',level:1,stat_type:cycled
 }}});
 assert.equal(view.complete,false);
 assert.deepEqual(view.variants,[]);
 assert.ok(view.reasons.includes('account-variant-aggregation-unverified'));
});

test('W10 stale or missing peer heartbeat cannot be turned into complete aggregate stock',()=>{
 const stale=peer([{name:'ore',q:3}],{realm:'USV'});
 const view=account({peers:[stale]});
 assert.equal(view.complete,false);
 assert.equal(view.executable,false);
 assert.equal(view.variants.find(x=>x.item.name==='ore')?.quantity,6,
  'only actual local and separately verified bank rows remain visible');
 assert.ok(view.reasons.some(x=>x.startsWith('Ranger:')));
});

test('W02 current-map bank variants reject unsafe acc/rid identifiers',()=>{
 const bank=liveBank();
 assert.equal(verifiedAccountBankView(bank,{
  owner,session,realm,map,now:at,ttlMs:10000}),true);
 for(const field of ['acc','rid'])for(const value of [
  -1,0.5,Infinity,NaN,Number.MAX_SAFE_INTEGER+1,'x'.repeat(81)
 ]){
  const corrupt={...bank,rows:structuredClone(bank.rows),
   packs:structuredClone(bank.packs)};
  corrupt.rows[0].item[field]=value;
  assert.equal(verifiedAccountBankView(corrupt,{
   owner,session,realm,map,now:at,ttlMs:10000}),false,
   field+':'+String(value));
  const result=account({bank:corrupt,inventory:[]});
  assert.equal(result.complete,false);
  assert.equal(result.variants.some(row=>row.item.name==='ore'),false);
 }
});


test('W02 equipped modifiers acc/rid/data preserve exact variant identity and protected stock',()=>{
 const signature={name:'intamulet',level:2,stat_type:'int',acc:'acc-42',
  rid:879,data:'custom-seal'};
 const view=account({
  inventory:[{...signature,q:2}],
  equipment:{amulet:{...signature,p:null}}
 });
 assert.equal(view.complete,true);
 const variants=view.variants.filter(r=>r.item.name==='intamulet');
 assert.equal(variants.length,1,
  'physically held and worn items of the same full variant remain identical');
 assert.equal(variants[0].quantity,3);
 assert.equal(variants[0].protectedUnits,1);
 assert.equal(variants[0].freeEstimate,2);
 assert.equal(variants[0].item.acc,'acc-42');
 assert.equal(variants[0].item.rid,879);
 assert.equal(variants[0].item.data,'custom-seal');
 assert.equal(view.equipped[0].item.rid,879);
 assert.equal(view.executable,false);
});

test('W02 only occupied equipment slots count against bounded shadow ledger budget',()=>{
 const emptySlots=Object.fromEntries(
  Array.from({length:28},(_,i)=>['slot'+i,null]));
 emptySlots.lastAccessory={name:'wingedcape',level:0};
 const view=account({equipment:emptySlots});
 assert.equal(view.complete,true,
  'empty official slots do not consume the occupied-slot proof budget');
 assert.equal(view.equipped.length,1);
 assert.equal(view.equipped[0].slot,'lastAccessory');
 assert.equal(view.variants.find(x=>x.item.name==='wingedcape')?.protectedUnits,1);
});

test('W02 overbudget occupied equipment or invalid late variant makes entire account stock unverified',()=>{
 const many=Object.fromEntries(
  Array.from({length:25},(_,i)=>['slot'+i,{name:'gear'+i,level:0}]));
 for(const equipment of [
  many,
  {mainhand:{name:'sword',level:2},cape:{name:'rare',rid:Infinity}},
  {mainhand:{name:'sword',level:2},earring:{name:'rare',data:{opaque:1}}},
  {mainhand:{name:'sword',level:2},earring:{level:3}},
  ['not-a-slot-map']
 ]){
  const view=account({equipment});
  assert.equal(view.complete,false);
  assert.deepEqual(view.variants,[]);
  assert.deepEqual(view.equipped,[]);
  assert.ok(view.reasons.includes('equipped-variant-evidence-incomplete'));
  assert.ok(view.reasons.includes('account-variant-aggregation-unverified'));
  assert.equal(view.authority,'none');
  assert.equal(view.executable,false);
 }
});

test('W02 distinct equipped acc/rid variants never merge into ordinary carried gear',()=>{
 const view=account({
  inventory:[{name:'ring',level:1,acc:'ordinary',q:1}],
  equipment:{ring1:{name:'ring',level:1,acc:'unique'},
   ring2:{name:'ring',level:1,acc:'ordinary'}}
 });
 assert.equal(view.complete,true);
 const rows=view.variants.filter(x=>x.item.name==='ring');
 assert.equal(rows.length,2);
 const normal=rows.find(x=>x.item.acc==='ordinary');
 assert.equal(normal.quantity,2);
 assert.equal(normal.protectedUnits,1);
 const unique=rows.find(x=>x.item.acc==='unique');
 assert.equal(unique.quantity,1);
 assert.equal(unique.protectedUnits,1);
 assert.equal(unique.freeEstimate,0);
});
