import test from 'node:test';
import assert from 'node:assert/strict';
import {createProduction,inspectRecipientDeliveryLedger}
 from '../src/production/production.mjs';

const goal={enabled:true,name:'Priest staff',item:'staff',level:3,
 quantity:2,recipient:'Priest',priority:100,variant:null};
const deliveryKey='albot:production:Merchant:deliveries';
const goalKey=JSON.stringify([goal.name,goal.item,goal.level,
 goal.quantity,goal.recipient]);
function fixture(saved=null){
 const store=new Map(),writes=[];
 if(saved!==null)store.set(deliveryKey,structuredClone(saved));
 let durable=true;
 const bot={
  me:{name:'Merchant',role:'merchant'},
  cfg:{general:{testLogging:undefined},
   production:{autonomy:false,enabled:true,goals:[goal]},
   merchant:{enabled:true}},
  p:{G:{items:{staff:{type:'weapon'}}},c:{items:[],slots:{}},
   read:k=>store.get(k)??null,
   write:(k,v)=>{writes.push([k,v]);if(!durable)return false;
    store.set(k,structuredClone(v));return true;},
   realm:()=> 'EUI'},
  economy:{note:()=>{},explicit:()=>null},transport:{fresh:()=>null}
 };
 const production=createProduction(bot);
 const send=(overrides={})=>({kind:'send',id:'sender:1',
  to:'Priest',item:{name:'staff',level:3},quantity:1,...overrides});
 return {bot,production,store,writes,send,
  setDurable:v=>durable=v};
}

test('W13 ordinary delivered gear credit is durable and idempotent across restart',()=>{
 const f=fixture();
 assert.equal(f.production.canRecordDelivery({name:'staff',level:3},'Priest'),true);
 assert.equal(f.production.recordDelivery(f.send()),true);
 assert.equal(f.store.get(deliveryKey)[goalKey]?.quantity,1);
 assert.deepEqual(f.store.get(deliveryKey)[goalKey].last,['sender:1']);
 assert.equal(f.production.recordDelivery(f.send()),true);
 assert.equal(f.store.get(deliveryKey)[goalKey]?.quantity,1);
 const restarted=createProduction(f.bot);
 assert.equal(restarted.status().deliveryLedgerUnsafe,false);
 assert.equal(restarted.recordDelivery(f.send()),true);
 assert.equal(f.store.get(deliveryKey)[goalKey]?.quantity,1);
 assert.equal(restarted.recordDelivery(f.send({id:'sender:2'})),true);
 assert.equal(f.store.get(deliveryKey)[goalKey]?.quantity,2);
});

test('W13 damaged persistent delivery ledger is quarantined, never reset on restart',()=>{
 const valid={quantity:1,last:['sender:old']};
 const damaged=[
  7,'invalid',[],{[goalKey]:{quantity:NaN,last:[]}},
  {[goalKey]:{quantity:1,last:'sender:old'}},
  {[goalKey]:{quantity:-1,last:[]}},
  {[goalKey]:{quantity:1,last:[null]}},
  {[goalKey]:{quantity:1,last:['dup','dup']}},
  {[goalKey]:{quantity:1,last:Array(33).fill('id')}}
 ];
 for(const data of damaged){
  const f=fixture(data),before=structuredClone(f.store.get(deliveryKey));
  assert.equal(f.production.status().deliveryLedgerUnsafe,true);
  assert.equal(f.production.canRecordDelivery({name:'staff',level:3},'Priest'),false);
  assert.equal(f.production.recordDelivery(f.send()),false);
  assert.equal(f.writes.length,0);
  assert.deepEqual(f.store.get(deliveryKey),before,
   'unverified history remains available for recovery/manual review');
 }
 assert.equal(inspectRecipientDeliveryLedger({[goalKey]:valid}).valid,true);
});

test('W13 malformed send receipts cannot credit confirmed recipient stock',()=>{
 const f=fixture();
 for(const bad of [
  {id:''},{id:42},{to:''},{to:null},{item:null},
  {item:{name:''}},{quantity:0},{quantity:-1},
  {quantity:NaN},{quantity:Infinity},{quantity:'1'},
  {quantity:1.5},{quantity:1000001}
 ]){
  assert.equal(f.production.recordDelivery(f.send(bad)),false,
   'invalid value receipt must not change delivered count');
 }
 assert.equal(f.store.has(deliveryKey),false);
 assert.equal(f.writes.length,0);
});

test('W13 failed durable delivery-credit write is never held in memory',()=>{
 const f=fixture();f.setDurable(false);
 assert.equal(f.production.recordDelivery(f.send()),false);
 assert.equal(f.store.has(deliveryKey),false);
 f.setDurable(true);
 assert.equal(f.production.recordDelivery(f.send()),true);
 assert.equal(f.store.get(deliveryKey)[goalKey].quantity,1);
});

test('W13 legacy 32-ID bounded receipts remain readable without migration',()=>{
 const ids=Array.from({length:32},(_,i)=>'session:'+i),
  existing={[goalKey]:{quantity:1,last:ids}};
 const f=fixture(existing);
 assert.equal(f.production.status().deliveryLedgerUnsafe,false);
 assert.equal(f.production.recordDelivery(f.send({id:'sender:new'})),true);
 const row=f.store.get(deliveryKey)[goalKey];
 assert.equal(row.quantity,2);
 assert.equal(row.last.length,32);
 assert.equal(row.last[0],'session:1');
 assert.equal(row.last[31],'sender:new');
 assert.equal(f.production.recordDelivery(f.send({id:'sender:new'})),true);
 assert.equal(f.store.get(deliveryKey)[goalKey].quantity,2);
});

test('W13 impossible root and oversized delivery ledger fail safely',()=>{
 const giant=Object.fromEntries(Array.from({length:1025},(_,i)=>
  ['goal:'+i,{quantity:0,last:[]}]));
 assert.equal(inspectRecipientDeliveryLedger(giant).valid,false);
 const f=fixture(giant);
 assert.equal(f.production.canRecordDelivery({name:'staff',level:3},'Priest'),false);
 assert.equal(f.production.recordDelivery(f.send()),false);
 assert.equal(f.store.get(deliveryKey)['goal:1024'].quantity,0);
});
