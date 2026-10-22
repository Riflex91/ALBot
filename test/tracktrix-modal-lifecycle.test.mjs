import test from 'node:test';
import assert from 'node:assert/strict';
import {createPorts,snapshotTrackerModal,closeRequestedTrackerModal} from '../src/runtime/ports.mjs';
import {createAchievementScores} from '../src/world/achievement-scores.mjs';

function fixture(){
 const stack=[],listeners=[],emissions=[];
 const other={querySelector:()=>null},
  tracktrix={querySelector:selector=>
   ['.trackers.trackerm','.trackers.trackere'].includes(selector)?{}:null};
 const parent={modal_count:0,
  document:{querySelectorAll:selector=>{
   assert.equal(selector,'.modal');return [...stack];
  }},
  hide_modal(){if(!this.modal_count)throw Error('No modal');
   stack.pop();this.modal_count--;} };
 const append=node=>{stack.push(node);parent.modal_count++;};
 const socket={
  on(name,fn){assert.equal(name,'tracker');listeners.push(fn);},
  off(name,fn){assert.equal(name,'tracker');const i=listeners.indexOf(fn);
   if(i>=0)listeners.splice(i,1);},
  emit(name){assert.equal(name,'tracker');emissions.push(name);
   // The official game socket handler is attached before the bot handler:
   // it renders Tracktrix immediately, then registered observers run.
   // Each official render creates a distinct DOM node even if its content matches.
   append({...tracktrix});
   for(const fn of [...listeners])fn({max:{monsters:{goo:[9,20]}}});
  }
 };
 parent.socket=socket;
 const root={parent,character:{name:'Ranger',items:[{name:'tracker'}]},
  G:{monsters:{goo:{achievements:[[10,'stat','hp',1]]}}}};
 const p=createPorts(root);
 const bot={running:true,p};
 const scores=createAchievementScores(bot,()=>1000000);
 return {stack,other,tracktrix,parent,append,root,bot,p,scores,socket,emissions};
}

test('official browser tracker event is observed and only its own modal closes',()=>{
 const f=fixture();
 assert.equal(f.p.headless,false);
 assert.equal(f.scores.poll(),true);
 assert.deepEqual(f.emissions,['tracker']);
 assert.equal(f.parent.modal_count,0);
 assert.equal(f.stack.length,0);
 assert.equal(f.scores.status().observedMonsters,1);
 assert.equal(f.scores.status().closestMilestones[0].monster,'goo');
 f.scores.close();
});

test('pre-existing guide dialog remains open after bot-owned tracker query',()=>{
 const f=fixture();f.append(f.other);
 assert.equal(f.scores.poll(),true);
 assert.equal(f.parent.modal_count,1);
 assert.equal(f.stack[0],f.other);
 f.scores.close();
});

test('pre-existing manually opened Tracktrix dialog remains available',()=>{
 const f=fixture();f.append(f.tracktrix);
 assert.equal(f.scores.poll(),true);
 assert.equal(f.parent.modal_count,1);
 assert.equal(f.stack[0],f.tracktrix);
 f.scores.close();
});

test('a manual tracker reply without a pending bot request is never closed',()=>{
 const f=fixture();
 assert.equal(f.socket.emit('tracker'),undefined);
 assert.equal(f.parent.modal_count,1);
 assert.ok(f.stack[0]?.querySelector('.trackers.trackerm'));
 f.scores.close();
});

test('unrelated modal cannot be dismissed by a forged tracker close request',()=>{
 const f=fixture(),before=snapshotTrackerModal(f.parent);
 f.append(f.other);
 assert.equal(closeRequestedTrackerModal(f.parent,before),false);
 assert.equal(f.parent.modal_count,1);
});

test('modal count or original top changes revoke UI close permission',()=>{
 const f=fixture();f.append(f.other);
 const before=snapshotTrackerModal(f.parent);
 f.stack[0]={querySelector:()=>null};
 f.append(f.tracktrix);
 assert.equal(closeRequestedTrackerModal(f.parent,before),false);
 assert.equal(f.parent.modal_count,2);
 const second=fixture();const snap=snapshotTrackerModal(second.parent);
 second.append(second.tracktrix);second.append(second.other);
 assert.equal(closeRequestedTrackerModal(second.parent,snap),false);
 assert.equal(second.parent.modal_count,2);
});

test('browser with no safe official hide API does not issue tracker query',()=>{
 const f=fixture();delete f.parent.hide_modal;
 assert.equal(f.scores.poll(),false);
 assert.deepEqual(f.emissions,[]);
 assert.equal(f.scores.status().state,'tracker-modal-close-unavailable');
 f.scores.close();
});

test('headless polling remains allowed without browser modal API',()=>{
 const f=fixture();f.root.parent.headless={apiVersion:1};
 const p=createPorts(f.root),bot={running:true,p};
 const s=createAchievementScores(bot,()=>1000000);
 assert.equal(p.headless,true);
 assert.equal(s.poll(),true);
 assert.equal(s.status().observedMonsters,1);
 s.close();f.scores.close();
});
