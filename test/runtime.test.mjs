import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {defaultsFor} from '../editor/lib/contract.mjs';
import {LIVE_DESCRIPTOR} from '../src/config/live-a.mjs';
import {ECONOMY_DESCRIPTOR} from '../src/config/live-b.mjs';
import {INTEGRATION_DESCRIPTOR} from '../src/config/live-c.mjs';
const code=readFileSync(new URL('../dist/albot.runtime.js',import.meta.url),'utf8');

test('Live C same classic bundle boots browser and headless; declared rule and task survive no stale timers',()=>{
 for(const browser of [false,true]){
  const a=harness(),cfg=defaultsFor(INTEGRATION_DESCRIPTOR.schema);cfg.characters=[{...defaultsFor(INTEGRATION_DESCRIPTOR.schema.properties.characters.items),name:'A',class:'ranger'}];cfg.party.enabled=false;cfg.general.ui=false;cfg.farming.autoTravel=false;cfg.farming.loot=false;cfg.farming.targets=['goo','bee'];
  cfg.rules=[{...defaultsFor(INTEGRATION_DESCRIPTOR.schema.properties.rules.items),name:'Hinweis',action:'notify',target:'C-Regel aktiv',conditions:[{...defaultsFor(INTEGRATION_DESCRIPTOR.schema.properties.rules.items.properties.conditions.items),field:'map',operator:'eq',value:'main'}]}];a.root.ALBotConfig=cfg;
  if(browser){delete a.root.parent.headless;delete a.root.parent.caracAL;a.root.performance_trick=()=>{};}
  a.load();assert.equal(a.root.ALBot.status().running,true,JSON.stringify(a.root.ALBot.status()));assert.equal(a.root.ALBot.schemaId,'albot.live-c/v1');assert.ok(a.calls.some(x=>x[0]==='log'&&x[1].includes('C-Regel aktiv')));
  assert.equal(a.root.ALBot.requestTask('farm:unknown'),false);assert.equal(a.root.ALBot.requestTask('farm:bee',10000),true);assert.equal(JSON.parse(a.root.ALBot.testReport()).strategy.manual.id,'bee');
  a.root.ALBot.pause();assert.equal(a.root.ALBot.requestTask('farm:bee'),false);assert.equal(JSON.parse(a.root.ALBot.testReport()).strategy.manual,null);assert.equal(a.timers.size,0);assert.equal(a.root.ALBot.start(),true);a.load();assert.equal(a.timers.size,1);a.root.ALBot.dispose();assert.equal(a.timers.size,0);assert.equal(a.listeners.size,0);
 }
});

test('Live C conditional pause cannot fall through into a combat action',()=>{
 const a=harness(),cfg=defaultsFor(INTEGRATION_DESCRIPTOR.schema);cfg.characters=[{...defaultsFor(INTEGRATION_DESCRIPTOR.schema.properties.characters.items),name:'A'}];cfg.party.enabled=false;cfg.general.ui=false;cfg.farming.targets=['goo'];cfg.rules=[{...defaultsFor(INTEGRATION_DESCRIPTOR.schema.properties.rules.items),action:'pause',target:'Regel-Pause',conditions:[{...defaultsFor(INTEGRATION_DESCRIPTOR.schema.properties.rules.items.properties.conditions.items),field:'map',operator:'eq',value:'main'}]}];a.root.ALBotConfig=cfg;a.root.parent.entities={g:{id:'g',type:'monster',mtype:'goo',hp:100,x:1,y:1}};a.load();assert.equal(a.root.ALBot.status().running,false);assert.equal(a.calls.filter(x=>x[0]==='attack').length,0);assert.equal(a.timers.size,0);a.root.ALBot.dispose();
});

test('Live C event journey starts before wait-for-team would block map transition',()=>{
 const a=harness(),cfg=defaultsFor(INTEGRATION_DESCRIPTOR.schema);cfg.characters=['A','B'].map(name=>({...defaultsFor(INTEGRATION_DESCRIPTOR.schema.properties.characters.items),name}));cfg.general.ui=false;cfg.farming.targets=['goo'];cfg.farming.loot=false;cfg.party.leader='A';cfg.world.events=true;cfg.world.allowedEvents=['boss'];a.root.G.maps.arena={};a.root.G.monsters.boss={attack:1};a.root.G.events={boss:{map:'arena'}};a.root.S={boss:{live:true,map:'arena',x:0,y:0}};let joined=0;a.root.join=id=>{assert.equal(id,'boss');joined++;return Promise.resolve();};a.root.ALBotConfig=cfg;a.load();assert.equal(a.root.ALBot.status().running,true);assert.equal(joined,1);a.root.ALBot.dispose();
});

