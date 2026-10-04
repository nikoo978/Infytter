import { supabase } from './supabase';
import { recipePayload } from './recipePolicy';
export async function getRecipeVisibility() {
  if (!supabase) return { enabled: false, error: new Error('Sin conexión con el recetario.') };
  const { data, error } = await supabase.from('gf_recipe_settings').select('enabled').eq('id', true).single();
  return { enabled: !error && data?.enabled === true, error };
}
export async function listRecipes() {
  if (!supabase) return { items: [], error: new Error('Sin conexión con el recetario.') };
  const items = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase.from('gf_recipes').select('*').order('title').order('id').range(from, from + 499);
    if (error) return { items: [], error };
    items.push(...(data || []));
    if (!data || data.length < 500) return { items, error: null };
  }
}
export async function saveRecipe(form, id = null) {
  try {
    const payload = recipePayload(form);
    if (!supabase) throw new Error('Sin conexión con el recetario.');
    const query = id ? supabase.from('gf_recipes').update(payload).eq('id', id) : supabase.from('gf_recipes').insert(payload);
    return await query.select().single();
  } catch (error) { return { error }; }
}
export async function setRecipeHidden(id, hidden) {
  return supabase.from('gf_recipes').update({ is_hidden: hidden }).eq('id', id).select().single();
}
export async function deleteRecipe(id) {
  return supabase.from('gf_recipes').delete().eq('id', id).select('id').single();
}
export async function setRecipeVisibility(enabled) {
  return supabase.from('gf_recipe_settings').update({ enabled }).eq('id', true).select().single();
}
