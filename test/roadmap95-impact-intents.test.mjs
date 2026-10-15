import test from 'node:test';
import assert from 'node:assert/strict';
import {createImpactIntents} from '../src/combat/impact-intents.mjs';
import {fitHeartbeat} from '../src/party/transport.mjs';

test('three real targets become independent in-flight entries, each needs actual server hit evidence',()=>{
 let t=10000;
 const ledger=createImpactIntents({name:'Ranger1',session:'Ranger1-session123',
  realm:'USIV',now:()=>t,ttlMs:2000});
 const id=ledger.launched('3shot',['bee-1','bee-2','bee-3']);
 assert.ok(id.includes('session123'));
 assert.equal(ledger.snapshot().active,1);
 assert.equal(ledger.confirmedHit({actor:'outsider',target:'bee-1',damage:80}),false);
 assert.equal(ledger.confirmedHit({actor:'Ranger1',target:'bee-1',damage:80}),true);
 assert.equal(ledger.confirmedHit({actor:'Ranger1',target:'bee-1',damage:80}),false);
 assert.equal(ledger.snapshot().active,1);
 assert.equal(ledger.confirmedHit({actor:'Ranger1',target:'bee-2'}),true);
 assert.equal(ledger.confirmedHit({actor:'Ranger1',target:'bee-3'}),true);
 assert.equal(ledger.snapshot().active,0);
 assert.equal(ledger.snapshot().confirmed,3);
 assert.equal(ledger.snapshot().mode,'shadow-only');
});

test('failed cast cannot reserve phantom damage and TTL drops unknown projectiles',()=>{
 let t=1000;
 const ledger=createImpactIntents({name:'Ranger1',session:'R1-session1',realm:'USIV',
  now:()=>t,ttlMs:700});
 assert.equal(ledger.launched('3shot',['bee-1','bee-1','bee-2']),null);
 assert.equal(ledger.launched('3shot',[]),null);
 assert.equal(ledger.launched('3shot',[null]),null);
 const id=ledger.launched('3shot',['bee-1','bee-2','bee-3']);
 assert.equal(ledger.settle(id,'returned'),false,'promise resolution is not a confirmed hit');
 assert.equal(ledger.snapshot().active,1);
 t=1701;
 assert.equal(ledger.snapshot().active,0);
 assert.equal(ledger.snapshot().expired,1);
 const canceled=ledger.launched('3shot',['bee-4','bee-5','bee-6']);
 assert.equal(ledger.settle(canceled,'rejected'),true);
 assert.equal(ledger.snapshot().failed,1);
 assert.equal(ledger.confirmedHit({actor:'Ranger1',target:'bee-4'}),false);
});

test('healing intent does not get falsely confirmed by a damage event',()=>{
 let t=1000;
 const ledger=createImpactIntents({name:'Priest',session:'Priest-session',
  realm:'EUI',now:()=>t});
 const id=ledger.launched('heal',['Ranger2'],{kind:'heal'});
 assert.ok(id);
 assert.equal(ledger.confirmedHit({actor:'Priest',target:'Ranger2'}),false);
 assert.equal(ledger.snapshot().active,1);
 assert.equal(ledger.heartbeat()[0].kind,'heal');
 ledger.close();
 assert.equal(ledger.snapshot().active,0);
});

test('bounded ledger never keeps unbounded events or leaks across empty sessions',()=>{
 let t=1;
 const ledger=createImpactIntents({name:'Ranger',session:'R1-seq',realm:'USIV',
  now:()=>t,limit:4,ttlMs:250});
 for(let i=0;i<100;i++)ledger.launched('attack',['bee-'+i]);
 assert.equal(ledger.snapshot().active,4);
 assert.ok(ledger.heartbeat().length<=3);
 t=1000;
 assert.equal(ledger.snapshot().active,0);
 assert.ok(ledger.snapshot().events.length<=8);
 const invalid=createImpactIntents({name:'R',session:'',realm:'USIV'});
 assert.equal(invalid.launched('attack',['bee-1']),null);
});

test('transport sheds optional impact telemetry before essential safety/stock fields',()=>{
 const payload={name:'Ranger',realm:'USIV',running:true,journal:true,
  inventoryBlocked:true,items:[],materials:[],impactIntents:[
   {targets:['bee'],note:'X'.repeat(3500)}
  ],performance:{large:'X'.repeat(300)}};
 const h=fitHeartbeat(payload,350);
 assert.ok(h);
 assert.equal(h.name,'Ranger');
 assert.equal(h.inventoryBlocked,true);
 assert.equal(h.impactIntents,undefined);
 assert.equal(h.journal,true);
});
