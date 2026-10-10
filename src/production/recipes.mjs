export function findRecipe(G,item,alias=''){
 const entries=alias?[[alias,G.craft?.[alias]]]:Object.entries(G.craft??{});
 for(const [key,recipe] of entries)if(recipe&&(recipe.output?.name??key)===item)return {key,recipe};return null;
}
// The game's craft(i0,...,i8) API takes ONE inventory slot per recipe
// position. Keep that positional representation distinct from the aggregated
// material demand used by the production planner.
function parsedRecipeRows(recipe){
 if(!Array.isArray(recipe?.items)||recipe.items.length<1)throw Error('Ungültige Rezeptzutaten');
 return recipe.items.map(row=>{
  if(!Array.isArray(row)||!Number.isSafeInteger(row[0])||row[0]<1||
     typeof row[1]!=='string'||!row[1]||!Number.isSafeInteger(row[2]??0)||(row[2]??0)<0)
   throw Error('Ungültige Rezeptzutat');
  return {quantity:row[0],item:row[1],level:row[2]??0};
 });
}
export function recipeGridIngredients(recipe){
 const rows=parsedRecipeRows(recipe);
 if(rows.length>9)throw Error('Ungültiges Rezeptgitter (maximal 9 Positionen)');
 return rows;
}
export function recipeIngredients(recipe){
 const result=[];
 // Resource planning is allowed to inspect overwide *hypothetical* recipes
 // so its existing dependency and 256-node bounds can reject them. Only the
 // actual craft(i0,...,i8) dispatch is limited to nine grid positions.
 for(const row of parsedRecipeRows(recipe)){
  // Equal item names at different upgrade levels are distinct ingredients
  // in G.craft and in the official positional crafting grid.
  const previous=result.find(x=>x.item===row.item&&x.level===row.level);
  if(previous){
   if(!Number.isSafeInteger(previous.quantity+row.quantity))throw Error('Rezeptmenge überschreitet sichere Ganzzahl');
   previous.quantity+=row.quantity;
  }else result.push({...row});
 }
 return result;
}

// Find a one-to-one inventory assignment for positional craft recipes.
// A first-fit scan can reserve the only large stack for a small ingredient
// and reject an otherwise valid craft. Augmenting paths find a complete
// matching without changing the canonical recipe argument order.
export function matchRecipeSlots(candidates){
 if(!Array.isArray(candidates)||candidates.length<1||candidates.length>9||
    candidates.some(row=>!Array.isArray(row)||row.length===0))return null;
 const slotOwner=new Map();
 function claim(row,seen){
  for(const slot of candidates[row]){
   if(!Number.isSafeInteger(slot)||slot<0||seen.has(slot))continue;
   seen.add(slot);
   const previous=slotOwner.get(slot);
   if(previous===undefined||claim(previous,seen)){slotOwner.set(slot,row);return true;}
  }
  return false;
 }
 // Tackle the most restricted recipe positions first, while keeping the
 // returned vector indexed by the original official craft grid positions.
 const order=candidates.map((_,i)=>i).sort((a,b)=>candidates[a].length-candidates[b].length||a-b);
 for(const row of order)if(!claim(row,new Set()))return null;
 const result=Array(candidates.length);
 for(const [slot,row] of slotOwner)result[row]=slot;
 return result;
}
