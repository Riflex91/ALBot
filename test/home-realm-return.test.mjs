import test from 'node:test';
import assert from 'node:assert/strict';
import {assessServerHop,assessHomeSpawn,chooseHomeFallback} from '../src/world/servers.mjs';
import {createTeamTravel,nonPvpRealm,normalizeServerRegistry} from '../src/party/travel.mjs';
test('home realm requires sustained spawn observation before judging crowding',()=>{
 const base={realm:'EUII',home:'EUII',enteredAt:1000,checkMs:90000,threshold:.65};
 assert.equal(assessHomeSpawn({...base,now:60999,pressure:.95}).state,'checking');
 assert.equal(assessHomeSpawn({...base,now:91000,pressure:.7}).state,'crowded');
 assert.equal(assessHomeSpawn({...base,now:91000,pressure:.3}).state,'settled');
 assert.equal(assessHomeSpawn({...base,now:91000,pressure:null}).state,'checking');
});
test('fallback never uses the same crowded home realm or a disallowed/PVP realm',()=>{
 const servers=[{realm:'EUII',online:true,mode:'NORMAL',players:50},
  {realm:'USIV',online:true,mode:'NORMAL',players:100},
  {realm:'USII',online:true,mode:'NORMAL',players:1},
  {realm:'PVP',online:true,mode:'PVP',players:0}];
 assert.equal(chooseHomeFallback(servers,'EUII','EUII','USIV',r=>r!=='PVP'),'USIV');
 assert.equal(chooseHomeFallback(servers,'EUII','EUII','PVP',r=>r!=='PVP'),'USII');
});
test('USIV -> EUII probe -> crowded fallback holds ten-minute persisted retry',()=>{
 const old=Date.now;let clock=1000000;Date.now=()=>clock;
 try{
  let realm='USIV',pressure=.1;
  const storage=new Map(),root={ALBotServerRegistry:[]};
  const sync=()=>root.ALBotServerRegistry=['EUII','USIV','USII'].map((name,index)=>({
   realm:name,mode:'NORMAL',online:true,players:[90,20,10][index],at:clock}));
  sync();
  const cfg={general:{testLogging:true},farming:{pvp:false},
   party:{merchant:''},world:{serverHop:true,allowedRealms:['EUII','USIV','USII'],
    homeRealm:'EUII',homeRetryMs:600000,homeCheckMs:90000,homePressureThreshold:.65,
    hopCooldownMs:60000,autoHop:false,magiport:false}};
  const make=()=>{const me={name:'A'},p={root,parent:{},c:{name:'A',rip:false,q:{},ctype:'ranger'},
   realm:()=>realm,read:k=>storage.get(k),write:(k,v)=>{storage.set(k,structuredClone(v));return true;}};
   const bot={p,cfg,me,leader:'A',farmers:['A'],teamNames:['A'],running:true,session:'a',
    journal:null,inventoryBlocked:false,bank:{pending:false},logistics:{reserved:false},
    monsters:()=>[],teamPlan:{status:()=>({pressure})},
    movement:{stop(){}},exec:{pending:new Map()},transport:{fresh:()=>null,send:()=>Promise.resolve(true)},
    event(){},pause(){},report(){}};
   return createTeamTravel(bot);
  };
  const first=make();first.tick();
  assert.equal(first.status().hop?.realm,'EUII');
  assert.equal(first.status().home?.retryAt,clock+600000);
  realm='EUII';clock+=20000;sync();
  const returned=make();returned.tick();
  assert.equal(returned.status().home.phase,'checking');
  assert.equal(returned.status().home.enteredAt,clock);
  pressure=.85;clock+=95000;sync();returned.tick();
  assert.equal(returned.status().hop?.realm,'USIV');
  const after=returned.status().home;
  assert.equal(after.phase,'away');
  assert.ok(after.retryAt>=clock+600000);
  realm='USIV';clock+=599999;sync();
  const notYet=make();notYet.tick();
  assert.equal(notYet.status().hop,null,'no home retry earlier than ten minutes');
  clock+=1;sync();
  const retry=make();retry.tick();
  assert.equal(retry.status().hop?.realm,'EUII');
 }finally{Date.now=old;}
});

test('official EU and US numbered realms are eligible; PvP names and modes are always rejected',()=>{
 const roman=['I','II','III','IV','V','VI','VII','VIII','IX','X'];
 const official=['EU','US'].flatMap(region=>roman.map(id=>region+id));
 assert.equal(official.length,20);
 for(const realm of official)assert.equal(nonPvpRealm(realm),true,realm);
 for(const realm of ['EUPVP','USpVp','EUIIPvP','USI-PVP','PVP','ASIAI','EU','USIIIPVP'])
  assert.equal(nonPvpRealm(realm),false,realm);
 const at=100000,base={realm:'EUII',mode:'NORMAL',online:true,at};
 assert.equal(assessServerHop(base,[],at,{pvp:false,cooldown:60000}).allowed,true);
 assert.equal(assessServerHop({...base,mode:'PVP'},[],at,{pvp:true,cooldown:60000}).allowed,false,
  'PvP remains forbidden regardless of the farming flag');
 assert.equal(assessServerHop({...base,name:'eu-pVp'},[],at,{pvp:false,cooldown:60000}).allowed,false);
 const registry=normalizeServerRegistry([{region:'EU',name:'II',mode:'pVp',online:true,players:1}],at);
 assert.equal(registry[0].mode,'PVP');
});
test('server hop is aborted if the official destination becomes PvP before commit',async()=>{
 const original=Date.now;let now=1000000;Date.now=()=>now;
 try{
  let mode='NORMAL';const changes=[];
  const root={ALBotServerRegistry:[]};
  const update=()=>{root.ALBotServerRegistry=[{realm:'EUII',mode,online:true,players:0,at:now}];};
  update();
  const store=new Map();
  const bot={me:{name:'A'},leader:'A',farmers:['A'],session:'one',
   cfg:{general:{testLogging:true},farming:{pvp:false},party:{merchant:''},
    world:{serverHop:true,allowedRealms:['EUII','USII'],homeRealm:'',
     hopCooldownMs:60000,magiport:false,autoHop:false}},
   running:true,journal:null,inventoryBlocked:false,bank:{pending:false},
   logistics:{reserved:false},monsters:()=>[],movement:{stop(){}},
   transport:{fresh:()=>null,send:()=>Promise.resolve(true)},
   exec:{pending:new Map(),run:(kind,locks,guard,fn)=>guard()&&fn()},
   p:{root,parent:{},c:{name:'A',rip:false,q:{},ctype:'ranger'},
    realm:()=> 'USII',read:k=>store.get(k)??null,
    write:(k,v)=>{store.set(k,v);return true;},
    call:(name,...args)=>{changes.push([name,...args]);return Promise.resolve(true);}},
   pause(){},report(){},event(){}};
  const travel=createTeamTravel(bot);
  assert.equal(travel.requestHop('EUII'),true);
  mode='PVP';update();
  travel.tick();await Promise.resolve();await Promise.resolve();
  assert.deepEqual(changes,[],'not even a previously planned hop may enter PvP');
  assert.equal(travel.requestHop('EUIIPVP'),false);
 }finally{Date.now=original;}
});
