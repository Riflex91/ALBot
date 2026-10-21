import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {latestBankPackViews} from '../worker/bank-view.mjs';

const observation=(pack,realm,observedAt,marker)=>({
 pack,realm,map:'bank',observedAt,
 slots:Array.from({length:42},(_,i)=>i===0?{name:marker,q:1,level:0}:null)
});

test('global bank view selects one latest snapshot per pack across realms',()=>{
 const us=observation('items0','USIV',1792524687963,'stale');
 const eu=observation('items0','EUII',1792595554276,'new');
 const result=latestBankPackViews([us,eu]);
 assert.equal(result.length,1);
 assert.equal(result[0],eu,'preserves latest complete snapshot and source realm');
 assert.equal(result[0].realm,'EUII');
 assert.equal(result[0].slots[0].name,'new');
 assert.equal(us.slots[0].name,'stale','original D1 row remains untouched');
});

test('separate observed packs remain separate, unknown packs are never invented',()=>{
 const older=observation('items0','USIV',10,'older');
 const newer=observation('items0','EUII',20,'newer');
 const pack1=observation('items1','USIV',15,'pack1');
 const result=latestBankPackViews([older,pack1,newer]);
 assert.deepEqual(result.map(x=>[x.pack,x.realm,x.observedAt]),
  [['items0','EUII',20],['items1','USIV',15]]);
 assert.equal(result[0].slots[0].name,'newer');
 assert.equal(result[1].slots[0].name,'pack1');
 assert.deepEqual(latestBankPackViews([]),[]);
 assert.deepEqual(latestBankPackViews([older,newer]).map(x=>x.pack),['items0']);
});

test('tie is stable and malformed observations do not create bank packs',()=>{
 const first=observation('items0','USIV',42,'first');
 const second=observation('items0','EUII',42,'second');
 assert.equal(latestBankPackViews([first,second])[0],first);
 assert.deepEqual(latestBankPackViews([null,{},observation('bad-pack','EUII',99,'bad'),
  {...first,observedAt:NaN}]),[]);
});

test('worker serves deduplication only for bank snapshots without extra D1 work',async()=>{
 const worker=await readFile(new URL('../worker/index.mjs',import.meta.url),'utf8');
 assert.match(worker,/rows:table==='bank_snapshots'\?latestBankPackViews\(rows\):rows/);
 assert.match(worker,/SELECT updated_at,payload FROM /);
 assert.match(worker,/ORDER BY updated_at DESC LIMIT /);
 assert.doesNotMatch(worker,/DELETE FROM bank_snapshots/);
});
