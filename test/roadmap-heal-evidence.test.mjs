import test from 'node:test';
import assert from 'node:assert/strict';
import {createImpactIntents} from '../src/combat/impact-intents.mjs';
import {pendingImpactHeals} from '../src/combat/impact-coordination.mjs';

test('heal intent requires actual positive game heal, not resolved cast or damage',()=>{
 let now=1000;
 const q=createImpactIntents({name:'Priest',session:'p1',realm:'USIV',now:()=>now});
 const key=q.launched('heal',['Ranger'],{kind:'heal'});
 assert.ok(key);
 assert.equal(q.settle(key,'returned'),false);
 assert.equal(q.observe({actor:'Priest',target:'Ranger',damage:50}),false);
 assert.equal(q.observe({actor:'Priest',target:'Ranger',heal:0}),false);
 assert.equal(q.observe({actor:'Other',target:'Ranger',heal:80}),false);
 assert.equal(q.observe({actor:'Priest',target:'Other',heal:80}),false);
 assert.equal(q.observe({actor:'Priest',target:'Ranger',heal:80,realm:'EU1'}),false);
 assert.equal(q.snapshot().active,1);
 assert.equal(q.observe({id:'heal-1',actor:'Priest',target:'Ranger',heal:80}),true);
 assert.equal(q.observe({id:'heal-1',actor:'Priest',target:'Ranger',heal:80}),false);
 assert.equal(q.snapshot().active,0);
 assert.equal(q.snapshot().confirmedHeals,1);
});
test('heal events do not confirm damage intents, damage events require positive payload',()=>{
 const q=createImpactIntents({name:'Ranger',session:'r1',realm:'USIV'});
 const id=q.launched('attack',['bee']);
 assert.ok(id);
 assert.equal(q.observe({actor:'Ranger',target:'bee'}),false);
 assert.equal(q.observe({actor:'Ranger',target:'bee',heal:10}),false);
 assert.equal(q.observe({actor:'Ranger',target:'bee',damage:-2}),false);
 assert.equal(q.snapshot().active,1);
 assert.equal(q.observe({actor:'Ranger',target:'bee',damage:70}),true);
 assert.equal(q.snapshot().confirmed,1);
});
test('server heal observations cannot confirm rejected, expired or another session intent',()=>{
 let now=1000;
 const q=createImpactIntents({name:'Priest',session:'s1',realm:'USIV',now:()=>now,ttlMs:400});
 const a=q.launched('heal',['R'],{kind:'heal'});
 assert.equal(q.settle(a,'rejected'),true);
 assert.equal(q.observe({actor:'Priest',target:'R',heal:99}),false);
 q.launched('heal',['R'],{kind:'heal'});
 now=1401;
 assert.equal(q.observe({actor:'Priest',target:'R',heal:99}),false);
 assert.equal(q.snapshot().expired,1);
 q.close();
 assert.equal(q.snapshot().active,0);
});
test('fresh teammate heal intent is diagnostic only and excludes stale/cross-realm/old session',()=>{
 const now=5000;
 const base={name:'Priest',running:true,rip:false,session:'s1',realm:'USIV',
  received:now-100,
  impactIntents:[{action:'heal',kind:'heal',session:'s1',realm:'USIV',
   at:now-150,expires:now+2000,targets:['Ranger']}]};
 const roster=new Set(['Priest','Ranger']);
 assert.equal(pendingImpactHeals('Ranger',now,[base],roster,'USIV'),1);
 assert.equal(pendingImpactHeals('Ranger',now,[base,{...base}],roster,'USIV'),1);
 for(const invalid of [
  {...base,realm:'EU1'},
  {...base,session:'s2'},
  {...base,received:now-5000},
  {...base,running:false},
  {...base,impactIntents:[{...base.impactIntents[0],expires:now-1}]},
  {...base,impactIntents:[{...base.impactIntents[0],kind:'damage'}]}
 ]) assert.equal(pendingImpactHeals('Ranger',now,[invalid],roster,'USIV'),0);
});
