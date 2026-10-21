import test from 'node:test';
import assert from 'node:assert/strict';
import {createGear,merchantSelfEquipDecision} from '../src/production/gear.mjs';

const slots=['mainhand','offhand','helmet','chest','pants','shoes','gloves',
 'amulet','belt','cape','ring1','ring2','earring1','earring2','orb'];
const filled=amulet=>Object.fromEntries(slots.map(s=>[s,s==='amulet'?amulet:null]));
const skull={name:'skullamulet',level:2};
const hp=(level=2)=>({name:'hpamulet',level});
function fixture(){
 const now=Date.now(),peers={},profiles={};
 for(const [name,amulet] of [['Ranger1',hp(2)],['Ranger2',hp(3)]]){
  const gear={class:'ranger',level:70,realm:'EUII',session:name+'-session',
   complete:true,at:now,slots:filled(amulet)};
  peers[name]={name,running:true,rip:false,realm:'EUII',
   session:gear.session,gear};
  profiles[name]=gear;
 }
 const bot={
  me:{name:'Merchant',role:'merchant',gearRole:'auto',merchantMobility:'mobile'},
  farmers:['Ranger1','Ranger2'],teamNames:['Merchant','Ranger1','Ranger2'],
  cfg:{characters:['Ranger1','Ranger2'].map(name=>({name,enabled:true,
   role:'farmer',gearRole:'auto'})),
   production:{gear:true,minImprovement:0.05,offlineProfiles:false}},
  p:{G:{items:{skullamulet:{type:'amulet',level:0},
    hpamulet:{type:'amulet',level:0}},classes:{}},
   c:{ctype:'merchant',level:70,items:[skull],
    slots:filled(hp(0))},
   realm:()=> 'EUII',
   call:(method,item)=>{
    if(method==='item_properties'){
     if(item.name==='skullamulet')return {dex:9,luck:9,hp:20};
     if(item.name==='hpamulet')return {hp:12+(item.level??0)};
    }
    if(method==='equip')return true;
    throw Error('unexpected game call '+method);
   }},
  session:'merchant-session',transport:{fresh:name=>peers[name]??null},
  economy:{safe:()=>true,perform:()=>true},
  allocation:{equipGuard:()=>true},event:()=>{}
 };
 bot.gear={profile:name=>profiles[name]};
 return {bot,profiles,peers,now};
}
test('confirmed +2 compound stays with farmer demand even when merchant gains luck',()=>{
 const {bot}=fixture();
 const check=merchantSelfEquipDecision(bot,skull);
 assert.equal(check.allowed,false);
 assert.equal(check.reason,'farmer-gear-upgrade');
 assert.ok(['Ranger1','Ranger2'].includes(check.farmer));
});
test('farmer demand is independently checked for every selected farmer',()=>{
 const {bot,profiles}=fixture();
 profiles.Ranger1.slots.amulet={...skull};
 assert.equal(merchantSelfEquipDecision(bot,skull).allowed,false,
  'Ranger2 still needs the one available copy');
 profiles.Ranger2.slots.amulet={...skull};
 assert.deepEqual(merchantSelfEquipDecision(bot,skull),
  {allowed:true,reason:'farmer-needs-excluded'});
});
test('stale or unverifiable farmer proof never licenses merchant self-equip',()=>{
 for(const change of [
  f=>{f.profiles.Ranger1.at=Date.now()-121000;},
  f=>{f.peers.Ranger1.session='different';},
  f=>{f.peers.Ranger1.realm='USI';},
  f=>{f.peers.Ranger1.running=false;},
  f=>{delete f.profiles.Ranger1.slots.amulet;},
  f=>{delete f.profiles.Ranger1.complete;},
  f=>{delete f.peers.Ranger1;}
 ]){
  const f=fixture();change(f);
  const decision=merchantSelfEquipDecision(f.bot,skull);
  assert.equal(decision.allowed,false,decision.reason);
 }
});
test('items incompatible with all verified farmers may be equipped by merchant',()=>{
 const {bot,profiles}=fixture();
 bot.p.G.items.skullamulet.class=['merchant'];
 assert.equal(merchantSelfEquipDecision(bot,skull).allowed,true);
 // A disabled/offline alternate is not a selected farmer.
 bot.farmers=[];
 profiles.Ranger1.at=0;
 assert.equal(merchantSelfEquipDecision(bot,skull).allowed,true);
});
test('actual gear.equip admission and delayed guard both recheck farmer demand',()=>{
 const f=fixture();
 let pending=null;
 f.bot.economy.perform=(action,options)=>{pending={action,...options};return true;};
 f.bot.gear=createGear(f.bot);
 f.bot.gear.refresh();
 assert.equal(f.bot.gear.equip(0,{slot:'amulet'}),false);
 assert.equal(pending,null,'no gear transaction may be admitted while farmer needs it');
 for(const name of f.bot.farmers)f.peers[name].gear.slots.amulet={...skull};
 f.bot.gear.refresh();
 assert.equal(f.bot.gear.equip(0,{slot:'amulet'}),true);
 assert.equal(pending?.action,'gear.equip');
 assert.equal(pending.guard(),true);
 // While queued, a farmer loses the item; the delayed dispatch must deny.
 f.peers.Ranger2.gear.slots.amulet=hp(2);
 f.bot.gear.refresh();
 assert.equal(pending.guard(),false,'queued self-equip must yield to new farmer need');
});
