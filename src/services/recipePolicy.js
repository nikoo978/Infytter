export const RECIPE_CATEGORIES = ['Desayunos', 'Platos principales', 'Snacks y meriendas', 'Otros'];
export const recipeSearch = (value = '') => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
export function matchesRecipe(recipe, query) {
  const haystack = recipeSearch([recipe.title, recipe.category, ...(recipe.ingredients || [])].join(' '));
  return recipeSearch(query).split(/\s+/).every((term) => haystack.includes(term));
}
export function safeRecipeImage(value = '') {
  const text = String(value).trim();
  if (/^\/images\/recipes\/[a-zA-Z0-9_-]+\.webp$/.test(text)) return text;
  try { const url = new URL(text); return url.protocol === 'https:' && !url.username && !url.password ? url.href : ''; } catch { return ''; }
}
export function recipePayload(form) {
  const title = String(form.title || '').trim();
  const category = String(form.category || '').trim();
  const ingredients = String(form.ingredients || '').split('\n').map((s) => s.trim()).filter(Boolean);
  const steps = String(form.steps || '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (!title || title.length > 200) throw new Error('Escribí un nombre de hasta 200 caracteres.');
  if (!category || category.length > 80) throw new Error('Elegí una categoría.');
  if (!ingredients.length || !steps.length || ingredients.length > 200 || steps.length > 200) throw new Error('Agregá ingredientes y pasos, uno por línea (hasta 200).');
  const image_url = safeRecipeImage(form.image_url);
  if (form.image_url?.trim() && !image_url) throw new Error('La imagen debe ser una URL HTTPS o una foto del recetario.');
  const source = String(form.source || '').trim();
  if (source.length > 300 || image_url.length > 2000) throw new Error('La referencia o la URL de imagen es demasiado larga.');
  const result = { title, category, ingredients, steps, image_url, source, is_hidden: form.is_hidden === true };
  for (const key of ['minutes', 'protein_g', 'carbs_g', 'fat_g']) {
    const raw = form[key];
    const n = raw == null || raw === '' ? null : Number(raw);
    if (n !== null && (!Number.isFinite(n) || n < 0 || n > (key === 'minutes' ? 1440 : 10000) || (key === 'minutes' && !Number.isInteger(n)))) throw new Error('Revisá los tiempos y valores nutricionales: deben ser positivos y válidos.');
    result[key] = n;
  }
  return result;
}
