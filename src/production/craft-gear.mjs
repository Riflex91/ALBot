import {recipeGridIngredients} from './recipes.mjs';
// Discover real recipe outputs; allocation, compatibility, rules, budgets and
// the existing production executor still decide whether any action is allowed.
export function craftGearCandidates(G,cfg){
 if(!cfg?.craft||!cfg.autonomy||!cfg.acquireBy?.includes('craft'))return [];
 const result=[];
 for(const [alias,recipe] of Object.entries(G.craft??{})){
  const name=recipe?.output?.name??alias,meta=G.items?.[name];
  if(!meta||recipe?.output?.data!==undefined||!Number.isSafeInteger(recipe.cost??0)||(recipe.cost??0)<0)continue;
  if(!Number.isSafeInteger(recipe.q??recipe.quantity??1)||(recipe.q??recipe.quantity??1)<1)continue;
  try{if(recipeGridIngredients(recipe).some(r=>!G.items?.[r.item]))continue;}catch{continue;}
  if(!result.includes(name))result.push(name);
 }
 return result;
}
