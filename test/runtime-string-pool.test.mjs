import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {poolRuntimeStrings} from '../scripts/pool-runtime-strings.mjs';
test('pooled values preserve directives, literal keys, escapes, getters and template semantics',()=>{
 const value='Repeated sufficiently long text with German ü and quotes "';
 const literal=JSON.stringify(value);
 const source='(function(){"use strict"; const x={'+literal+':'+literal+'};'+
  'const rows=Array(20).fill(null).map(()=>['+Array(20).fill(literal).join(',')+']);'+
  'return JSON.stringify({rows,x,strict:(function(){return this===undefined;})()});})()';
 const pooled=poolRuntimeStrings(source);
 assert.equal(vm.runInNewContext(pooled),vm.runInNewContext(source));
 assert.ok(pooled.includes('__ALBotRuntimeStrings'));
 assert.ok(pooled.includes('const x={'+literal+':'));
});
test('string table is scoped to each reload instead of creating a global singleton',()=>{
 const body=Array(60).fill("'repeated long runtime explanation'").join(',');
 const source='(function(){"use strict";return ['+body+'];})()';
 const transformed=poolRuntimeStrings(source),context=vm.createContext({});
 vm.runInContext(transformed,context);vm.runInContext(transformed,context);
 assert.equal(context.__ALBotRuntimeStrings,undefined);
 assert.equal(vm.runInContext(transformed,context).length,60);
});
test('pooling refuses an unexpected wrapper rather than hoisting data into user scope',()=>{
 assert.throws(()=>poolRuntimeStrings('globalThis.foo="text";'),/runtime IIFE/);
});
