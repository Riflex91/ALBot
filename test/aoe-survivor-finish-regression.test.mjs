import test from 'node:test';
import assert from 'node:assert/strict';
import {createFarmer} from '../src/combat/farmer.mjs';

function scenario({hp=61,target='My_Ranger2',viable=true,
 role='ranger',position=0,plan=null}={}){
 const calls=[];
 const own=role==='warrior'?'My_Warrior':'My_Ranger1';
 const c={name:own,ctype:role,range:125,attack:402,
  map:'main',in:'main',x:position,y:0,hp:4000,max_hp:4000,
  mp:900,max_mp:1200,rip:false,items:[],slots:{mainhand:{name:'bow'}}};
 const mob={id:'265567',type:'monster',mtype:'crab',hp,max_hp:400,
  target,map:'main',in:'main',x:position+80,y:0};
 const peers={My_Ranger2:{name:'My_Ranger2',hp:4500,max_hp:4900,
  map:'main',in:'main',x:position+15,y:0,running:true,realm:'EUII',received:Date.now()},
  My_Warrior:{name:'My_Warrior',hp:3700,max_hp:4000,
   map:'main',in:'main',x:position+25,y:0,running:true,realm:'EUII',received:Date.now()}};
 const cfg={farming:{enabled:true,kiting:false,potions:false,rangeBuffer:10,
  hpBelow:.4,mpBelow:.2,restBelow:.3,resumeAbove:.8,pullHp:.8,pullMp:.5},
  party:{enabled:true,healing:false,followDistance:150},world:{}};
 const bot={me:{name:own,role:'farmer'},leader:'My_Warrior',
  farmers:['My_Ranger1','My_Ranger2','My_Warrior'],
  teamNames:['My_Ranger1','My_Ranger2','My_Warrior'],
  cfg,running:true,reason:'Farm',target:null,
  p:{c,parent:{},G:{maps:{main:{}},monsters:{crab:{aggro:0,attack:10,frequency:1,range:20}}},
   realm:()=> 'EUII',call:(key,...args)=>{
    if(key==='can_attack')return true;
    if(key==='is_on_cooldown')return false;
    if(key==='can_move_to')return true;
    if(key==='attack'){calls.push(['attack',args[0]?.id]);return true;}
    return true;
   }},
  monsters:()=>[mob],entity:id=>id===mob.id?mob:null,free:()=>30,
  allowed:e=>e?.hp>0&&bot.teamNames.includes(e.target),
  logistics:{handoffActive:false},gold:{reserved:false},journal:null,
  movement:{order:null,stop(){this.order=null;},go(dest,owner){calls.push(['move',owner]);this.order={owner,dest};return true;}},
  transport:{fresh:n=>peers[n]??null},
  teamPlan:{heartbeat:()=>plan},
  strategy:{travel:()=>true,safeTarget:()=>true},
  combatAssessment:{emergency:()=>({active:false,monsters:[],critical:[]}),
   assess:()=>({viable,reason:viable?'bounded-team-capacity':'insufficient-time-to-kill'}),
   canDefend:()=>viable},
  skills:{rotation:e=>calls.push(['rotation',e?.id??null])},
  exec:{run:(key,_res,guard,invoke)=>{
    if(!guard())return false;
    calls.push(['action',key]);invoke();return true;
   }},
  event:()=>{}
 };
 return {bot,mob,calls,tick:()=>createFarmer(bot).tick()};
}

test('a 61/400 HP engaged AoE survivor receives a basic attack, even without natural-aggro emergency',()=>{
 const {bot,calls,tick}=scenario();tick();
 assert.equal(bot.target?.id,'265567');
 assert.ok(calls.some(c=>c[0]==='attack'&&c[1]==='265567'),JSON.stringify(calls));
 assert.equal(bot.reason,'Teamverteidigung: crab');
});

test('finisher never starts a neutral/foreign pull or an unsafe team fight',()=>{
 for(const options of [{target:null},{target:'Outside'},{viable:false}]){
  const {calls,tick}=scenario(options);tick();
  assert.equal(calls.some(c=>c[0]==='attack'),false,JSON.stringify(options));
 }
});

test('warrior defends a weak already-engaged survivor at the farm arrival boundary, but not on the road',()=>{
 const plan={map:'main',in:'main',x:0,y:0,radius:65,target:'crab'};
 const nearby=scenario({role:'warrior',position:89,plan});nearby.tick();
 assert.ok(nearby.calls.some(c=>c[0]==='attack'));
 const distant=scenario({role:'warrior',position:150,plan});distant.tick();
 assert.equal(distant.calls.some(c=>c[0]==='attack'),false);
 assert.match(distant.bot.reason,/Weg-Aggro/);
});
