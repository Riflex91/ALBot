import test from 'node:test';
import assert from 'node:assert/strict';
import {fitHeartbeat,createTransport} from '../src/party/transport.mjs';
import {createAccount} from '../src/party/account.mjs';
import {coordinatedPartyFarmers,canonicalPartyOwner,canAcceptPartyInvite,
 canAcceptPartyRequest,currentPartyOwner} from '../src/main.mjs';

const roster=['My_Ranger1','My_Ranger2','My_Priest','My_Merchant'];
const elected={names:roster.filter(x=>x!=='My_Merchant'),leader:'My_Ranger1',
 seq:0,rotationSince:1700000000000};
const cfg={
 party:{enabled:true,selection:'adaptive',leader:'',merchant:'My_Merchant',
  maxFarmers:3,rotationCooldownMs:60000},
 general:{messageTtlMs:10000,transport:'auto',autoRoster:true},
 production:{lossBudget:0},
 characters:roster.map(name=>({name,enabled:true,group:'team1',
  role:name==='My_Merchant'?'merchant':'farmer'}))
};
function live(name,{selection=elected,merchantParty='My_Ranger1'}={}){
 const members={My_Ranger1:'My_Ranger1',My_Merchant:merchantParty,
  My_Ranger2:null,My_Priest:null};
 const peers=new Map(roster.map(n=>[n,{
  name:n,running:true,rip:false,realm:'EUII',
  party:members[n],session:n+'-session',team:n==='My_Merchant'?selection:null
 }]));
 const bot={me:{name,group:'team1',role:name==='My_Merchant'?'merchant':'farmer'},
  cfg:structuredClone(cfg),running:true,teamNames:roster,
  farmers:name==='My_Merchant'?[...elected.names]:[name],
  leader:name==='My_Merchant'?'My_Ranger1':name,
  p:{c:{name,party:members[name],hp:100,max_hp:100,rip:false},
   parent:{party:members[name]?[name]:[]},
   realm:()=> 'EUII',has:()=>true,read:()=>null,write:()=>true},
  transport:{fresh:n=>peers.get(n)??null},
  movement:{stop(){},order:null},monsters:()=>[],
  logistics:{reserved:false},gold:{reserved:false},
  exec:{pending:new Map()},event(){},report(){}};
 return {bot,peers};
}
test('W15 real 0.38 symptom: three isolated combat leaders adopt the full merchant election',()=>{
 for(const name of elected.names){
  const {bot}=live(name);
  assert.deepEqual(coordinatedPartyFarmers(bot),elected.names,
   'stale self-only leader must not veto coordinator selection');
  assert.equal(canonicalPartyOwner(bot),'My_Ranger1',
   'actual owner is native Ranger1, even though Merchant is a member');
  assert.equal(currentPartyOwner(bot),name==='My_Ranger1'?null:'My_Ranger1');
  if(name!=='My_Ranger1')
   assert.equal(canAcceptPartyInvite(bot,'My_Ranger1'),true);
 }
 const {bot:owner}=live('My_Ranger1');
 assert.equal(canAcceptPartyRequest(owner,'My_Priest'),true,
  'owner can accept any centrally selected unpartied farmer');
 assert.equal(canAcceptPartyRequest(owner,'My_Ranger2'),true);
});
test('W15 native owner proof survives dropped team data without electing Merchant',()=>{
 const {bot,peers}=live('My_Ranger2',{selection:null});
 assert.deepEqual(coordinatedPartyFarmers(bot),['My_Ranger2'],
  'truncated election cannot be invented locally');
 assert.equal(canonicalPartyOwner(bot),'My_Ranger1',
  'verified Merchant.party plus independent Ranger1.party proves ownership');
 peers.get('My_Ranger1').party='OtherParty';
 assert.equal(canonicalPartyOwner(bot),null,
  'unconfirmed advertised owner must never be used');
});
test('W15 oversized account status keeps election, or fails closed for compact resend',()=>{
 const status={
  name:'My_Merchant',realm:'EUII',running:true,party:'My_Ranger1',
  items:[],materials:[],team:structuredClone(elected),
  performance:'p'.repeat(2400),skills:'s'.repeat(1600),
  stock:'w'.repeat(800)
 };
 const fitted=fitHeartbeat(status,4200);
 assert.ok(fitted,'normal optional shedding fits');
 assert.deepEqual(fitted.team,elected,'active election cannot be shed');
 const impossible=fitHeartbeat({...status,bankOwner:'z'.repeat(4700)},4200);
 assert.equal(impossible,null,'critical oversized status must fail closed');
});

