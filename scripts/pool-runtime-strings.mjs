import {parse} from 'acorn';
// Pool repeated string VALUES inside the existing runtime IIFE. Property
// keys, directives, templates, regexes and user configuration are untouched.
// The immutable table is local to that CODE instance, including hot reload.
export function poolRuntimeStrings(source){
 const ast=parse(source,{ecmaVersion:2022}),counts=new Map(),nodes=[];
 const expression=ast.body[0]?.expression,fn=expression?.callee;
 if(fn?.type!=='FunctionExpression'||fn.body?.body?.[0]?.directive!=='use strict')
  throw Error('String pooling requires the existing strict runtime IIFE');
 const pool='__ALBotRuntimeStrings';
 if(source.includes(pool))throw Error('Runtime string table identifier collision');
 function walk(node,parent=null){
  if(!node||typeof node!=='object')return;
  if(node.type==='Literal'&&typeof node.value==='string'&&
     !(parent?.type==='ExpressionStatement'&&parent.directive)&&
     !(parent?.key===node&&!parent.computed)){
   nodes.push(node);const row=counts.get(node.value)??{value:node.value,count:0,bytes:0};
   row.count++;row.bytes+=Buffer.byteLength(source.slice(node.start,node.end));
   counts.set(node.value,row);
  }
  for(const [key,value] of Object.entries(node)){
   if(['start','end','loc','raw'].includes(key))continue;
   if(Array.isArray(value))for(const child of value)walk(child,node);
   else if(value&&typeof value==='object')walk(value,node);
  }
 }
 walk(ast);
 const rows=[...counts.values()].filter(row=>row.count>=3&&
  row.bytes-Buffer.byteLength(JSON.stringify(row.value))-row.count*8>40)
  .sort((a,b)=>(b.bytes-b.count*8)-(a.bytes-a.count*8)||a.value.localeCompare(b.value))
  .slice(0,512);
 if(!rows.length)return source;
 const index=new Map(rows.map((row,i)=>[row.value,i]));
 const edits=nodes.filter(node=>index.has(node.value)).map(node=>({
  start:node.start,end:node.end,text:pool+'['+index.get(node.value)+']'
 }));
 const at=fn.body.body[0].end;
 edits.push({start:at,end:at,text:'const '+pool+'=Object.freeze('+
  JSON.stringify(rows.map(row=>row.value))+');'});
 edits.sort((a,b)=>b.start-a.start);
 let result=source;
 for(const edit of edits)result=result.slice(0,edit.start)+edit.text+result.slice(edit.end);
 return result;
}
