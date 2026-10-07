import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverableNonValueJournal} from '../src/core/checkpoint.mjs';

test('only a zero-value monsterhunt checkpoint is safe to recover automatically',()=>{
 assert.equal(recoverableNonValueJournal({kind:'quest.monsterhunt',quest:'monsterhunt',cost:0,loss:0,slots:[]}),true);
 assert.equal(recoverableNonValueJournal({kind:'quest.monsterhunt',cost:1,loss:0,slots:[]}),false);
 assert.equal(recoverableNonValueJournal({kind:'quest.monsterhunt',cost:0,loss:0,slots:[[0,'fp']]}),false);
 assert.equal(recoverableNonValueJournal({kind:'sell',cost:0,loss:0,slots:[]}),false);
 assert.equal(recoverableNonValueJournal(null),false);
});
