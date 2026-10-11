import test from 'node:test';
import assert from 'node:assert/strict';
import {createPanel} from '../src/ui/panel.mjs';
class FakeNode{
 constructor(tag){this.tag=tag;this.style={};this.children=[];this.listeners=new Map();
  this.offsetWidth=220;this.offsetHeight=190;this.textContent='';this.disabled=false;}
 append(...items){this.children.push(...items);}
 addEventListener(type,fn){this.listeners.set(type,fn);}
 removeEventListener(type,fn){if(this.listeners.get(type)===fn)this.listeners.delete(type);}
 dispatch(type,data){this.listeners.get(type)?.({preventDefault(){},...data});}
 getBoundingClientRect(){return {left:parseFloat(this.style.left??'0')||0,top:parseFloat(this.style.top??'45')||45};}
 remove(){this.removed=true;}
}
function docFixture(saved=null){
 const listeners=new Map(),nodes=[],db=new Map();if(saved)db.set('albot:ui:position:Ranger',saved);
 const doc={documentElement:{clientWidth:650,clientHeight:480},
  createElement:tag=>new FakeNode(tag),addEventListener:(type,fn)=>listeners.set(type,fn),
  removeEventListener:(type,fn)=>{if(listeners.get(type)===fn)listeners.delete(type);},
  body:{append(node){nodes.push(node);}}};
 const bot={p:{headless:false,parent:{document:doc},read:k=>db.get(k),write:(k,v)=>{db.set(k,v);return true;}},
  cfg:{general:{ui:true,testLogging:false}},me:{name:'Ranger',role:'farmer'},running:true,reason:'Farm'};
 const api={start(){},pause(){},stop(){},exportTestReport(){}};
 return {bot,api,db,listeners,nodes};
}
test('Bot panel title handle drags, persists, and reloads at same position',()=>{
 const f=docFixture(),panel=createPanel(f.bot,f.api);
 assert.equal(f.nodes.length,1);const node=f.nodes[0],title=node.children[0];
 title.dispatch('pointerdown',{button:0,pointerId:7,clientX:200,clientY:100});
 f.listeners.get('pointermove')({pointerId:7,clientX:310,clientY:210,preventDefault(){}});
 f.listeners.get('pointerup')({pointerId:7});
 assert.equal(node.style.left,'110px');
 assert.equal(node.style.top,'155px');
 assert.deepEqual(f.db.get('albot:ui:position:Ranger'),{x:110,y:155});
 panel.remove();assert.equal(f.listeners.size,0);
 const again=createPanel(f.bot,f.api);
 assert.equal(f.nodes.at(-1).style.left,'110px');
 again.remove();
});
test('Bot panel drag cannot be started from a button and saved off-screen coordinates are clamped',()=>{
 const f=docFixture({x:9999,y:-600}),panel=createPanel(f.bot,f.api),node=f.nodes[0];
 assert.equal(node.style.left,'430px');
 assert.equal(node.style.top,'0px');
 const button=node.children.find(c=>c.tag==='button');
 assert.equal(button.listeners.has('pointerdown'),false);
 panel.remove();
});
