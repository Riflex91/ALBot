import test from 'node:test';
import assert from 'node:assert/strict';
import {inventoryStockEvidence,reconcileStockEvidence} from '../src/items/stock-evidence.mjs';
import {buildObjectiveGraph,createObjectives} from '../src/world/objectives.mjs';

const at=1000000,realm='USIV',owner='Merchant',session='merchant-v2';
const proof=(name='R1',sess='peer-v1',items=[],opts={})=>
 inventoryStockEvidence(items,{owner:name,session:sess,realm,at,...opts});
const local=items=>proof(owner,session,items);
const peer=(evidence,extras={})=>({
 name:evidence.owner,session:evidence.session,realm,received:at,
 running:true,rip:false,inventoryBlocked:false,journal:false,reserved:false,
 inventoryEvidence:evidence,...extras
});
const ledger=(l,peers=[],expected=peers.map(x=>x.name),bank=[])=>
 reconcileStockEvidence({owner,session,realm,now:at,ttlMs:10000,
 local:l,peers,expected,bank});

test('exact full inventory evidence aggregates stacks and guards protected/reserved items',()=>{
 const rows=[{name:'ore',q:3},{name:'ore',q:2},{name:'ore',q:5,l:true},
  {name:'ore',q:7,stat_type:'str'}];
 const x=local(rows);
 assert.equal(x.complete,true);
 assert.equal(x.slotCount,4);
 assert.equal(x.rows.length,2);
 const a=ledger(x);
 assert.equal(a.complete,true);
 assert.equal(a.quantity('ore',0),12);
 assert.equal(a.quantity('ore',0,{stat_type:'str'}),7);
 const protectedAndReserved=local([{name:'ore',q:5},{name:'ore',q:2,l:true}]);
 const result=ledger(protectedAndReserved);
 assert.equal(result.quantity('ore'),5);
 const held=proof(owner,session,[{name:'ore',q:5}],{reserved:()=>4});
 assert.equal(ledger(held).quantity('ore'),1);
});


test('ordinary live item p:null no longer invalidates all Merchant inventory evidence',()=>{
 const a=local([{name:'hpamulet',level:1,p:null},{name:'anniversarygift',q:1088}]);
 assert.equal(a.complete,true,'game-null modifier means absent property');
 const result=ledger(a);
 assert.equal(result.complete,true);
 assert.equal(result.quantity('anniversarygift',0),1088);
 assert.equal(result.quantity('hpamulet',1),1);
 const opaque=local([{name:'hpamulet',level:1,p:{unknown:true}}]);
 assert.equal(opaque.complete,false,'non-null unknown property must not be approved');
 const shadow=proof(owner,session,[{name:'hpamulet',level:1,p:{unknown:true}}],
  {allowOpaque:true});
 assert.equal(shadow.complete,true);
 assert.equal(shadow.rows[0].protectedUnits,1);
});

test('fresh peer stock only counts with matching realm/session and complete message',()=>{
 const e=proof('R1','session-1',[{name:'ore',q:8,level:1}]);
 const good=ledger(local([{name:'ore',q:2,level:1}]),[peer(e)],['R1']);
 assert.equal(good.quantity('ore',1),10);
 assert.equal(good.sources.length,2);
 for(const mismatch of [{session:'session-2'},{realm:'EU1'},{received:at-30000},
   {running:false},{inventoryBlocked:true},{journal:true},{reserved:true}]){
  const result=ledger(local([]),[peer(e,mismatch)],['R1']);
  assert.equal(result.complete,false,JSON.stringify(mismatch));
  assert.equal(result.quantity('ore',1),null);
 }
});

test('missing expected teammate fails closed rather than claiming zero inventory',()=>{
 const x=ledger(local([{name:'ore',q:2}]),[],['R1']);
 assert.equal(x.complete,false);
 assert.equal(x.quantity('ore'),null);
 assert.ok(x.reasons.some(r=>r.startsWith('R1:')));
});

test('truncated heartbeat stock and unknown variants cannot be silently partial counted',()=>{
 const items=Array.from({length:15},(_,i)=>({name:'item'+i,q:1}));
 const evidence=proof('R1','v1',items);
 assert.equal(evidence.complete,false);
 assert.equal(evidence.rows.length,0);
 const result=ledger(local([]),[peer(evidence)],['R1']);
 assert.equal(result.complete,false);
 assert.equal(result.quantity('item0'),null);
 const opaque=proof('R1','v1',[{name:'gem',q:1,data:{unknown:true}}],{allowOpaque:true});
 assert.equal(opaque.complete,true,'bounded opaque variant is visible for diagnostics');
 assert.equal(opaque.rows[0].protectedUnits,1,'unmodeled data is never counted as available');
 assert.equal(proof('R1','v1',[{name:'gem',q:1,data:{x:'x'.repeat(200)}}]).complete,false);
 assert.equal(proof('R1','v1',[{name:'gem',q:-2}]).complete,false);
});

