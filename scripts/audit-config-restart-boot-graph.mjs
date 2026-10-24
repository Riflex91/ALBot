// Structural audit of the REAL controller startup path, not the synthetic
// recovery sandbox. Node-only: this file must never enter the game bundle.
// This is a fail-closed audit of missing proof, NOT evidence that any real
// controller can be atomically reconstructed or reverted.
import {parse} from 'acorn';
import {readFile} from 'node:fs/promises';

export const RESTART_BOOT_BLOCKERS=Object.freeze([
 'real-controller-factory-rebuild-not-verified',
 'event-hook-and-port-wrapper-rollback-not-verified',
 'timer-executor-and-closure-reset-not-verified',
 'durable-account-applied-rollback-anchor-missing',
 'authenticated-character-acks-unavailable'
]);
const member=(node,obj,prop)=>node?.type==='MemberExpression'&&
 !node.computed&&node.object?.type==='Identifier'&&
 node.object.name===obj&&node.property?.name===prop;
function walk(node,callback){
 if(!node||typeof node!=='object')return;
 if(Array.isArray(node)){for(const value of node)walk(value,callback);return;}
 if(typeof node.type!=='string')return;
 callback(node);
 for(const [key,value] of Object.entries(node)){
  if(['start','end','loc','range'].includes(key))continue;
  if(value&&typeof value==='object')walk(value,callback);
 }
}
export function auditRealRuntimeBootGraph(source){
 if(typeof source!=='string'||source.length<1000)
  throw Error('Real boot graph source unavailable');
 const ast=parse(source,{ecmaVersion:'latest',sourceType:'module'});
 const botStart=source.indexOf('const bot={');
 const tickStart=source.indexOf('function tick(',botStart);
 if(botStart<0||tickStart<botStart)
  throw Error('Real bot construction/tick boundary missing');
 const factoryNames=new Map(),sideEffects=new Set(),captured=new Set();
 let executorConstructed=false,cleanupPresent=false,haltPresent=false;
 walk(ast,node=>{
  if(node.start<botStart||node.end>tickStart)return;
  if(node.type==='AssignmentExpression'&&
   node.left?.type==='MemberExpression'&&!node.left.computed&&
   node.left.object?.name==='bot'&&
   node.right?.type==='CallExpression'&&
   /^create[A-Z]/.test(node.right.callee?.name??'')){
   const key=node.left.property.name;
   if(factoryNames.has(key)&&factoryNames.get(key)!==node.right.callee.name)
    throw Error('Ambiguous boot factory '+key);
   factoryNames.set(key,node.right.callee.name);
  }
  if(node.type==='NewExpression'&&node.callee?.name==='Executor')
   executorConstructed=true;
  if(node.type==='FunctionDeclaration'&&node.id?.name==='halt')
   haltPresent=true;
  if(node.type==='CallExpression'){
   if(member(node.callee,'p','hook'))sideEffects.add('game-port-hooks');
   if(member(node.callee,'game','on'))sideEffects.add('game-event-listeners');
   if(member(node.callee,'root','addEventListener'))
    sideEffects.add('window-global-events');
   if(member(node.callee,'p','watchChestOpened')||
    member(node.callee,'p','watchOwnTradeSwaps'))
    sideEffects.add('persistent-item-watchers');
   if(member(node.callee,'cleanup','push'))cleanupPresent=true;
  }
  if(node.type==='AssignmentExpression'&&member(node.left,'p','call'))
   sideEffects.add('wrapped-game-port-call');
  if(node.type==='MemberExpression'&&!node.computed&&
   node.object?.name==='cfg')captured.add(node.property.name);
 });
 const factories=[...factoryNames.entries()].map(([slot,factory])=>({slot,factory}))
  .sort((a,b)=>a.slot.localeCompare(b.slot));
 const hazards=[...sideEffects].sort();
 const missing=[];
 if(factories.length<75)missing.push('real-boot-factory-count-dropped');
 if(!['farmer','merchant','transport','bank','movement','logistics',
   'account','teamTravel','recovery'].every(x=>factoryNames.has(x)))
  missing.push('required-live-factory-missing');
 for(const name of ['game-port-hooks','game-event-listeners',
  'window-global-events','wrapped-game-port-call','persistent-item-watchers'])
  if(!sideEffects.has(name))missing.push('real-event-port-evidence-missing:'+name);
 if(!executorConstructed)missing.push('real-executor-construction-missing');
 if(!cleanupPresent||!haltPresent)missing.push('real-lifecycle-stop-evidence-missing');
 if(captured.size<5)missing.push('startup-closure-capture-evidence-missing');
 if(missing.length)throw Error('Real controller graph audit incomplete: '+missing.join(','));
 return {
  format:'albot-real-runtime-boot-graph-audit/v1',
  factoryCount:factories.length,controllerFactories:factories,
  registeredSideEffectKinds:hazards,
  startupCapturedConfigSections:[...captured].sort(),
  executorConstructed,shutdownHandlerObserved:haltPresent,
  cleanupRegistrationsObserved:cleanupPresent,
  bootGraphObserved:true,liveControllerRebuildCovered:false,
  actualRollbackCertified:false,readyForActivation:false,
  restartAuthorized:false,transactionCommitted:false,
  applied:false,acknowledged:false,
  blockers:[...RESTART_BOOT_BLOCKERS]
 };
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{
  const src=await readFile(new URL('../src/main.mjs',import.meta.url),'utf8');
  const r=auditRealRuntimeBootGraph(src);
  process.stdout.write(JSON.stringify({format:r.format,
   factoryCount:r.factoryCount,
   sideEffectKinds:r.registeredSideEffectKinds,
   capturedSectionCount:r.startupCapturedConfigSections.length,
   readyForActivation:false,blockers:r.blockers})+'\n');
 }catch(e){
  process.stderr.write('ALBot real boot graph audit failed: '+e.message+'\n');
  process.exitCode=1;
 }
}
