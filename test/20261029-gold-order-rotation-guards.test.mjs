import test from 'node:test';
import assert from 'node:assert/strict';
import {createGoldLogistics} from '../src/items/gold.mjs';
import {selectedFarmerAvailable,inspectHeadlessRotationPreflight}
 from '../src/party/account.mjs';
import {fitHeartbeat} from '../src/party/transport.mjs';

test('unknown send_gold RPC completion retains the journal until an actual receipt',()=>{
 const sent=[],events=[],storage=new Map(),calls=[];
 const c={name:'F',gold:32328,map:'main',in:'main',x:0,y:0,rip:false,items:[]};
 const bot={
  p:{c,realm:()=> 'USIV',read:k=>storage.get(k)??null,
   write:(k,v)=>{storage.set(k,v);return true;},
   call:(name,peer,quantity)=>{
    assert.equal(name,'send_gold');calls.push([peer,quantity]);
    c.gold-=quantity;return undefined;
   }},
  cfg:{party:{merchant:'M'},merchant:{collectGold:true,enabled:true,
    goldReserve:10000,goldCollectBelow:1},general:{messageTtlMs:10000}},
  me:{name:'F',role:'farmer',goldReserve:10000},
  session:'farmer-session',running:true,checkpoint:{durable:true},
  inventoryBlocked:false,journal:null,logistics:{reserved:false},
  bank:{pending:false},movement:{townActive:false},services:{active:false},
  entity:name=>name==='M'?{name,map:'main',in:'main',x:10,y:0}:null,
  exec:{pending:new Map(),busy:()=>false,run:(key,resources,guard,fn,options)=>{
   if(!guard())return false;
   fn();
   options.onSettle?.('unknown');
   return true;
  }},
  transport:{fresh:name=>name==='M'?{name:'M',running:true,rip:false,
    realm:'USIV',map:'main',in:'main',x:10,y:0,session:'merchant-live',
    inventoryBlocked:false,reserved:false,goldTransferPending:false}:null,
   send:(peer,type,data,id)=>{sent.push({peer,type,data,id});return true;}},
  event:(type,data)=>events.push({type,...data}),
  report:()=>{},beginValue(j){assert.equal(this.journal,null);this.journal={...j};},
  endValue(result){assert.equal(result,'confirmed');this.journal=null;}
 };
 const gold=createGoldLogistics(bot);
 gold.poll(true);
 const offer=sent.find(m=>m.type==='goldOffer');
 assert.ok(offer);
 assert.equal(offer.data.quantity,22328);
 gold.receive('M',{type:'goldAccept',id:offer.id,session:'merchant-live',
  data:{quantity:offer.data.quantity}});
 gold.poll(false);
 assert.equal(c.gold,10000);
 assert.equal(calls.length,1);
 assert.equal(bot.journal?.kind,'gold.send');
 assert.equal(gold.status()?.state,'sent');
 assert.ok(events.some(e=>e.type==='gold.dispatchAwaitingReceipt'));
 gold.receive('M',{type:'goldReceipt',id:offer.id,session:'merchant-live',
  data:{quantity:offer.data.quantity}});
 gold.poll(false);
 assert.equal(bot.journal,null);
 assert.equal(gold.status(),null);
 assert.equal(calls.length,1,'unknown game RPC must never replay send_gold');
 assert.ok(sent.some(m=>m.type==='goldDone'&&m.id===offer.id));
});

test('value journal blocks rotation but not active team combat availability',()=>{
 const member={running:true,rip:false,inventoryBlocked:true,realm:'USIV'};
 assert.equal(selectedFarmerAvailable(member,{realm:'USIV'}),true);
 assert.equal(selectedFarmerAvailable({...member,running:false},{realm:'USIV'}),false);
 assert.equal(selectedFarmerAvailable({...member,realm:'EUII'},{realm:'USIV'}),false);
});

test('headless rotation cannot stop an unproven outgoing Farmer',()=>{
 assert.equal(inspectHeadlessRotationPreflight(null,'F','W').allowed,false);
 assert.equal(inspectHeadlessRotationPreflight([],'F','W').allowed,false);
 assert.equal(inspectHeadlessRotationPreflight({},'F','W').allowed,false);
 assert.equal(inspectHeadlessRotationPreflight({F:true,W:true},'F','W').allowed,false);
 assert.equal(inspectHeadlessRotationPreflight({F:{name:'F'}},'F','W').allowed,true);
});

test('an oversized heartbeat never erases a live Merchant material order',()=>{
 const order={objective:'seashell-refill:M:8',item:'seashell',
  monster:'squigtoad',quantity:400,remaining:400,
  quotaSessions:true,quotas:[{name:'F',session:'farmer-session',quantity:400}]};
 const compact=fitHeartbeat({name:'M',materials:[order],items:[],
  team:{names:['F'],leader:'F',seq:1},stock:'x'.repeat(4500)},800);
 assert.ok(compact);
 assert.deepEqual(compact.materials,[order]);
 const impossible=fitHeartbeat({materials:[order],items:[],team:'x'.repeat(1500)},100);
 assert.equal(impossible,null,'fail closed, do not silently hide the order');
});
