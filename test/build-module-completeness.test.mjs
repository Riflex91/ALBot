import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
test('handwritten browser bundle includes imported TeamCheck dependency',()=>{
 const build=readFileSync(new URL('../scripts/build.mjs',import.meta.url),'utf8');
 const main=readFileSync(new URL('../src/main.mjs',import.meta.url),'utf8');
 assert.ok(main.includes("import {createTeamCheck,saveTeamCheck} from './core/team-check.mjs'"));
 assert.ok(build.includes("'src/core/team-check.mjs'"));
});