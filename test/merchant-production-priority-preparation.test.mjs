import test from 'node:test';
import assert from 'node:assert/strict';
import {merchantItemTaskId,prioritizeAdmittedProductionGoal,admittedProductionAction,deferNoOfferMarketPlan,firstEligibleProductionSlot}
 from '../src/merchant/production-priority.mjs';
import {createFairTasks} from '../src/core/fair-tasks.mjs';

const rule={name:'Compound ringsj',action:'compound',recipient:'',priority:55};
const item={name:'ringsj',level:0,q:1,stat_type:''};
const goal=(name,priority)=>({name,item:name,level:0,priority});

test('each inventory slot has independent stable scheduler identity',()=>{
 const first=merchantItemTaskId('production',rule,item,12);
 const second=merchantItemTaskId('production',rule,item,25);
 assert.notEqual(first,second,'matching rings in different slots cannot share cooldown');
 assert.equal(first,merchantItemTaskId('production',rule,{...item,q:9},12),
  'changing stack quantity does not constantly discard the selected job');
 assert.notEqual(first,merchantItemTaskId('inventory',rule,item,12));
 assert.notEqual(first,merchantItemTaskId('production',rule,
  {...item,stat_type:'dex'},12));
 assert.equal(merchantItemTaskId('production',rule,item,-1),null);
 assert.equal(merchantItemTaskId('production',null,item,0),null);
});

test('a deferred blocked stack does not hide an independently executable sibling',()=>{
 let now=1000;
 const scheduler=createFairTasks({now:()=>now,holdMs:30000,starvationMs:120000});
 const blocked=merchantItemTaskId('production',rule,item,0);
 const available=merchantItemTaskId('production',rule,item,1);
 const jobs=[{id:blocked,priority:100},{id:available,priority:90}];
 assert.equal(scheduler.rank(jobs)[0].id,blocked);
 scheduler.defer(blocked,30000);
 assert.equal(scheduler.rank(jobs)[0].id,available);
 scheduler.selected(available);
 now+=5000;
 assert.equal(scheduler.rank(jobs)[0].id,available);
});

test('recent admitted goal remains first only for small priority fluctuations',()=>{
 const a=goal('original',60),b=goal('new',69);
 const ranked=[b,a],rank=args=>prioritizeAdmittedProductionGoal(ranked,{
  keyOf:g=>g.name,scoreOf:g=>g.priority,...args
 });
 assert.deepEqual(rank({admittedKey:'original',admittedAt:1000,now:2000}),[a,b]);
 assert.deepEqual(rank({admittedKey:'original',admittedAt:1000,now:46001}),ranked,
  'after 45 s another ranked goal may take over');
 assert.deepEqual(rank({admittedKey:null,admittedAt:1000,now:2000}),ranked,
  'speculative plans never receive a hold');
 assert.deepEqual(rank({admittedKey:'absent',admittedAt:1000,now:2000}),ranked);
 assert.deepEqual(rank({admittedKey:'original',admittedAt:1000,now:900}),ranked);
});

test('urgent profitable or gear-priority jobs immediately preempt bounded goal hold',()=>{
 const a=goal('original',60),b=goal('critical-gear',95);
 assert.deepEqual(prioritizeAdmittedProductionGoal([b,a],{
  keyOf:g=>g.name,scoreOf:g=>g.priority,
  admittedKey:'original',admittedAt:1000,now:2000}),[b,a]);
 assert.deepEqual(prioritizeAdmittedProductionGoal([b,a],{
  keyOf:g=>g.name,scoreOf:g=>g.priority,
  admittedKey:'original',admittedAt:1000,now:2000,maxPriorityDeficit:5}),[b,a]);
});

test('missing goals, malformed snapshots and empty plan never fabricate work',()=>{
 const a=goal('A',20);
 const cfg={keyOf:g=>g.name,scoreOf:g=>g.priority,
  admittedKey:'A',admittedAt:1000,now:1100};
 assert.deepEqual(prioritizeAdmittedProductionGoal([],{...cfg}),[]);
 assert.deepEqual(prioritizeAdmittedProductionGoal([a],{...cfg}),[a]);
 assert.deepEqual(prioritizeAdmittedProductionGoal([a],{
  ...cfg,scoreOf:()=>NaN}),[a]);
 assert.deepEqual(prioritizeAdmittedProductionGoal([a],{
  ...cfg,admittedAt:NaN}),[a]);
});

test('market travel never locks a speculative production goal; admitted trade may hold',()=>{
 assert.equal(admittedProductionAction({kind:'marketBuy'},true),false);
 assert.equal(admittedProductionAction({kind:'marketBuy'},false,{journal:true}),false);
 assert.equal(admittedProductionAction({kind:'marketBuy'},true,{journal:true}),true);
 assert.equal(admittedProductionAction({kind:'marketBuy'},true,{pending:true}),true);
 assert.equal(admittedProductionAction({kind:'exchange'},true),true);
 assert.equal(admittedProductionAction({kind:'exchange'},false),false);
});

test('market wait yields the active production slot but never suppresses local safe work',()=>{
 const blocked={kind:'marketBuy',item:'ringsj',level:2};
 const market={offerWaitMs:i=>i.name==='ringsj'?95000:0};
 assert.equal(deferNoOfferMarketPlan(blocked,market),95000);
 assert.equal(deferNoOfferMarketPlan({kind:'exchange',item:'seashell'},market),0);
 assert.equal(deferNoOfferMarketPlan({kind:'compound',item:'ringsj'},market),0);
 assert.equal(deferNoOfferMarketPlan(blocked,{offerWaitMs:()=>0}),0);
 assert.equal(deferNoOfferMarketPlan(blocked,{offerWaitMs:()=>NaN}),0);
});
test('plan selects a later safe identical inventory stack, never a locked or kept first copy',()=>{
 const items=[{name:'ringsj',level:0,l:true},{name:'ringsj',level:0,keep:true},
  {name:'ringsj',level:0},{name:'ringsj',level:1}];
 const eligible=i=>!i.l&&!i.keep;
 assert.equal(firstEligibleProductionSlot(items,{name:'ringsj',level:0},eligible),2);
 assert.equal(firstEligibleProductionSlot(items,{name:'ringsj',level:1},eligible),3);
 assert.equal(firstEligibleProductionSlot(items,{name:'seashell',level:0},eligible),-1);
 assert.equal(firstEligibleProductionSlot(items,{name:'ringsj',level:0},()=>false),-1);
});
