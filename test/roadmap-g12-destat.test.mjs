import test from 'node:test';
import assert from 'node:assert/strict';
import {destatCandidate,createStatTailoring} from '../src/production/stat-tailoring.mjs';
import {phaseOf} from '../editor/lib/contract.mjs';

function fixture(){
 const rule={enabled:true,role:'merchant',character:'M',item:'staff',
  minLevel:0,maxLevel:0,statType:'str',action:'destat',
  keep:1,teamReserve:0,maxActions:1,batch:1,
  goldBudget:3000,lossBudget:200};
 const items=[{name:'staff',level:0,stat_type:'str'},
  {name:'staff',level:0,stat_type:'str'},null,null];
 const p={c:{items,isize:4,gold:10000,map:'desertland',q:{},rip:false},
  G:{version:1,maps:{desertland:{ref:{scrollsmith:{x:0,y:0}}}},
   items:{staff:{type:'weapon',wtype:'staff',stat:true,upgrade:true},
    strscroll:{type:'pscroll',stat:'str',grade:1,g:20,s:9999}}},
  has:x=>x==='destat',realm:()=> 'EUI',call(name,...args){
   if(name==='item_grade')return 1;
   if(name==='destat'){
    items[args[0]]={name:'staff',level:0};
    items[2]={name:'strscroll',q:10};
    this.c.gold-=2000;
    return Promise.resolve({num:args[0],scroll:'strscroll',
     quantity:10,cost:2000,success:true});
   }
   throw Error('unexpected call '+name);
  }};
 let operation=null;
 const economy={safe:i=>!!i&&!i.l&&!i.b&&!i.bound&&!i.locked,
  explicit:(i,phase)=>phase==='production'&&i?.name==='staff'?rule:null,
  count:item=>items.filter(i=>i?.name===item.name&&
    (i?.stat_type??'')===(item.stat_type??'')).length,
  value:i=>i.name==='staff'?(i.stat_type?1000:850):20,
  npcTravel:()=>true,npcAt:()=>true,
  perform:(name,opts)=>{operation={name,...opts};return true;}};
 const cfg={production:{enabled:true,gearTargets:[]},items:[rule]};
 const bot={p,cfg,me:{name:'M',role:'merchant'},running:true,
  bank:{pending:false},logistics:{reserved:false},journal:null,
  inventoryBlocked:false,production:{reservedQuantity:()=>0},
  exec:{busy:()=>false},economy};
 const tailoring=createStatTailoring(bot);
 return {bot,p,cfg,rule,items,economy,tailoring,
  get operation(){return operation;}};
}
test('G12 explicit destat permission is production-scoped and never inferred',()=>{
 assert.equal(phaseOf('destat'),'production');
 const f=fixture();
 const plan=destatCandidate(f.bot);
 assert.equal(plan?.needed,10);
 assert.equal(plan?.cost,2000);
 assert.equal(plan?.loss,150);
 assert.equal(plan?.scrollName,'strscroll');
 f.rule.action='sell';
 assert.equal(destatCandidate(f.bot),null);
 f.rule.action='destat';f.rule.character='';
 assert.equal(destatCandidate(f.bot),null);
 f.rule.character='M';f.rule.maxActions=0;
 assert.equal(destatCandidate(f.bot),null);
 f.rule.maxActions=1;f.rule.keep=0;
 assert.equal(destatCandidate(f.bot),null);
});
test('G12 never changes protected, equipped, sealed or sole reserved item',()=>{
 for(const mode of ['locked','sealed','bound','only','reserved','goal']){
  const f=fixture();
  if(mode==='locked')f.items[0].l=true;
  if(mode==='sealed')f.items[0].l='s';
  if(mode==='bound')f.items[0].b=true;
  if(mode==='only')f.items[1]=null;
  if(mode==='reserved')f.bot.production.reservedQuantity=()=>1;
  if(mode==='goal')f.cfg.production.gearTargets=[
   {enabled:true,item:'staff',level:0}];
  assert.equal(destatCandidate(f.bot),null,mode);
 }
});
test('G12 scroll capacity, grade, server capability, gold and loss gates fail closed',()=>{
 const f=fixture();
 f.p.c.gold=1999;assert.equal(destatCandidate(f.bot),null);
 f.p.c.gold=10000;f.rule.goldBudget=1999;
 assert.equal(destatCandidate(f.bot),null);
 f.rule.goldBudget=3000;f.rule.lossBudget=149;
 assert.equal(destatCandidate(f.bot),null);
 f.rule.lossBudget=200;f.p.has=()=>false;
 assert.equal(destatCandidate(f.bot),null);
 f.p.has=()=>true;f.items[2]={name:'filler'};
 f.items[3]={name:'filler2'};
 assert.equal(destatCandidate(f.bot),null);
 f.items[2]=null;f.items[3]=null;
 assert.ok(destatCandidate(f.bot));
});
test('G12 charged value action needs correct server receipt, unstat item, returned scrolls and paid gold',async()=>{
 const f=fixture();
 assert.equal(f.tailoring.destatTick(),true);
 assert.equal(f.operation.name,'destat');
 assert.equal(f.operation.cost,2000);
 assert.equal(f.operation.loss,150);
 assert.equal(f.operation.guard(),true);
 assert.equal(f.operation.observe(),false);
 await f.operation.call();
 assert.equal(f.operation.observe(),true);
 assert.equal(f.p.c.gold,8000);
 assert.equal(f.items[0].stat_type,undefined);
 assert.equal(f.items[2].q,10);
});
test('G12 late stock/rule/capacity drift invalidates queued mutation',()=>{
 for(const kind of ['rule','stock','capacity','budget','goal']){
  const f=fixture();assert.equal(f.tailoring.destatTick(),true);
  if(kind==='rule')f.rule.action='sell';
  if(kind==='stock')f.items[0].stat_type='vit';
  if(kind==='capacity'){f.items[2]={name:'filler'};f.items[3]={name:'other'};}
  if(kind==='budget')f.rule.goldBudget=1000;
  if(kind==='goal')f.cfg.production.gearTargets=[
   {enabled:true,item:'staff',level:0}];
  assert.equal(f.operation.guard(),false,kind);
 }
});
test('G12 additional server response fields cannot replace missing item effects',async()=>{
 const f=fixture(),old=f.p.call.bind(f.p);
 f.p.call=(name,...args)=>name==='destat'?
  Promise.resolve({num:args[0],scroll:'strscroll',quantity:10,cost:2000,success:true}):
  old(name,...args);
 f.tailoring.destatTick();await f.operation.call();
 assert.equal(f.operation.observe(),false);
});

