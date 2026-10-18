import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {compactRuntimeSchema} from '../scripts/compact-runtime-schema.mjs';
test('runtime schema keeps validation/defaults while dropping presentation labels only',()=>{
 const source='globalThis.schema={type:"object",title:"Workshop",description:"Long help",properties:{title:{type:"string",title:"Variant title",default:"shiny"}},required:["title"],additionalProperties:false};';
 const context=vm.createContext({});vm.runInContext(compactRuntimeSchema(source),context);
 assert.equal(context.schema.title,undefined);
 assert.equal(context.schema.properties.title.type,'string');
 assert.equal(context.schema.properties.title.default,'shiny');
 assert.deepEqual([...context.schema.required],['title']);
 assert.equal(context.schema.additionalProperties,false);
});
test('default values, non-schema item titles and comma edge cases retain semantics',()=>{
 const source='globalThis.schema={title:"first",type:"object",description:"last",default:{type:"string",title:"Real item title"},properties:{}};globalThis.item={type:"weapon",title:"lucky"};';
 const context=vm.createContext({});vm.runInContext(compactRuntimeSchema(source),context);
 assert.equal(context.schema.default.title,'Real item title');
 assert.equal(context.item.title,'lucky');
 assert.equal(context.schema.type,'object');
 assert.equal(context.schema.description,undefined);
});