test('Live B defaults autostart in both environments and reports economy without experimental options',()=>{
 for(const browser of [false,true]){
  const a=harness('M'),cfg=defaultsFor(ECONOMY_DESCRIPTOR.schema);cfg.characters=[{...defaultsFor(ECONOMY_DESCRIPTOR.schema.properties.characters.items),name:'M',role:'merchant',class:'merchant'}];cfg.party.merchant='M';cfg.party.enabled=false;cfg.general.ui=false;cfg.farming.loot=false;
  a.root.ALBotConfig=cfg;a.c.ctype='merchant';a.c.gold=1000000;
  if(browser){delete a.root.parent.headless;a.root.performance_trick=()=>{};}
  a.load();assert.equal(a.root.ALBot.status().running,true,JSON.stringify(a.root.ALBot.status()));
  assert.equal(a.root.ALBot.schemaId,'albot.live-b/v1');assert.equal(JSON.parse(a.root.ALBot.testReport()).test,'Live B');
  assert.equal(cfg.merchant.fishing,undefined);a.root.ALBot.dispose();assert.equal(a.timers.size,0);
 }
});
function harness(name='A',sharedParent=null){
 const cfg=defaultsFor(LIVE_DESCRIPTOR.schema);cfg.characters=[{...defaultsFor(LIVE_DESCRIPTOR.schema.properties.characters.items),name}];cfg.general.autostart=false;cfg.party.enabled=false;cfg.general.ui=false;cfg.farming.autoTravel=false;cfg.farming.loot=false;
 const calls=[],timers=new Map(),storage=new Map(),listeners=new Set();let next=0;
 const parent=sharedParent??{server_region:'EU',server_identifier:'II',entities:{},headless:{apiVersion:1,capabilities:{localMessages:true},send:async()=>({queued:[]}),onMessage:f=>{listeners.add(f);return ()=>listeners.delete(f);}},caracAL:{siblings:[]}};
 const c={name,type:'character',ctype:'ranger',map:'main',in:'main',x:0,y:0,hp:100,max_hp:100,mp:100,max_mp:100,range:100,attack:20,level:60,items:Array(42).fill(null),s:{},slots:{}};
 const root={parent,character:c,ALBotConfig:cfg,G:{skills:{attack:{}},maps:{main:{}},items:{},monsters:{goo:{}}},TextEncoder,structuredClone,console,Date,Math,
  setTimeout:f=>{timers.set(++next,f);return next;},clearTimeout:id=>timers.delete(id),game_log:m=>calls.push(['log',m]),set_message(){},get:k=>storage.get(k),set:(k,v)=>{storage.set(k,structuredClone(v));return true;},is_on_cooldown:()=>false,can_attack:()=>true,can_move_to:()=>true,attack:e=>{calls.push(['attack',e.id]);return Promise.resolve({success:true});},change_target:e=>{c.target=e.id;},stop:()=>Promise.resolve(),move:()=>Promise.resolve()};
 const context=vm.createContext(root);const load=()=>vm.runInContext(code,context);return {root,cfg,c,calls,timers,storage,listeners,load};
}
test('same artifact keeps contexts independent, one timer and cleans listeners on reload',()=>{
 const a=harness('A');a.load();assert.equal(a.root.ALBot.status().running,false);assert.equal(a.listeners.size,1);assert.equal(a.root.ALBot.start(),true);assert.equal(a.timers.size,1);a.root.ALBot.start();assert.equal(a.timers.size,1);
 const b=harness('B',a.root.parent);b.load();b.root.ALBot.start();assert.equal(a.root.ALBot.status().running,true);
 a.load();assert.equal(a.timers.size,0);assert.equal(a.root.ALBot.status().running,false);assert.equal(a.listeners.size,2);a.root.ALBot.dispose();b.root.ALBot.dispose();assert.equal(a.listeners.size,0);
});
test('unsupported config and unresolved value checkpoint prevent gameplay',()=>{
 const a=harness();a.cfg.production={enabled:true};a.load();assert.equal(a.root.ALBot.status().state,'invalid');assert.equal(a.timers.size,0);
 const b=harness();b.storage.set('albot:live-a:A:checkpoint',{journal:{kind:'send',item:'hpot1'}});b.load();assert.equal(b.root.ALBot.start(),false);assert.equal(b.root.ALBot.status().inventoryBlocked,true);assert.equal(b.timers.size,0);
});
test('CODE without TextEncoder or structuredClone boots without changing host globals',()=>{
 const a=harness();delete a.root.TextEncoder;delete a.root.structuredClone;a.cfg.general.name='Grüße 🧙';a.load();assert.equal(a.root.ALBot.start(),true);assert.equal(a.root.ALBot.status().profile,'Grüße 🧙');assert.equal(a.root.TextEncoder,undefined);a.root.ALBot.dispose();
});
test('full browser storage does not mislabel an unsent potion as unknown',async()=>{
 const a=harness();a.root.localStorage={removeItem(){},setItem(){const e=new Error('full');e.name='QuotaExceededError';throw e;}};a.root.G.items.hpot1={type:'pot',gives:[['hp',400]]};a.c.items[0]={name:'hpot1',q:5};a.c.hp=50;let used=0;
 a.root.equip=()=>{used++;a.c.items[0].q--;a.c.hp=100;return Promise.resolve({success:true});};a.load();a.root.ALBot.start();assert.equal(used,1);await Promise.resolve();const next=[...a.timers.entries()][0];a.timers.delete(next[0]);next[1]();assert.equal(a.root.ALBot.status().inventoryBlocked,false);assert.equal(a.root.ALBot.status().running,true);const report=JSON.parse(a.root.ALBot.testReport());assert.equal(report.checkpointMode,'memory-consumption-only');assert.match(report.storageError,/QuotaExceeded/);a.root.ALBot.dispose();
});
test('whitelisted live target attacks once, foreign target is rejected and pause stops scheduling',()=>{
 const a=harness();a.root.parent.entities={goo:{id:'goo',type:'monster',mtype:'goo',hp:100,x:10,y:10,target:'Stranger'}};a.load();a.root.ALBot.start();assert.equal(a.calls.filter(x=>x[0]==='attack').length,0);a.root.ALBot.pause();assert.equal(a.timers.size,0);
 a.root.parent.entities.goo.target=null;a.root.ALBot.start();assert.equal(a.calls.filter(x=>x[0]==='attack').length,1);a.root.ALBot.stop();assert.equal(a.timers.size,0);assert.equal(a.root.ALBot.status().pending,0);
});

