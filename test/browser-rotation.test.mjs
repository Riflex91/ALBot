import test from 'node:test';
import assert from 'node:assert/strict';
import {createPorts} from '../src/runtime/ports.mjs';

function fixture(){
 const calls=[];
 const parent={code_slot:'editor-other',explicit_slot:'active-bot',the_code:'/* running bot */',
  owned_character:name=>({name,online:false}),
  code_persistence_logic:()=>{calls.push('editor-save');return undefined;},
  socket:{disconnect:()=>calls.push('disconnect')},
  location:{href:'https://adventure.land/character/A/in/EU/II/?code=active-bot',assign:url=>calls.push(url)}};
 const root={parent,character:{name:'A'},get_active_code_slot:()=> 'active-bot',
  upload_code:async(...args)=>{calls.push(['upload',...args]);return {success:true};}};
 return {root,parent,calls,port:createPorts(root)};
}

test('separate browser tab rotates with running slot and source, not editor selection',async()=>{
 const {port,calls}=fixture();await port.switchCharacter('C');
 assert.deepEqual(calls[0],['upload','active-bot',undefined,'/* running bot */']);
 assert.equal(calls.includes('editor-save'),false);
 assert.equal(calls[1],'disconnect');
 const target=new URL(calls[2]);assert.equal(target.pathname,'/character/C/in/EU/II/');
 assert.equal(target.searchParams.get('code'),'active-bot');
});
test('explicit slots without a way to save running source fail before disconnect',async()=>{
 const {root,parent,calls}=fixture();delete root.upload_code;
 const port=createPorts(root);assert.equal(port.characterSwitchCapability('C').reason,'running-code-save-unavailable');
 await assert.rejects(port.switchCharacter('C'));assert.deepEqual(calls,[]);
});
test('undefined persistence result is not a successful save',async()=>{
 const {root,parent,calls}=fixture();delete root.upload_code;delete parent.explicit_slot;
 parent.code_slot='active-bot';const port=createPorts(root);
 await assert.rejects(port.switchCharacter('C'));assert.deepEqual(calls,['editor-save']);
});
test('failed running-source upload does not disconnect or navigate',async()=>{
 for(const result of [undefined,false,{failed:true},{success:false}]){
  const {root,calls}=fixture();root.upload_code=async()=>result;
  await assert.rejects(createPorts(root).switchCharacter('C'));assert.deepEqual(calls,[]);
 }
});
test('late upload cannot navigate after rotation is cancelled',async()=>{
 const {root,calls}=fixture();let resolve,allowed=true;
 root.upload_code=()=>new Promise(r=>{resolve=r;});
 const pending=createPorts(root).switchCharacter('C',()=>allowed);
 allowed=false;resolve({success:true});await assert.rejects(pending);assert.deepEqual(calls,[]);
});
test('wait for in-progress editor save and recheck authorization before upload',async()=>{
 const {root,parent,calls}=fixture();let resolve,allowed=true;
 parent.code_save_promise=new Promise(r=>{resolve=r;});
 const pending=createPorts(root).switchCharacter('C',()=>allowed);
 assert.deepEqual(calls,[]);allowed=false;resolve({success:true});
 await assert.rejects(pending);assert.deepEqual(calls,[]);
});
test('target becoming online while upload runs blocks disconnect',async()=>{
 const {root,parent,calls}=fixture();root.upload_code=async()=>{
  parent.owned_character=name=>({name,online:true});return {success:true};
 };
 await assert.rejects(createPorts(root).switchCharacter('C'));assert.deepEqual(calls,[]);
});
test('headless never uses browser upload or navigation',async()=>{
 const {root,parent,calls}=fixture();parent.headless={apiVersion:1};
 const port=createPorts(root);assert.equal(port.characterSwitchCapability('C').reason,'headless-host');
 await assert.rejects(port.switchCharacter('C'));assert.deepEqual(calls,[]);
});
