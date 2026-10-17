import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeLiveTeam,parseLiveReport,joinLiveReportParts} from '../scripts/lib/live-team-audit.mjs';

const start=Date.parse('2026-10-17T13:52:00.000Z');
const ev=(sec,type,fields={})=>({time:new Date(start+sec*1000).toISOString(),
 seq:sec+1,type,...fields});
const report=(character,events=[],extra={})=>({
 format:'albot-test-report',formatVersion:1,character,realm:'USV',
 version:'0.10.9-candidate',
 started:new Date(start).toISOString(),exported:ev(120,'').time,
 counts:{},dropped:0,actionStats:{attack:{started:2},'skill:3shot':{started:1}},
 events,equipment:{slots:{}},inventory:[],...extra
});
const item={name:'hpbelt',level:0,stat_type:'',p:'',title:''};
const detail=(id,to)=>JSON.stringify({id,to,item});

test('matched handoff intents detect immediate Merchant/Priest belt returns',()=>{
 const merchant=report('My_Merchant',[
  ev(0,'logistics.pursuit',{peer:'My_Priest',decision:'depart'}),
  ev(3,'inventory.intent',{kind:'send',item:JSON.stringify(item),to:'My_Priest',
    details:detail('merchant:1','My_Priest')}),
  ev(5,'inventory.intent',{kind:'receive',item:JSON.stringify(item),
    details:JSON.stringify({id:'priest:1',from:'My_Priest',item})})
 ]);
 const priest=report('My_Priest',[
  ev(4,'inventory.intent',{kind:'receive',item:JSON.stringify(item),
    details:JSON.stringify({id:'merchant:1',from:'My_Merchant',item})}),
  ev(5,'inventory.intent',{kind:'send',item:JSON.stringify(item),to:'My_Merchant',
    details:detail('priest:1','My_Merchant')})
 ]);
 const audit=analyzeLiveTeam([merchant,priest]);
 assert.equal(audit.transfers.matchedIntents,2);
 assert.equal(audit.transfers.pingpong.length,1);
 assert.equal(audit.merchant.pursuit.My_Priest.depart,1);
 assert.equal(audit.accepted,false);
 assert.ok(audit.issues.some(i=>i.code==='TRANSFER_PINGPONG'));
});

test('sampled idle remains a diagnostic, not a claim that a monster was available',()=>{
 const farmer=report('My_Ranger1',[
  ev(0,'sample',{running:true,task:'farm',reason:'Suche Farmziel',
    map:'main',target:null}),
  ev(5,'sample',{running:true,task:'farm',reason:'Suche Farmziel',
    map:'main',target:null}),
  ev(10,'sample',{running:true,task:'farm',reason:'Suche Farmziel',
    map:'main',target:null}),
  ev(15,'sample',{running:true,task:'farm',reason:'Kampf: bee',
    map:'main',target:'10'}),
  ev(17,'action.start',{key:'attack'})
 ]);
 const merchant=report('My_Merchant');
 const data=analyzeLiveTeam([merchant,farmer],
  {minIdleSeconds:10,maxSampledIdleSeconds:5});
 assert.equal(data.farmers.My_Ranger1.sampledIdleSeconds,15);
 assert.equal(data.scope.sampledIdleIsProofOfAvailableTargets,false);
 assert.ok(data.issues.some(i=>i.code==='FARM_IDLE'));
 assert.equal(data.accepted,true,'non-strict audit reports warnings without false failures');
 assert.equal(analyzeLiveTeam([merchant,farmer],
  {minIdleSeconds:10,maxSampledIdleSeconds:5,strict:true}).accepted,false);
});

test('healthy matched elixir delivery and final equipped state are distinguished',()=>{
 const d={name:'elixirint0',level:0,stat_type:'',p:'',title:''};
 const merchant=report('My_Merchant',[
  ev(2,'inventory.intent',{kind:'send',item:JSON.stringify(d),to:'My_Priest',
    details:detail('m:2','My_Priest')})
 ],{inventory:[{name:'elixirvit0',quantity:2}]});
 const priest=report('My_Priest',[
  ev(3,'inventory.intent',{kind:'receive',item:JSON.stringify(d),
    details:JSON.stringify({id:'m:2',from:'My_Merchant',item:d})})
 ],{equipment:{slots:{elixir:{name:'elixirint0'}}}});
 const audit=analyzeLiveTeam([merchant,priest],{requireElixirs:true,strict:true});
 assert.equal(audit.transfers.elixirMatched,1);
 assert.equal(audit.farmers.My_Priest.elixirEquipped,'elixirint0');
 assert.equal(audit.accepted,true);
});

test('refuses duplicate reporters, mixed realms, and reports incomplete history',()=>{
 const bad=report('My_Merchant');
 assert.throws(()=>analyzeLiveTeam([bad,bad]),/Duplicate/);
 const mixed=analyzeLiveTeam([bad,report('My_Priest',[],{realm:'EUII',dropped:70})]);
 assert.ok(mixed.issues.some(i=>i.code==='MIXED_SESSIONS'));
 assert.ok(mixed.issues.some(i=>i.code==='INCOMPLETE_EVENT_HISTORY'));
 assert.equal(mixed.farmers.My_Priest.incompleteEvents,true);
 assert.equal(mixed.accepted,false);
});


test('JSONL stream restores full history despite snapshot ring drops',()=>{
 const first=report('My_Priest',[
  ev(1,'sample',{reason:'Suche Farmziel'}),
  ev(2,'action.start',{key:'attack'})
 ],{counts:{sample:1,'action.start':1},dropped:700});
 const rows=[
  {type:'session',time:first.started,character:first.character,version:first.version},
  ...first.events.map((e,i)=>({...e,seq:i+1})),
  {...first,type:'snapshot',events:undefined}
 ];
 const read=parseLiveReport(rows.map(x=>JSON.stringify(x)).join('\n'));
 assert.equal(read.events.length,2);
 assert.equal(read.dropped,0,'ring evictions are not losses in complete JSONL');
 assert.equal(read.sourceFormat,'jsonl');
});

test('JSONL part gaps are reported, and same-session parts recombine safely',()=>{
 const full=report('My_Ranger1',[],{
  counts:{sample:3},dropped:2,
  events:[ev(1,'sample',{reason:'Suche Farmziel'}),ev(2,'sample'),ev(3,'sample')]
 });
 const first=parseLiveReport([
  {type:'session',time:full.started},
  {...full.events[0],seq:1},
  {...full,type:'snapshot',counts:{sample:1},events:undefined}
 ].map(x=>JSON.stringify(x)).join('\n'));
 const second=parseLiveReport([
  {type:'session',time:full.started},
  {...full.events[1],seq:2},
  {...full.events[2],seq:3},
  {...full,type:'snapshot',counts:{sample:3},events:undefined}
 ].map(x=>JSON.stringify(x)).join('\n'));
 assert.equal(second.dropped,1,'a single later part lacks prior events');
 const together=joinLiveReportParts([first,second]);
 assert.equal(together.length,1);
 assert.equal(together[0].dropped,0);
 assert.equal(together[0].events.length,3);
 assert.throws(()=>joinLiveReportParts([first,{...second,started:'2026-10-17T16:00:00Z'}]),
  /separate sessions/);
});
