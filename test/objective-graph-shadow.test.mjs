import test from 'node:test';
import assert from 'node:assert/strict';
import {buildObjectiveGraph,createObjectives} from '../src/world/objectives.mjs';

const G={items:{helm:{},ore:{},gem:{},up:{upgrade:true}},
 craft:{helm:{items:[[2,'ore',0],[1,'gem',0]],q:1}}};
const base={G,owner:'Merchant',session:'M-01',realm:'USIV',now:100000,ttlMs:120000};
const goal=(name='Craft helm',quantity=1,variant=null)=>({name,item:'helm',
 level:0,quantity,variant,enabled:true,recipient:'R1'});

test('material recipe candidate uses current physical stock and exposes prerequisites without action authority',()=>{
 const have={ore:2,gem:1,helm:0};
 const graph=buildObjectiveGraph({...base,goals:[goal()],stock:name=>have[name]});
 assert.equal(graph.blocked,false);
 assert.equal(graph.mode,'shadow-only');
 assert.equal(graph.authority,'none');
 assert.equal(graph.roots[0].state,'candidate');
 assert.equal(graph.nodes.find(x=>x.item==='ore').state,'fulfilled');
 assert.equal(graph.nodes.find(x=>x.item==='gem').state,'fulfilled');
 assert.equal(graph.nodes.find(x=>x.item==='helm').state,'candidate');
 assert.equal(graph.expires,220000);
 const complete=buildObjectiveGraph({...base,goals:[goal()],stock:name=>name==='helm'?1:0});
 assert.equal(complete.roots[0].state,'fulfilled');
});

test('missing source is explicitly blocked instead of creating a speculative buy/farm task',()=>{
 const graph=buildObjectiveGraph({...base,goals:[goal()],
  stock:name=>name==='gem'?1:0});
 assert.equal(graph.blocked,true);
 assert.equal(graph.roots[0].state,'blocked');
 assert.equal(graph.nodes.find(x=>x.item==='ore').blocker,'source-not-verified');
 assert.equal(graph.nodes.some(x=>x.state==='active'),false);
});

test('two goals share one physical inventory count without double allocation',()=>{
 const graph=buildObjectiveGraph({...base,
  goals:[goal('For R1',1),goal('For R2',1)],
  stock:name=>({helm:1,ore:2,gem:1}[name]??0)});
 const helm=graph.nodes.find(x=>x.item==='helm');
 assert.equal(helm.required,2);
 assert.equal(helm.observed,1);
 assert.equal(graph.nodes.find(x=>x.item==='ore').required,2);
 assert.equal(graph.nodes.find(x=>x.item==='gem').required,1);
});

test('distinct variants and upgrade levels never share the same stock node',()=>{
 const graph=buildObjectiveGraph({...base,
  goals:[{...goal('A'),variant:{stat_type:'str'}},
   {...goal('B'),variant:{stat_type:'dex'}}],
  stock:(name,level,v)=>name==='helm'&&v?.stat_type==='str'?1:0});
 const helms=graph.nodes.filter(x=>x.item==='helm');
 assert.equal(helms.length,2);
 assert.ok(helms.some(x=>x.state==='fulfilled'));
 assert.ok(helms.some(x=>x.required===1&&x.observed===0));
 const high=buildObjectiveGraph({...base,goals:[{name:'Upgrade',
  item:'up',level:2,quantity:1,enabled:true}],stock:()=>0});
 assert.equal(high.nodes.find(x=>x.level===1).required,1);
 assert.equal(high.nodes.find(x=>x.level===0).required,1);
});

test('cycles, unknown items, invalid stock and excessive input are bounded failures',()=>{
 const cyclic={items:{a:{},b:{}},craft:{a:{items:[[1,'b']]},b:{items:[[1,'a']]}}};
 assert.equal(buildObjectiveGraph({...base,G:cyclic,goals:[{name:'Cycle',item:'a',
  level:0,quantity:1,enabled:true}],stock:()=>0}).reason,'cyclic-objective');
 assert.equal(buildObjectiveGraph({...base,goals:[{...goal(),item:'missing'}],
  stock:()=>0}).blocked,true);
 assert.equal(buildObjectiveGraph({...base,goals:[goal()],
  stock:()=>NaN}).nodes[0].blocker,'stock-unverified');
 assert.equal(buildObjectiveGraph({...base,goals:Array(17).fill(goal())}).reason,'invalid-context');
});

test('only merchant samples existing production goal; evidence journal cannot perform value actions',()=>{
 const memory=new Map(),writes=[];
 const bot={me:{name:'M',role:'merchant'},session:'M-01',
  cfg:{production:{enabled:true}},p:{
   realm:()=> 'USIV',G,read:k=>memory.get(k),
   write:(k,v)=>{writes.push(v);memory.set(k,v);return true;},
   c:{items:[{name:'ore',q:2},{name:'gem',q:1}]}},
  production:{activeGoal:goal()}};
 const planner=createObjectives(bot);planner.tick();
 const status=planner.status();
 assert.equal(status.executable,false);
 assert.equal(status.roots.length,1);
 assert.equal(writes.length,1);
 assert.equal(writes[0].authority,'none');
 planner.tick();assert.equal(writes.length,1,'unchanged objective never repeats journal writes');
 bot.p.c.items.push({name:'helm',q:1});
 planner.tick();assert.equal(planner.status().roots[0].state,'fulfilled');
 assert.equal(writes.length,2);
 const follower=createObjectives({...bot,me:{name:'Ranger',role:'farmer'}});
 follower.tick();assert.equal(follower.status().roots.length,0);
});
