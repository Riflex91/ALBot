import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectMiningJournal,saveMiningAudit} from '../src/core/journal-audit.mjs';
import {fingerprint} from '../src/core/policy.mjs';
function make(){
 const items=[{name:'pickaxe',level:0},null,{name:'rod',level:0}];
 const bot={running:false,inventoryBlocked:true,exec:{pending:new Map()},p:{c:{items,gold:123,q:{}},realm:()=> 'EUII'}};
 bot.journal={kind:'gather.mining',at:1000,cost:0,loss:0,slots:[],evidence:{realm:'EUII',gold:123,inventory:items.map(i=>i?fingerprint(i):null)}};
 return bot;
}
test('identical paused mining journal can be reviewed but is never silently confirmed',()=>{
 const b=make(),audit=inspectMiningJournal(b);
 assert.equal(audit.eligible,true);assert.equal(audit.inventoryEqual,true);assert.deepEqual(audit.changes,[]);
 assert.equal(typeof audit.token,'string');
});
test('legitimate manual mining gain can be inspected and explicitly reconciled',()=>{
 const b=make();b.p.c.items[1]={name:'ore',level:0,q:2};
 const a=inspectMiningJournal(b);
 assert.equal(a.inventoryEqual,false);assert.equal(a.goldEqual,true);assert.equal(a.eligible,true);
 assert.deepEqual(a.changes.map(x=>[x.item,x.before,x.after]),[['ore',0,2]]);
 assert.equal(a.comparison.before[1],null);
});
test('exactly one or two ordinary mana potions may be explicitly reviewed but not automatically confirmed',()=>{
 const b=make();b.p.c.items[0]={name:'mpot0',level:0,q:98};
 b.journal.evidence.inventory[0]=fingerprint({name:'mpot0',level:0,q:100});
 let result=inspectMiningJournal(b);
 assert.equal(result.eligible,true);assert.equal(result.manualPotionLoss,2);assert.equal(result.changes[0].delta,-2);
 assert.match(result.reason,/mpot0/);
 b.p.c.items[0].q=99;result=inspectMiningJournal(b);
 assert.equal(result.eligible,true);assert.equal(result.manualPotionLoss,1);
 b.p.c.items[0].q=97;assert.equal(inspectMiningJournal(b).eligible,false,'three potions must not be implicitly excused');
 b.p.c.items[0].q=98;b.p.c.items[1]={name:'ore',level:0,q:4};
 assert.equal(inspectMiningJournal(b).eligible,true,'mining gains are compatible with two reviewed potion consumptions');
 b.p.c.items[2]=null;
 assert.equal(inspectMiningJournal(b).eligible,false,'any unrelated item loss blocks the review');
});
test('consumed special, locked or higher-level mana potions must not use ordinary mpot0 exception',()=>{
 const b=make();b.p.c.items[0]={name:'mpot0',level:1,q:98};b.journal.evidence.inventory[0]=fingerprint({name:'mpot0',level:1,q:100});
 assert.equal(inspectMiningJournal(b).eligible,false);
 b.p.c.items[0]={name:'mpot0',level:0,q:98,l:'s'};b.journal.evidence.inventory[0]=fingerprint({name:'mpot0',level:0,q:100,l:'s'});
 assert.equal(inspectMiningJournal(b).eligible,false);
});
test('never allow disappearance of old items, gold change, changed realm, running or skill pending',()=>{
 const b=make();b.p.c.items[0]=null;assert.equal(inspectMiningJournal(b).eligible,false);
 b.p.c.items[0]={name:'pickaxe',level:0};b.p.c.gold++;assert.equal(inspectMiningJournal(b).eligible,false);
 b.p.c.gold--;b.p.realm=()=> 'USI';assert.equal(inspectMiningJournal(b).eligible,false);
 b.p.realm=()=> 'EUII';b.running=true;assert.equal(inspectMiningJournal(b).eligible,false);
 b.running=false;b.exec.pending.set('gather.mining',{});assert.equal(inspectMiningJournal(b).eligible,false);
 b.exec.pending.clear();b.p.c.q.mining={at:123};assert.equal(inspectMiningJournal(b).eligible,false);
 b.p.c.q={};b.journal.kind='send';assert.equal(inspectMiningJournal(b).eligible,false);
});
test('malformed checkpoint fingerprints are not eligible',()=>{
 const b=make();b.journal.evidence.inventory[0]='invalid';
 assert.equal(inspectMiningJournal(b).eligible,false);
});
test('review token changes when user moves or receives items after audit',()=>{
 const b=make(),before=inspectMiningJournal(b);
 b.p.c.items[1]={name:'ore'};
 assert.notEqual(inspectMiningJournal(b).token,before.token);
});
test('audit download is a JSON-only browser operation; headless download is disabled',()=>{
 const events=[];class Blob{constructor(chunks){this.chunks=chunks}}
 const doc={body:{append(){}},createElement(){return {click(){events.push('click')},remove(){}}}};
 const p={headless:false,parent:{document:doc,Blob,URL:{createObjectURL(b){assert.equal(JSON.parse(b.chunks[0]).format,'albot-mining-manual-audit');return 'blob:dummy'},revokeObjectURL(){}},setTimeout(fn){fn()}},log:()=>assert.fail('not expected')};
 const file=saveMiningAudit(p,inspectMiningJournal(make()));
 assert.match(file,/^albot-mining-bestandspruefung-/);assert.deepEqual(events,['click']);
 assert.equal(saveMiningAudit({headless:true},inspectMiningJournal(make())),null);
});