function accountFixture(name){
 const {bot,peers}=live(name,{selection:null});
 let stopped=0;
 bot.movement.stop=()=>{stopped++;};
 const account=createAccount(bot);
 bot.account=account;
 return {bot,peers,account,get stops(){return stopped;}};
}
test('W15 separately delivered, session-matched team election synchronizes leader and three farmers',()=>{
 for(const name of ['My_Ranger2','My_Priest','My_Ranger1']){
  const f=accountFixture(name);
  assert.equal(f.bot.leader,name);
  const h=f.peers.get('My_Merchant');
  f.account.receiveMessage('My_Merchant',{
   type:'accountTeam',session:h.session,data:{realm:'EUII',team:elected}});
  assert.deepEqual(f.bot.farmers,elected.names);
  assert.equal(f.bot.leader,'My_Ranger1');
  assert.equal(f.account.status().lastAcceptedTeam?.from,'My_Merchant');
  assert.equal(canonicalPartyOwner(f.bot),'My_Ranger1');
  assert.ok(f.stops>=Number(name!=='My_Ranger1'));
 }
});
test('W15 invalid coordinator broadcast does not override an already local elected team',()=>{
 const f=accountFixture('My_Priest');
 const call=(from,session,realm,team)=>f.account.receiveMessage(from,{
  type:'accountTeam',session,data:{realm,team}});
 call('My_Ranger2','My_Ranger2-session','EUII',elected);
 assert.deepEqual(f.bot.farmers,['My_Priest'],'noncoordinator rejected');
 call('My_Merchant','old-session','EUII',elected);
 assert.deepEqual(f.bot.farmers,['My_Priest'],'stale session rejected');
 call('My_Merchant','My_Merchant-session','USIV',elected);
 assert.deepEqual(f.bot.farmers,['My_Priest'],'cross realm rejected');
 call('My_Merchant','My_Merchant-session','EUII',
  {...elected,names:['My_Ranger1','Foreign']});
 assert.deepEqual(f.bot.farmers,['My_Priest'],'unknown member rejected');
 call('My_Merchant','My_Merchant-session','EUII',
  {...elected,names:['My_Ranger1','My_Ranger1']});
 assert.deepEqual(f.bot.farmers,['My_Priest'],'duplicate selection rejected');
});

function wireTransport(){
 const pending=[],listeners={};
 const bots=new Map();
 for(const name of ['My_Ranger1','My_Merchant']){
  const incoming=[];
  const p={c:{name,map:'main',in:'main',party:name==='My_Ranger1'?'My_Ranger1':'My_Ranger1',
   x:0,y:0,items:[],rip:false,hp:100,max_hp:100,mp:100,max_mp:100,
   ctype:name==='My_Merchant'?'merchant':'ranger',
   level:60,attack:100,frequency:1,armor:10,resistance:10,range:200,gold:1000},
   G:{items:{},skills:{}},ipc:false,headless:false,parent:{},
   realm:()=> 'EUII',hook:(type,handler)=>{
    listeners[name+':'+type]=handler;return ()=>{};},
   call:(type,to,m)=>{if(type!=='send_cm')throw Error(type);
    pending.push({to,from:name,m});return true;}};
  const me={name,group:'team1',role:name==='My_Merchant'?'merchant':'farmer'};
  const bot={p,me,cfg:structuredClone(cfg),session:name+'-session',
   running:true,leader:'My_Ranger1',farmers:[...elected.names],teamNames:roster,
   journal:null,inventoryBlocked:false,exec:{pending:new Map()},
   logistics:{summary:()=>[],reserved:false},free:()=>40,
   monsters:()=>[],report(){},event(){}};
  bot.account={heartbeat:()=>structuredClone(elected),
   receiveMessage:(from,m)=>incoming.push({from,m})};
  bot.transport=createTransport(bot);bots.set(name,{bot,incoming});
 }
 const deliver=()=>{
  const batch=pending.splice(0);
  for(const {to,from,m} of batch)listeners[to+':on_cm']?.(from,m);
  return batch;
 };
 return {bots,deliver,pending};
}
test('W15 transport sends compact accountTeam independently of bulky status',async()=>{
 const f=wireTransport(),r=f.bots.get('My_Ranger1').bot,
  merchant=f.bots.get('My_Merchant').bot;
 r.transport.heartbeat();await Promise.resolve();f.deliver();
 merchant.transport.heartbeat();await Promise.resolve();
 const frames=f.deliver();
 assert.ok(frames.some(x=>x.m.type==='accountTeam'&&
  x.to==='My_Ranger1'),'merchant must broadcast separate election');
 assert.equal(f.bots.get('My_Ranger1').incoming.at(-1)?.m?.type,'accountTeam');
 assert.deepEqual(f.bots.get('My_Ranger1').incoming.at(-1).m.data.team.names,
  elected.names);
 r.transport.close();merchant.transport.close();
});
