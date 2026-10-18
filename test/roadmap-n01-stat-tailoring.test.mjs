import test from 'node:test';
import assert from 'node:assert/strict';
import {statTailoringCandidate,createStatTailoring} from '../src/production/stat-tailoring.mjs';

function fixture(){
 const now=Date.now(),calls=[],scheduled=[];
 const target={name:'Priest mainhand STR',enabled:true,character:'P',
  slot:'mainhand',item:'staff',level:0,statType:'str',budget:5000,priority:100};
 const G={version:1,items:{
  staff:{type:'weapon',wtype:'staff',upgrade:true,stat:true},
  strscroll:{type:'pscroll',stat:'str',grade:1,g:100}
 },classes:{priest:{mainhand:{staff:1}}}};
 const items=[{name:'staff',level:0},{name:'strscroll',q:20},null];
 const profile={complete:true,class:'priest',level:50,realm:'EUI',at:now,
  slots:{mainhand:null,offhand:null}};
 const cfg={characters:[{name:'P',class:'priest',enabled:true,role:'farmer'}],
  production:{enabled:true,gear:true,gearTargets:[target],
   minChance:.65},items:[],merchant:{budgetMode:'bounded'}};
 let mutationOptions=null,previewResponse={calculate:true,chance:.99999,
  scroll:'strscroll',item:{name:'staff',level:0}};
 const bot={running:true,me:{name:'M',role:'merchant'},cfg,session:'M-session',
  p:{c:{items,isize:3,gold:10000,q:{},rip:false,map:'main'},G,
   realm:()=> 'EUI',
   call:(name,...args)=>{
    calls.push([name,...args]);
    if(name==='item_grade')return 1;
    if(name==='upgrade'){
     if(args[3]===true)return Promise.resolve(previewResponse);
     items[0]={...items[0],stat_type:'str'};
     items[1]={...items[1],q:10};
     return Promise.resolve({success:true});
    }
    throw Error('unexpected API '+name);
   }},
  gear:{profile:()=>profile},
  bank:{pending:false},logistics:{reserved:false},
  production:{reservedQuantity:()=>0},
  exec:{busy:()=>false,run:(kind,locks,guard,call)=>{
   scheduled.push({kind,locks,guard});void call();return true;}},
  economy:{
   safe:x=>!!x&&!x.l&&!x.b,
   explicit:()=>null,rules:()=>({keep:0,teamReserve:0}),
   count:i=>items.reduce((sum,x)=>sum+(x?.name===i.name?(x.q??1):0),0),
   value:i=>i.name==='staff'?1000:100,
   destination:()=>({map:'main',x:0,y:0}),
   npcTravel:()=>true,npcAt:()=>true,
   perform:(kind,opts)=>{mutationOptions={kind,...opts};return true;}
  }};
 const tailoring=createStatTailoring(bot);
 return {bot,cfg,G,items,target,profile,calls,scheduled,tailoring,
  quote:r=>{previewResponse=r;},
  get mutation(){return mutationOptions;}};
}
test('N01 grade 1 stat mutation requires ten grade-qualified pscrolls for exact gear target',()=>{
 const f=fixture(),r=statTailoringCandidate(f.bot);
 assert.equal(r?.needed,10);
 assert.equal(r?.scrollSlot,1);
 assert.equal(r?.loss,2000);
 assert.equal(r?.target,f.target);
 f.items[1].q=9;assert.equal(statTailoringCandidate(f.bot),null);
 f.items[1].q=20;f.G.items.strscroll.grade=0;
 assert.equal(statTailoringCandidate(f.bot),null);
});
test('N01 always opt-in, protects existing stat and locks, refuses stale/other realm or fulfilled target',()=>{
 const f=fixture();
 f.cfg.production.gear=false;
 assert.equal(statTailoringCandidate(f.bot),null);
 f.cfg.production.gear=true;
 f.items[0].stat_type='dex';assert.equal(statTailoringCandidate(f.bot),null);
 delete f.items[0].stat_type;f.items[0].l=true;
 assert.equal(statTailoringCandidate(f.bot),null);
 delete f.items[0].l;
 f.profile.at=Date.now()-70000;
 assert.equal(statTailoringCandidate(f.bot),null);
 f.profile.at=Date.now();f.profile.realm='USI';
 assert.equal(statTailoringCandidate(f.bot),null);
 f.profile.realm='EUI';f.profile.slots.mainhand={name:'staff',level:0,stat_type:'str'};
 assert.equal(statTailoringCandidate(f.bot),null);
});
test('N01 server calculate proof is mandatory and cannot be replaced by a made-up chance',async()=>{
 const f=fixture(),t=f.tailoring;
 assert.equal(t.tick(),true);
 assert.equal(f.scheduled[0].kind,'production.stat-preview');
 await Promise.resolve();await Promise.resolve();
 assert.equal(t.tick(),true);
 assert.equal(f.mutation?.kind,'upgrade');
 assert.equal(f.mutation?.loss,2000);
 assert.equal(f.mutation?.guard(),true);
 assert.equal(f.calls.filter(r=>r[0]==='upgrade').length,1,
  'only read-only calculate preview was dispatched');
 f.target.budget=1999;
 assert.equal(f.mutation.guard(),false,'late budget change cancels execution');
});
test('N01 confirmed stat effect requires the exact item and consumed scroll quantity',async()=>{
 const f=fixture();const t=f.tailoring;
 t.tick();await Promise.resolve();await Promise.resolve();t.tick();
 assert.equal(f.mutation.guard(),true);
 assert.equal(f.mutation.observe(),false);
 await f.mutation.call();
 assert.equal(f.mutation.observe(),true);
 assert.equal(f.mutation.onConfirmed(),true);
 assert.equal(statTailoringCandidate(f.bot),null);
 assert.equal(f.calls.filter(r=>r[0]==='upgrade'&&r[4]!==true).length,1);
});
test('N01 wrong server preview or stale stock cannot execute a stat mutation',async()=>{
 const f=fixture();f.quote({calculate:false,chance:1,scroll:'strscroll',
  item:{name:'staff',level:0}});
 f.tailoring.tick();await Promise.resolve();await Promise.resolve();
 assert.equal(f.tailoring.tick(),false);
 assert.equal(f.mutation,null);
 f.quote({calculate:true,chance:.99999,scroll:'strscroll',
  item:{name:'staff',level:0}});
 f.items[1].q=19;
 assert.equal(f.scheduled[0].guard(),false,'any scroll fingerprint drift invalidates the queued preview');
});
test('N01 no additional pscroll purchase, no automatic destat, no anonymous stat assignment',()=>{
 const f=fixture();f.target.statType='';
 assert.equal(statTailoringCandidate(f.bot),null);
 f.target.statType='str';f.cfg.production.gearTargets=[];
 assert.equal(statTailoringCandidate(f.bot),null);
 assert.equal(f.calls.filter(c=>['buy','destat'].includes(c[0])).length,0);
});
