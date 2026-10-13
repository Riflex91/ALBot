import test from 'node:test';
import assert from 'node:assert/strict';
import {ownSupplyCharacters,onlineSupplyFarmers,potionTarget,automaticSupplyReceiver} from '../src/items/potion-supply.mjs';
import {createTransport} from '../src/party/transport.mjs';
import {defaultsFor,applyAutonomousMode} from '../editor/lib/contract.mjs';
import {FULL_DESCRIPTOR} from '../src/config/full.mjs';

test('separate potion targets preserve the per-kind hard cap and permit opting out',()=>{
 const cfg=defaultsFor(FULL_DESCRIPTOR.schema);
 assert.equal(potionTarget(cfg,'hpot0'),3000);assert.equal(potionTarget(cfg,'mpot0'),300);
 cfg.farming.potionCarryMax=100;assert.equal(potionTarget(cfg,'hpot0'),100);
 cfg.merchant.mpPotionTarget=0;assert.equal(potionTarget(cfg,'mpot0'),0);
});
test('account discovery copies only identity, and online supply excludes stale, dead and foreign-realm farmers',()=>{
 const cfg={merchant:{discoverOwnFarmers:true},characters:[]};
 const rows=[{name:'Live',type:'ranger',secret:'never-copy'},{name:'Offline',type:'priest'},{name:'OtherRealm',type:'warrior'},{name:'Dead',type:'ranger'},{name:'M',type:'merchant'}];
 const p={has:()=>true,call:()=>rows,realm:()=> 'EU1'};
 const own=ownSupplyCharacters(p);assert.equal(JSON.stringify(own).includes('never-copy'),false);
 const bot={p,cfg,me:{name:'M'},farmers:[],transport:{ownCharacters:()=>own,fresh:n=>n==='Offline'?null:{running:true,rip:n==='Dead',realm:n==='OtherRealm'?'US1':'EU1',class:'ranger'}}};
 assert.deepEqual(onlineSupplyFarmers(bot).map(x=>x.name),['Live']);
 cfg.merchant.discoverOwnFarmers=false;assert.deepEqual(onlineSupplyFarmers(bot),[]);
 p.call=()=>{throw Error('offline');};assert.deepEqual(ownSupplyCharacters(p),[]);
});
test('unconfigured own farmer can become a receiver, explicit disabled entries and foreign names cannot',()=>{
 const cfg={merchant:{discoverOwnFarmers:true},party:{merchant:'M',group:'g'},characters:[{name:'M'}]};
 const p={c:{name:'F',ctype:'ranger'},realm:()=> 'USIV',has:()=>true,call:()=>[{name:'M',type:'merchant'},{name:'F',type:'ranger'}]};
 const receiver=automaticSupplyReceiver(cfg,p);assert.equal(receiver.role,'farmer');assert.equal(receiver.region+receiver.server,'USIV');assert.equal(receiver.rotation,false);
 cfg.characters.push({name:'F',enabled:false});assert.equal(automaticSupplyReceiver(cfg,p),null);
 cfg.characters.pop();p.c.name='Stranger';assert.equal(automaticSupplyReceiver(cfg,p),null);
});
test('transport discovers only account-owned names and restricts their messages to potion handoffs',()=>{
 let cm;const received=[];
 const cfg={merchant:{discoverOwnFarmers:true},general:{transport:'cm',messageTtlMs:10000},characters:[{name:'M',enabled:true,group:'g'}]};
 const bot={cfg,me:{name:'M',group:'g'},running:true,session:'m',p:{ipc:false,headless:false,parent:{},has:()=>true,call:()=>[{name:'M',type:'merchant'},{name:'F',type:'ranger'}],hook:(_,fn)=>{cm=fn;return ()=>{};}},report(){},logistics:{receive:(_,m)=>received.push(m.type)},gold:{receive:()=>assert.fail('discovered farmer cannot control gold transport')}};
 const t=createTransport(bot),msg=(from,type,seq,data={})=>({protocol:'albot/1',from,to:'M',group:'g',session:'s',seq,time:Date.now(),ttl:10000,type,id:'x'+seq,data});
 cm('Stranger',msg('Stranger','offer',1,{item:{name:'mpot0'}}));assert.equal(received.length,0);
 cm('F',msg('F','goldOffer',2));cm('F',msg('F','offer',3,{item:{name:'sword'}}));assert.equal(received.length,0);
 cm('F',msg('F','offer',4,{item:{name:'mpot0'}}));assert.deepEqual(received,['offer']);
 cm('F',msg('F','status',5,{name:'Stranger',map:'main',x:0,y:0,realm:'EU1',items:[]}));assert.equal(t.fresh('F').name,'F');
 t.close();
});
test('autonomous mode enables capabilities without changing budgets, item rules or pinned members',()=>{
 const cfg=defaultsFor(FULL_DESCRIPTOR.schema);cfg.production.minChance=.92;cfg.production.lossBudget=50;cfg.merchant.maxSpendPerHour=123;
 cfg.items=[{action:'keep',item:'rare'}];cfg.characters=[{name:'Fixed',rotation:false}];const before=structuredClone(cfg);
 applyAutonomousMode(cfg);
 for(const key of ['enabled','upgrade','compound','craft','exchange','autoHelpers','tokenBuy','dismantle'])assert.equal(cfg.production[key],true,key);
 assert.equal(cfg.world.bosses,true);assert.equal(cfg.party.selection,'adaptive');
 assert.equal(cfg.production.lossBudget,50);assert.equal(cfg.production.minChance,.92);assert.equal(cfg.merchant.maxSpendPerHour,123);
 assert.deepEqual(cfg.items,before.items);assert.deepEqual(cfg.characters,before.characters);
 cfg.general.autonomousSetup=false;cfg.production.autoHelpers=false;applyAutonomousMode(cfg);assert.equal(cfg.production.autoHelpers,false);
});