test('browser always requests performance trick, reuses playing audio and headless never calls it',()=>{
 const a=harness();delete a.root.parent.headless;delete a.root.parent.caracAL;let calls=0;
 a.root.performance_trick=()=>{calls++;};a.load();assert.equal(calls,1);
 assert.equal(a.root.ALBot.status().running,false);
 assert.equal(JSON.parse(a.root.ALBot.testReport()).performanceTrick.state,'requested');
 a.root.parent.sounds={empty:{playing:()=>true}};a.load();assert.equal(calls,1);
 assert.equal(JSON.parse(a.root.ALBot.testReport()).performanceTrick.state,'already-playing');
 a.root.parent.sounds.empty.playing=()=>false;a.load();assert.equal(calls,2);a.root.ALBot.dispose();
 const b=harness();b.root.performance_trick=()=>{throw Error('must not call');};b.load();
 assert.equal(JSON.parse(b.root.ALBot.testReport()).performanceTrick.state,'headless-skipped');b.root.ALBot.dispose();
});

test('unavailable or failing browser performance trick is diagnosed without preventing start',()=>{
 for(const throws of [false,true]){
  const a=harness();delete a.root.parent.headless;delete a.root.parent.caracAL;
  if(throws)a.root.performance_trick=()=>{throw Error('audio blocked');};a.load();
  const report=JSON.parse(a.root.ALBot.testReport());assert.equal(report.performanceTrick.state,'failed');
  assert.equal(report.incidents[0].where,'performance_trick');assert.equal(a.root.ALBot.start(),true);a.root.ALBot.dispose();
 }
});

test('expected attack and loot races are transient diagnostics, not hard incidents',async()=>{
 const a=harness();a.cfg.farming.loot=true;a.root.parent.entities={goo:{id:'goo',type:'monster',mtype:'goo',hp:100,x:10,y:10,target:null}};
 a.root.attack=()=>Promise.reject(new Error('not_there'));a.root.loot=()=>Promise.reject(new Error('openning'));
 a.load();a.root.ALBot.start();await new Promise(resolve=>setImmediate(resolve));
 const report=JSON.parse(a.root.ALBot.testReport());assert.equal(report.actionStats.attack.transient,1);assert.equal(report.actionStats.attack.transientReasons.not_there,1);assert.equal(report.actionStats.loot.transient,1);assert.equal(report.actionStats.loot.transientReasons.openning,1);assert.equal(report.incidents.some(x=>x.where==='attack'||x.where==='loot'),false);assert.equal(a.root.ALBot.status().target,null);a.root.ALBot.dispose();
});