test('G12 malformed same-variant stacks cannot camouflage de-stat reserves',()=>{
 for(const quantity of [0,null,-1,1.5,Infinity,NaN]){
  const f=fixture();
  f.items[1].q=quantity;
  assert.equal(destatCandidate(f.bot),null,
   'invalid sibling quantity must not be accepted: '+String(quantity));
 }
 const f=fixture();
 f.items.push(null);f.p.c.isize=5;
 f.items[2]={name:'staff',level:0,stat_type:'str',q:-1};
 f.items[3]={name:'staff',level:0,stat_type:'str',q:1};
 assert.equal(destatCandidate(f.bot),null,
  'a net-zero invalid pair must not authorize a mutation');
 f.items[2]=null;f.items[3]=null;
 assert.ok(destatCandidate(f.bot),'valid ordinary implicit unit stacks remain usable');
});

test('G12 invalid returned-scroll baseline cannot become a value receipt',()=>{
 const f=fixture();
 f.items[2]={name:'strscroll',level:0,q:null};
 assert.equal(destatCandidate(f.bot),null,
  'explicit null output quantity is not an empty / one-unit baseline');
 f.items[2]=null;
 assert.ok(destatCandidate(f.bot));
 assert.equal(f.tailoring.destatTick(),true);
 f.items[1].q=0;
 assert.equal(f.operation.guard(),false,
  'post-plan corruption of sibling inventory invalidates queued destat');
});


test('G12 invalid loss budget or multi-unit batch never enters a value journal',()=>{
 for(const loss of [null,undefined,NaN,Infinity,-Infinity,-1,'200']){
  const f=fixture();f.rule.lossBudget=loss;
  assert.equal(destatCandidate(f.bot),null,'invalid exposure '+String(loss));
  assert.equal(f.tailoring.destatTick(),false);
  assert.equal(f.operation,null);
 }
 for(const batch of [0,2,5,1.5]){
  const f=fixture();f.rule.batch=batch;
  assert.equal(destatCandidate(f.bot),null,
   'de-statting one exact gear unit needs one-unit authorization');
 }
 assert.ok(destatCandidate(fixture().bot),
  'finite approved rule still admits the original mutation');
});

test('G12 nonstackable synthetic source never funds de-stat reserve',()=>{
 for(const qty of [2,3,0,null,1.5,NaN,Infinity]){
  for(const position of [0,1]){
   const f=fixture();
   f.items[position].q=qty;
   assert.equal(destatCandidate(f.bot),null,
    'invalid physically witnessed staff at '+position+':'+String(qty));
  }
 }
 const f=fixture();
 f.items[0].q=1;f.items[1].q=1;
 assert.ok(destatCandidate(f.bot),
  'two distinct actual single staffs still preserve the reserve');
});

test('G12 malformed returned scroll baseline blocks planning and false settlement',async()=>{
 for(const quantity of [null,-1,0,1.5,NaN,Infinity,10000]){
  const f=fixture();
  f.items[2]={name:'strscroll',q:quantity};
  assert.equal(destatCandidate(f.bot),null,
   'invalid source inventory quantity cannot be a refund baseline');
 }
 const f=fixture();
 assert.equal(f.tailoring.destatTick(),true);
 await f.operation.call();
 assert.equal(f.operation.observe(),true);
 f.items[2].q=11;
 assert.equal(f.operation.observe(),false,
  'unobserved extra refund cannot satisfy the exact returned-scroll contract');
 f.items[2].q=10;
 assert.equal(f.operation.observe(),true);
});

test('W03/G12 de-statting denies unrelated impossible inventory stacks',()=>{
 const f=fixture();
 f.p.G.items.ring={};
 f.p.G.items.hpot0={s:99};
 for(const row of [{name:'ring',q:2},{name:'hpot0',q:100},
  {name:'hpot0',q:null}]){
  f.items[2]=row;
  assert.equal(destatCandidate(f.bot),null,
   'impossible unrelated inventory source: '+JSON.stringify(row));
  assert.equal(f.tailoring.destatTick(),false,
   'malformed inventory cannot open a de-stat value journal');
 }
 f.items[2]={name:'hpot0',q:99};
 assert.equal(destatCandidate(f.bot)?.needed,10,
  'maximum valid physical stack permits the original de-stat plan');
 f.items[2]={name:'ring'};
 assert.equal(destatCandidate(f.bot)?.needed,10,
  'real unstackable singleton remains an admissible unrelated source');
});
