import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {defaultsFor} from '../editor/lib/contract.mjs';
import {LIVE_DESCRIPTOR} from '../src/config/live-a.mjs';
const code=readFileSync(new URL('../dist/albot.runtime.js',import.meta.url),'utf8');
function harness(name='A',sharedParent=null){
 const cfg=defaultsFor(LIVE_DESCRIPTOR.schema);cfg.characters=[{...defaultsFor(LIVE_DESCRIPTOR.schema.properties.characters.items),name}];cfg.party.enabled=false;cfg.general.ui=false;cfg.farming.autoTravel=false;cfg.farming.loot=false;
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