test('Live B merchant keeps recovery but skips farmer loot so economy inventory stays available',()=>{
 const a=harness('M'),cfg=defaultsFor(ECONOMY_DESCRIPTOR.schema),character=defaultsFor(ECONOMY_DESCRIPTOR.schema.properties.characters.items);
 cfg.characters=[{...character,name:'M',role:'merchant',class:'merchant'}];cfg.party.merchant='M';cfg.party.enabled=false;cfg.general.ui=false;cfg.farming.loot=true;cfg.general.autostart=true;
 a.root.ALBotConfig=cfg;a.c.ctype='merchant';a.c.gold=1000000;a.c.items[0]={name:'gslime',q:2};let loots=0;a.root.loot=()=>{loots++;return Promise.resolve();};
 a.load();assert.equal(a.root.ALBot.status().running,true);assert.equal(loots,0);assert.match(a.root.ALBot.status().reason,/Merchant wartet/);a.root.ALBot.dispose();
});

test('Live C blocked Bee approach routes to the monster instead of an obstructed intermediate point',()=>{
 const a=harness(),cfg=defaultsFor(INTEGRATION_DESCRIPTOR.schema);cfg.characters=[{...defaultsFor(INTEGRATION_DESCRIPTOR.schema.properties.characters.items),name:'A',class:'ranger'}];cfg.party.enabled=false;cfg.general.ui=false;cfg.farming.loot=false;cfg.farming.targets=['goo','bee'];
 cfg.rules=[{...defaultsFor(INTEGRATION_DESCRIPTOR.schema.properties.rules.items),action:'farm',target:'bee',conditions:[{...defaultsFor(INTEGRATION_DESCRIPTOR.schema.properties.rules.items.properties.conditions.items),field:'hpRatio',operator:'gte',value:'0.95'}]}];a.root.ALBotConfig=cfg;
 a.c.x=201;a.c.y=771;a.root.G.monsters.bee={};a.root.parent.entities.b={id:'b',type:'monster',mtype:'bee',hp:100,map:'main',in:'main',x:520,y:753};a.root.can_attack=()=>false;a.root.can_move_to=()=>false;let destination,stops=0;
 a.root.move=()=>{throw Error('Blocked local move submitted');};a.root.smart_move=d=>{destination=d;return new Promise(()=>{});};a.root.stop=()=>{stops++;return Promise.resolve();};a.load();
 assert.equal(destination.x,520);assert.equal(destination.y,753);assert.match(a.root.ALBot.status().reason,/Unterwegs zu bee/);let report=JSON.parse(a.root.ALBot.testReport());assert.equal(report.movement.mode,'smart_move');assert.equal(report.movement.destination.x,520);
 a.c.x=500;a.c.y=753;a.c.moving=true;const next=[...a.timers.entries()][0];a.timers.delete(next[0]);next[1]();report=JSON.parse(a.root.ALBot.testReport());assert.equal(report.movement,null);assert.ok(stops>0);a.root.ALBot.dispose();
});

test('old C profiles remain valid and Merrit character listeners are removed on reload/dispose',()=>{
 const a=harness(),cfg=defaultsFor(INTEGRATION_DESCRIPTOR.schema);cfg.characters=[{...defaultsFor(INTEGRATION_DESCRIPTOR.schema.properties.characters.items),name:'A'}];cfg.party.enabled=false;cfg.general.ui=false;cfg.farming.enabled=false;delete cfg.merchant.partialBank;delete cfg.merchant.partialBankMaxStack;a.root.ALBotConfig=cfg;const listeners=new Map();let serial=0;a.c.on=(event,fn)=>{assert.equal(event,'merrit');const id=String(++serial);listeners.set(id,fn);return id;};a.c.remove=id=>listeners.delete(id);
 a.load();assert.equal(a.root.ALBot.status().running,true);assert.equal(listeners.size,1);a.load();assert.equal(listeners.size,1);a.root.ALBot.dispose();assert.equal(listeners.size,0);
});
