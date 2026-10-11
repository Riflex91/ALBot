import test from 'node:test';
import assert from 'node:assert/strict';
import {Executor} from '../src/core/executor.mjs';
import {createFarmer} from '../src/combat/farmer.mjs';
import {isPotionConsumption} from '../src/core/checkpoint.mjs';

test('only verified official potion consume journals may be released without a value lock',()=>{
 const G={items:{hpot0:{type:'pot'},mpot0:{type:'pot'},ringsj:{type:'ring'}}};
 assert.equal(isPotionConsumption({kind:'consume',item:'hpot0'},G),true);
 assert.equal(isPotionConsumption({kind:'consume',item:'mpot0'},G),true);
 assert.equal(isPotionConsumption({kind:'consume',item:'ringsj'},G),false);
 assert.equal(isPotionConsumption({kind:'send',item:'hpot0'},G),false);
 assert.equal(isPotionConsumption({kind:'bank.store',item:'hpot0'},G),false);
 assert.equal(isPotionConsumption({kind:'consume',item:'unknown'},G),false);
 assert.equal(isPotionConsumption({kind:'consume',item:'hpot0'},{}),false);
});

function fixture(){
 let now=10000,consume=false;
 const c={name:'Ranger1',ctype:'ranger',map:'main',in:'main',x:0,y:0,hp:30,max_hp:100,mp:100,max_mp:100,rip:false,
  items:[{name:'hpot0',level:0,q:5}],slots:{}};
 const events=[],calls=[],bot={running:true,inventoryBlocked:false,journal:null,me:{name:'Ranger1',role:'farmer'},
  cfg:{farming:{hpBelow:.5,mpBelow:.2,restBelow:.1,resumeAbove:.85,potionUtilization:.65,potions:true}},
  p:{c,G:{items:{hpot0:{type:'pot',gives:[['hp',80]]}}},call:(name,arg)=>{
   calls.push([name,arg]);if(name==='is_on_cooldown')return false;
   if(name==='equip'){if(consume)c.items[0].q--;return Promise.resolve();}
   return null;
  }},monsters:()=>[],bank:{pending:false},logistics:{reserved:false},
  consumable:()=>true,count:name=>c.items.reduce((sum,item)=>sum+(item?.name===name?item.q??1:0),0),
  event:(name,data)=>events.push({name,data}),
  beginValue(){throw Error('Potions must not create durable value journals');},
  endValue(){throw Error('Potions must not resolve durable value journals');}
 };
 bot.exec=new Executor({now:()=>now,active:()=>bot.running,limit:5,onError(){}});
 const farmer=createFarmer(bot);
 return {bot,c,events,calls,farmer,setTime:x=>{now=x;},setConsume:x=>{consume=x;}};
}

test('ambiguous potion equip expires without setting inventoryBlocked or a journal',async()=>{
 const f=fixture();f.farmer.safety();
 assert.ok(f.bot.exec.pending.has('potion'));
 assert.equal(f.bot.journal,null);
 await Promise.resolve();
 f.setTime(19000);f.bot.exec.poll();
 assert.equal(f.bot.inventoryBlocked,false);
 assert.equal(f.bot.journal,null);
 assert.equal(f.events.find(e=>e.name==='inventory.result')?.data.result,'unknown');
 assert.equal(f.events.find(e=>e.name==='inventory.result')?.data.valueActionsBlocked,false);
 f.farmer.safety();
 assert.ok(f.bot.exec.pending.has('potion'),'next potion can be attempted after timeout without a lock');
});

test('observed potion consumption succeeds without ever creating a value journal',async()=>{
 const f=fixture();f.setConsume(true);f.farmer.safety();
 assert.ok(f.bot.exec.pending.has('potion'));
 f.bot.exec.poll();
 assert.equal(f.bot.exec.pending.has('potion'),false);
 assert.equal(f.bot.inventoryBlocked,false);
 assert.equal(f.bot.journal,null);
 assert.equal(f.events.find(e=>e.name==='inventory.result')?.data.result,'confirmed');
});

test('legacy potion cleanup occurs at bootstrap before inventoryBlocked is initialized',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
 const release=source.indexOf('if(isPotionConsumption(journal,p.G))');
 const lock=source.indexOf('inventoryBlocked:!!journal');
 assert.ok(release>0&&release<lock,'legacy potion journal is released before constructing the bot');
});
