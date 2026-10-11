import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectMiningJournal} from '../src/core/journal-audit.mjs';
import {fingerprint} from '../src/core/policy.mjs';

function make(){
 const items=[{name:'pickaxe',level:0},null,{name:'rod',level:0}];
 const bot={running:false,inventoryBlocked:true,exec:{pending:new Map()},p:{c:{items,gold:123},realm:()=> 'EUII'}};
 bot.journal={kind:'gather.mining',cost:0,loss:0,slots:[],evidence:{realm:'EUII',gold:123,inventory:items.map(i=>i?fingerprint(i):null)}};
 return bot;
}
test('manual mining audit permits explicit review only for identical paused zero-cost mining journal',()=>{
 const b=make();const v=inspectMiningJournal(b);assert.equal(v.eligible,true);assert.equal(v.inventoryEqual,true);assert.equal(v.goldEqual,true);
 b.running=true;assert.equal(inspectMiningJournal(b).eligible,false);
 b.running=false;b.p.c.items[1]={name:'seashell',level:0};assert.equal(inspectMiningJournal(b).eligible,false);
 b.p.c.items[1]=null;b.p.c.gold++;assert.equal(inspectMiningJournal(b).eligible,false);
 b.p.c.gold--;b.journal.kind='send';assert.equal(inspectMiningJournal(b).eligible,false);
});
