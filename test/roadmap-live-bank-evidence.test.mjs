import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectBankEvidence} from '../src/items/bank-evidence.mjs';
import {inventoryStockEvidence,reconcileStockEvidence} from '../src/items/stock-evidence.mjs';

const maps={items0:'bank',items1:'bank',items8:'bank_b',items9:'bank_b'};
const options={owner:'Merchant',session:'m1',realm:'USIV',map:'bank',
 packMap:name=>maps[name],now:10000};
const inspect=(bank,opts={})=>inspectBankEvidence(bank,{...options,...opts});
test('bank current-map view aggregates exact stack variant and protected units',()=>{
 const r=inspect({items0:[{name:'ore',q:4},{name:'ore',q:2,l:true},
  {name:'ore',q:1,stat_type:'str'}],
  items1:[{name:'ore',q:5}],items8:[{name:'ore',q:999}]});
 assert.equal(r.complete,true);
 assert.equal(r.scope,'current-map-only');
 assert.equal(r.packs.length,2);
 assert.equal(r.quantity('ore'),9);
 assert.equal(r.quantity('ore',0,{stat_type:'str'}),1);
 assert.equal(r.quantity('ore',0,{stat_type:'dex'}),0);
 assert.equal(r.authority,'none');
 assert.equal(r.executable,false);
});
test('empty server pack means normalized 42 logical slots, not missing stock',()=>{
 const r=inspect({items0:[]});
 assert.equal(r.complete,true);
 assert.equal(r.packs[0].size,42);
 assert.equal(r.packs[0].used,0);
 assert.equal(r.quantity('scroll0'),0);
});
test('unseen or unknown bank map is unavailable, never empty authoritative inventory',()=>{
 assert.equal(inspect({items8:[{name:'ore'}]}).reason,'no-visible-local-bank-packs');
 assert.equal(inspect({items0:[]},{map:'main'}).complete,false);
 assert.equal(inspect({items0:[]},{packMap:()=>null}).reason,'unverified-bank-pack-map');
 assert.equal(inspect(null).quantity('ore'),null);
});
test('bank journal and unresolved value action block current-map evidence',()=>{
 for(const blocked of [true]){
  const r=inspect({items0:[{name:'ore',q:20}]},{blocked});
  assert.equal(r.complete,false);
  assert.equal(r.reason,'value-action-unresolved');
  assert.equal(r.quantity('ore'),null);
 }
});
test('invalid stack, unsupported variant and malformed bank pack fail closed',()=>{
 assert.equal(inspect({items0:[{name:'ore',q:-10}]}).complete,false);
 assert.equal(inspect({items0:[{name:'ore',data:{secret:'unsupported'}}]}).complete,false);
 assert.equal(inspect({items0:Array(43).fill(null)}).complete,false);
 assert.equal(inspect({items0:Array.from({length:33},(_,n)=>({name:'ore'+n}))}).complete,false);
});
test('bank observations never inflate teammate inventory or shared item commitments',()=>{
 const bank=inspect({items0:[{name:'rare',q:10}]});
 const local=inventoryStockEvidence([],{owner:'Merchant',session:'m1',
  realm:'USIV',at:10000});
 const stock=reconcileStockEvidence({local,owner:'Merchant',session:'m1',
  realm:'USIV',now:10000});
 assert.equal(stock.complete,true);
 assert.equal(stock.quantity('rare'),0);
 assert.equal(bank.quantity('rare'),10);
});
