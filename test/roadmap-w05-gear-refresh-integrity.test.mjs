import test from 'node:test';
import assert from 'node:assert/strict';
import {createGear} from '../src/production/gear.mjs';

const canonical=['mainhand','offhand','helmet','chest','pants','shoes',
 'gloves','amulet','belt','cape','ring1','ring2','earring1','earring2','orb'];
const intact=()=>Object.fromEntries(canonical.map(k=>[k,null]));
function fixture(incoming){
 const saved=[];
 const data={class:'priest',level:70,complete:true,at:Date.now(),
  realm:'EUI',slots:incoming};
 const bot={
  me:{name:'M',role:'merchant',gearRole:'auto'},session:'session-m',
  teamNames:['M','P'],cfg:{production:{gear:true,offlineProfiles:true},
   party:{selection:'fixed'},characters:[{name:'P',class:'priest',
    enabled:true,role:'farmer',gearRole:'auto'}]},
  p:{c:{ctype:'merchant',level:60,slots:{},items:[]},
   G:{items:{staff:{type:'weapon'},helmet:{type:'helmet'}}},
   realm:()=> 'EUI',read:()=>({}),
   write:(key,val)=>{saved.push([key,val]);return true;}},
  transport:{fresh:name=>name==='P'?{realm:'EUI',session:'p',gear:data}:null},
  economy:{},running:true
 };
 const gear=createGear(bot);
 return {gear,data,saved};
}
test('W05 full known remote gear may refresh canonical physical slots',()=>{
 const slots=intact();slots.mainhand={name:'staff',level:3};
 const f=fixture(slots);
 f.gear.refresh();
 assert.equal(f.gear.profile('P').complete,true);
 assert.deepEqual(f.gear.profile('P').slots.mainhand,{
  name:'staff',level:3,stat_type:'',p:'',title:'',l:false,b:false
 });
 assert.deepEqual(Object.keys(f.gear.profile('P').slots),canonical);
});
test('W05 unknown occupied item cannot be converted into urgent empty slot',()=>{
 const slots=intact();slots.mainhand={name:'not-in-game-definition',level:5};
 const f=fixture(slots);
 f.gear.refresh();
 assert.equal(f.gear.profile('P'),null,
  'unrecognized physical mainhand must not appear as an empty slot');
 slots.mainhand={name:'staff',level:3};
 f.gear.refresh();
 assert.equal(f.gear.profile('P').slots.mainhand.name,'staff');
 slots.mainhand={name:'unknown-item',level:5};
 f.gear.refresh();
 assert.equal(f.gear.profile('P').slots.mainhand.name,'staff',
  'invalid later snapshot cannot rewrite the last valid sighting as empty');
});
test('W05 every malformed canonical gear slot invalidates the whole snapshot',()=>{
 for(const invalid of [{name:'',level:0},{name:'staff'},
  {name:'staff',level:NaN},{name:'staff',level:1.5},
  {name:'staff',level:-1},true,{},undefined]){
  const slots=intact();slots.mainhand=invalid;
  const f=fixture(slots);f.gear.refresh();
  assert.equal(f.gear.profile('P'),null,JSON.stringify(invalid));
 }
 const missing=intact();delete missing.mainhand;
 const f=fixture(missing);f.gear.refresh();
 assert.equal(f.gear.profile('P'),null);
});
test('W05 noncanonical extra gear cannot be treated as observed or overwrite canonical keys',()=>{
 const slots=intact();slots.mainhand={name:'staff',level:2};
 slots.trade1={name:'fake',level:99};
 slots.synthetic={name:'helmet',level:4};
 const f=fixture(slots);f.gear.refresh();
 const p=f.gear.profile('P');
 assert.equal(p.slots.mainhand.name,'staff');
 assert.deepEqual(Object.keys(p.slots),canonical);
 assert.equal(p.slots.synthetic,undefined);
 assert.equal(p.slots.trade1,undefined);
});