test('exact variant mismatch does not spend another character equipment',()=>{
 const x=ledger(local([]),[peer(proof('R1','s',[{name:'bow',level:7,
  stat_type:'str',q:1}]))],['R1']);
 assert.equal(x.quantity('bow',7,{stat_type:'str'}),1);
 assert.equal(x.quantity('bow',7,{stat_type:'dex'}),0);
 assert.equal(x.quantity('bow',6),0);
});

test('bank catalog is advisory and cannot inflate physical stock or prove transfer',()=>{
 const b=[{item:{name:'rare',q:9,level:5},
  evidence:{observedAt:at-60000,revision:8,verified:false}}];
 const x=ledger(local([]),[],[],b);
 assert.equal(x.complete,true);
 assert.equal(x.quantity('rare',5),0);
 assert.equal(x.bank[0].verified,false);
 assert.equal(x.bank[0].quantity,9);
 assert.equal(x.executable,false);
});

test('objective graph uses vetted aggregate quantity and blocks on missing peer data',()=>{
 const game={items:{ore:{},bar:{}},craft:{bar:{items:[[2,'ore']]}}};
 const goals=[{name:'Craft bar',enabled:true,item:'bar',quantity:1,level:0}];
 const clean=ledger(local([]),[peer(proof('R1','s1',[{name:'ore',q:2}]))],['R1']);
 const ok=buildObjectiveGraph({G:game,goals,stock:clean.quantity,owner,session,realm,now:at});
 assert.equal(ok.nodes.find(x=>x.item==='ore').state,'fulfilled');
 const missing=ledger(local([]),[],['R1']);
 const fail=buildObjectiveGraph({G:game,goals,stock:missing.quantity,owner,session,realm,now:at});
 assert.equal(fail.blocked,true);
 assert.equal(fail.nodes.find(x=>x.item==='bar').blocker,'stock-unverified');
});

test('objectives integration accepts only fresh peer evidence, never authorizes execution',()=>{
 const memory=new Map(),G={items:{ore:{},bar:{}},craft:{bar:{items:[[2,'ore']]}}};
 const p={c:{items:[]},G,realm:()=>realm,
  write:(k,v)=>{memory.set(k,v);return true}};
 const bot={me:{name:owner,role:'merchant'},session,cfg:{
   production:{enabled:true},general:{messageTtlMs:10000}},
  farmers:['R1'],p,bank:{catalogStock:()=>[]},
  production:{activeGoal:{name:'Craft bar',enabled:true,item:'bar',level:0,quantity:1}},
  transport:{fresh:()=>{const observedAt=Date.now()-250;
   return peer(inventoryStockEvidence([{name:'ore',q:2}],{
    owner:'R1',session:'fresh',realm,at:observedAt}),{received:observedAt});}}};
 const view=createObjectives(bot);view.tick();
 assert.equal(view.status().inventoryEvidence.complete,true);
 assert.equal(view.status().nodes.find(x=>x.item==='ore').state,'fulfilled');
 assert.equal(view.status().executable,false);
 bot.transport.fresh=()=>null;
 view.tick();
 assert.equal(view.status().inventoryEvidence.complete,false);
 assert.equal(view.status().nodes.find(x=>x.item==='bar').state,'blocked');
});

test('Merchant objective ledger represents 27 distinct local item variants within bounded 32-row budget',()=>{
 const rows=Array.from({length:27},(_,n)=>({name:'inventory'+n,q:1}));
 rows[9]={name:'anniversarygift',q:1046};
 const localStock=inventoryStockEvidence(rows,{
  owner,session,realm,at,maxRows:32,reserved:()=>0
 });
 assert.equal(localStock.complete,true);
 assert.equal(localStock.rows.length,27);
 const result=ledger(localStock);
 assert.equal(result.complete,true);
 assert.equal(result.quantity('anniversarygift'),1046);
 assert.equal(inventoryStockEvidence(rows,{owner,session,realm,at,maxRows:12}).complete,
  false,'default small remote heartbeat budget remains bounded');
});
