import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccount} from '../src/party/account.mjs';
import {estimateRoutes} from '../src/production/costs.mjs';
import {craftGearCandidates} from '../src/production/craft-gear.mjs';
function accountFixture(){
 const data=new Map(),peers={R:{name:'R',class:'ranger',level:61,running:true,hp:4000,max_hp:4500,realm:'EUII',session:'r',threats:0,browserSwitch:{supported:true},stats:{attack:377}},P:{name:'P',class:'priest',level:49,running:true,hp:3300,max_hp:3405,realm:'EUII',session:'p',threats:0,stats:{attack:145}}};
 const bot={me:{name:'M',role:'merchant'},running:true,inventoryBlocked:false,journal:null,leader:'R',farmers:['R','P'],
 cfg:{general:{messageTtlMs:10000},production:{},party:{merchant:'M',leader:'',selection:'adaptive',maxFarmers:2,rotationCooldownMs:1000,balanceFarmers:true,balanceHoldMs:1800000,balanceLevelGap:2},characters:['R','P','Weak'].map(name=>({name,enabled:true,role:'farmer',rotation:true,class:name==='P'?'priest':'ranger'}))},
 p:{headless:false,c:{name:'M'},G:{},realm:()=>'EUII',read:k=>data.get(k),write:(k,v)=>{data.set(k,structuredClone(v));return true;}},
 transport:{fresh:n=>peers[n],ownCharacters:()=>[{name:'Weak',class:'ranger',level:12}],send:()=>true},exec:{pending:new Map()},logistics:{},monsters:()=>[],event:()=>{},report:()=>{}};
 return {bot,data};
}
test('30-minute rotation hold survives repeated reload and exposes eligible candidate before due',()=>{
 const old=Date.now;let now=10000;Date.now=()=>now;
 try{const {bot}=accountFixture();let account=createAccount(bot);now+=1500000;account.tick();
 assert.equal(account.status().choice.phase,'hold-time');assert.equal(account.status().choice.eligibleCatchUp.in,'Weak');assert.equal(account.status().transition,null);
 account=createAccount(bot);now+=299999;account.tick();assert.equal(account.status().transition,null);
 now++;account.tick();assert.equal(account.status().transition.in,'Weak');
 }finally{Date.now=old;}
});
test('future or foreign rotation clocks cannot shorten the hold; failed writes block rotation only',()=>{
 const old=Date.now;let now=10000;Date.now=()=>now;
 try{const {bot,data}=accountFixture();data.set('albot:account:M:training-clock',{version:1,realm:'USI',roster:JSON.stringify(['P','R','Weak']),since:1});
 let account=createAccount(bot);now+=1000;account.tick();assert.equal(account.status().choice.phase,'hold-time');
 bot.p.write=()=>false;account=createAccount(bot);now+=1800000;account.tick();assert.equal(account.status().choice.phase,'clock-storage-unavailable');assert.equal(account.status().transition,null);
 }finally{Date.now=old;}
});
test('recipe discovery rejects malformed, unsupported metadata and explicit disabled crafting',()=>{
 const G={items:{good:{type:'helmet'},mat:{}},craft:{good:{items:[[2,'mat']]},bad:{output:{name:'good',data:{x:1}},items:[[2,'mat']]},overwide:{output:{name:'good'},items:Array(10).fill([1,'mat'])}}};
 const cfg={craft:true,autonomy:true,acquireBy:['craft']};assert.deepEqual(craftGearCandidates(G,cfg),['good']);
 assert.deepEqual(craftGearCandidates(G,{...cfg,craft:false}),[]);
 delete G.items.mat;assert.deepEqual(craftGearCandidates(G,cfg),[]);
});
test('unverified market searches cannot make nested recipe or mutation inputs look available',()=>{
 const G={items:{out:{},mat:{}},craft:{out:{items:[[1,'mat']]}}};
 const base={G,item:'out',allowed:['craft','market'],npcPrice:()=>Infinity,marketPrice:()=>1,marketAvailable:()=>false,farmHours:()=>Infinity};
 const rows=estimateRoutes(base);assert.ok(rows.length);assert.ok(rows.every(r=>r.speculative));
 const verified=estimateRoutes({...base,allowed:['craft','market','farm'],farmHours:(n)=>n==='mat'?.5:Infinity});
 assert.equal(verified[0].kind,'craft');assert.equal(verified[0].speculative,undefined);
});

test('reload restores confirmed roster so startup replacement cannot restart the training clock',()=>{
 const old=Date.now;let now=10000;Date.now=()=>now;
 try{const {bot}=accountFixture();createAccount(bot);now+=1500000;
 bot.farmers=['Weak','P'];bot.leader='P';const account=createAccount(bot);
 assert.deepEqual(bot.farmers,['R','P']);assert.equal(bot.leader,'R');
 now+=300000;account.tick();assert.equal(account.status().transition.in,'Weak');
 }finally{Date.now=old;}
});
test('followers persist a newer coordinator clock across later takeover or reload',()=>{
 const old=Date.now;let now=10000;Date.now=()=>now;
 try{const {bot,data}=accountFixture();bot.me={name:'P',role:'farmer'};bot.cfg.general.autoRoster=false;
 const account=createAccount(bot);now+=1800000;
 account.receive('M',{names:['R','P'],leader:'R',seq:1,rotationSince:now});
 assert.equal(data.get('albot:account:P:training-clock').since,now);
 }finally{Date.now=old;}
});
