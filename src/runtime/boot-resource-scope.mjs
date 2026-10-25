// Owns actual runtime startup resources in acquisition order and releases
// them in reverse, even when one cleanup throws. Does NOT rebuild the entire
// game runtime, implement an applied-profile transaction, or certify rollback.
export const createBootResourceScope=(()=>{
 const validName=x=>typeof x==='string'&&/^[a-z0-9][a-z0-9.-]{0,63}$/.test(x);
 function createBootResourceScope(){
  const owned=[],history=[];
  let closed=false,closing=false,failures=0;
  function add(name,release){
   if(closed||closing)throw Error('Boot resource scope closed');
   if(!validName(name)||typeof release!=='function')
    throw Error('Boot resource must have a named release function');
   if(owned.length>=128)throw Error('Boot resource scope capacity exceeded');
   owned.push({name,release});return true;
  }
  function acquire(name,factory,{release}={}){
   if(closed||closing)throw Error('Boot resource scope closed');
   if(!validName(name)||typeof factory!=='function')
    throw Error('Boot resource factory unavailable');
   const value=factory();
   const cleanup=typeof release==='function'?()=>release(value):
    typeof value?.close==='function'?()=>value.close():
    typeof value?.dispose==='function'?()=>value.dispose():null;
   if(!cleanup)throw Error('Boot resource lacks explicit cleanup');
   try{add(name,cleanup);}
   catch(e){try{cleanup();}catch{}throw e;}
   return value;
  }
  // A registration that creates a browser hook must return its disposer.
  // Register it immediately and undo it if scope ownership cannot be taken.
  function attach(name,subscribe){
   if(closed||closing)throw Error('Boot resource scope closed');
   if(!validName(name)||typeof subscribe!=='function')
    throw Error('Boot resource subscription unavailable');
   const stop=subscribe();
   if(typeof stop!=='function')
    throw Error('Boot resource subscription lacks cleanup');
   try{add(name,stop);}
   catch(error){try{stop();}catch{failures++;}throw error;}
   return stop;
  }
  // A throw while registering real side effects rolls back EVERY resource
  // already owned by this boot scope. This does not undo unowned controllers.
  function initialize(register){
   if(closed||closing||typeof register!=='function')
    throw Error('Boot initialization unavailable');
   try{
    const result=register();
    if(result&&typeof result.then==='function')
     throw Error('Asynchronous boot registration is unsupported');
    return result;
   }catch(error){
    const rollback=close();
    const aborted=new Error('Boot resource initialization aborted', {cause:error});
    aborted.rollbackComplete=rollback.closed;
    aborted.cleanupFailures=rollback.failures;
    throw aborted;
   }
  }
  function close(){
   if(closing)return {closed:false,reason:'release-reentrancy',
    pending:owned.length,failures};
   if(closed)return {closed:failures===0,
    reason:failures?'cleanup-failed':null,pending:0,failures};
   closing=true;closed=true;
   while(owned.length){
    const {name,release}=owned.pop();
    try{release();history.push({name,ok:true});}
    catch{failures++;history.push({name,ok:false});}
   }
   closing=false;
   return {closed:failures===0,reason:failures?'cleanup-failed':null,
    pending:0,failures};
  }
  return {add,acquire,attach,initialize,close,status:()=>({
   mode:'owned-runtime-resources',closed,closing,active:owned.length,
   cleanupFailures:failures,releaseOrder:history.map(x=>x.name),
   safeToReconstruct:false,actualRollbackCertified:false,
   transactionCommitted:false,applied:false,acknowledged:false
  })};
 }
 return createBootResourceScope;
})();
