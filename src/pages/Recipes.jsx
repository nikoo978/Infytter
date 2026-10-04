import CollapsibleSection from "../components/ui/CollapsibleSection";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChefHat, Clock3, Eye, EyeOff, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import FormDialog from '../components/ui/FormDialog';
import { deleteRecipe, getRecipeVisibility, listRecipes, saveRecipe, setRecipeHidden, setRecipeVisibility } from '../services/recipes';
import { matchesRecipe, RECIPE_CATEGORIES, safeRecipeImage } from '../services/recipePolicy';

const fieldClass = 'w-full min-h-11 rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900';
const emptyForm = { title: '', category: 'Desayunos', image_url: '', ingredients: '', steps: '', source: '', minutes: '', protein_g: '', carbs_g: '', fat_g: '', is_hidden: false };
function Photo({ recipe, large = false }) {
  const [failed, setFailed] = useState(false);
  const src = safeRecipeImage(recipe.image_url);
  useEffect(() => setFailed(false), [src]);
  return src && !failed ? <img loading="lazy" src={src} alt={recipe.title} onError={() => setFailed(true)} className={`w-full object-cover ${large ? 'max-h-72 rounded-2xl' : 'h-40 sm:h-44'}`} /> : <div className={`grid place-items-center bg-red-50 text-[#E30613] ${large ? 'h-48 rounded-2xl' : 'h-40 sm:h-44'}`}><ChefHat className="size-12" /></div>;
}
function Macros({ recipe }) {
  const values = [['Proteína', recipe.protein_g], ['Carbohidratos', recipe.carbs_g], ['Grasas', recipe.fat_g]];
  return <div className="grid grid-cols-3 gap-2">{values.map(([name, value]) => <div key={name} className="min-w-0 rounded-xl bg-slate-50 p-2 text-center"><p className="text-[10px] font-bold text-slate-500">{name}</p><p className="mt-1 text-sm font-black">{value == null ? '—' : `${Number(value).toLocaleString('es-AR')} g`}</p></div>)}</div>;
}
export default function Recipes({ onBack = null }) {
  const { role, user } = useAuth();
  const admin = role === 'admin';
  const [items, setItems] = useState([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Todas');
  const [visibility, setVisibility] = useState('Todas');
  const [quick, setQuick] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [editor, setEditor] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [notice, setNotice] = useState('');
  const selected = items.find((r) => r.id === selectedId);
  const load = useCallback(async () => {
    const [settings, recipes] = await Promise.all([getRecipeVisibility(), listRecipes()]);
    if (settings.error || recipes.error) { setItems([]); setEnabled(false); setError('No se pudo cargar el recetario. Revisá tu conexión y volvé a intentar.'); }
    else { setEnabled(settings.enabled); setItems(recipes.items); setError(''); }
    setLoading(false);
  }, [user?.id]);
  useEffect(() => { void load(); window.addEventListener('focus', load); const timer = window.setInterval(load, 60000); return () => { window.removeEventListener('focus', load); window.clearInterval(timer); }; }, [load]);
  const visible = useMemo(() => items.filter((r) => (admin || !r.is_hidden) && matchesRecipe(r, query) && (category === 'Todas' || r.category === category) && (!quick || (r.minutes != null && r.minutes <= 15)) && (!admin || visibility === 'Todas' || r.is_hidden === (visibility === 'Ocultas'))), [items, query, category, quick, admin, visibility]);
  useEffect(() => { if (selectedId && (!selected || (!admin && !enabled))) setSelectedId(null); }, [selectedId, selected, admin, enabled]);
  const categories = [...new Set([...RECIPE_CATEGORIES, ...items.map((r) => r.category)])];
  const startEdit = (recipe = null) => {
    setEditor({ id: recipe?.id || null }); setFormError(''); setSelectedId(null);
    setForm(recipe ? { ...recipe, ingredients: recipe.ingredients.join('\n'), steps: recipe.steps.join('\n') } : { ...emptyForm });
  };
  const mutate = async (action, message) => {
    if (!admin || busy) return false;
    setBusy(true); setError('');
    try { const result = await action(); if (result.error) throw result.error; await load(); setNotice(message); return true; }
    catch { setError('No se pudo guardar el cambio. Revisá tu conexión o permisos y volvé a intentar.'); return false; }
    finally { setBusy(false); }
  };
  const submit = async (event) => {
    event.preventDefault(); if (!admin || busy) return;
    setBusy(true); setFormError('');
    try { const result = await saveRecipe(form, editor.id); if (result.error) throw result.error; setEditor(null); await load(); setNotice('Receta guardada.'); }
    catch (e) { setFormError(e.message || 'No se pudo guardar.'); }
    finally { setBusy(false); }
  };
  return <div className="mx-auto max-w-6xl space-y-5">
    {onBack && <button type="button" onClick={onBack} className="btn-secondary min-h-11">← Volver</button>}
    <section className="rounded-[24px] bg-[#050505] p-5 text-white sm:p-7"><ChefHat className="mb-3 size-7 text-[#ff7a82]" /><p className="text-[10px] font-black uppercase tracking-widest text-white/60">Ideas para tu cocina</p><h1 className="mt-1 text-3xl font-black">Recetas</h1><p className="mt-2 text-sm leading-6 text-white/70">Ingredientes, preparación y nuevas ideas para acompañar tu entrenamiento.</p></section>
    {admin && <section className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm"><div className="min-w-0"><p className="font-black">Visibilidad de la sección</p><p className="text-xs text-slate-500">{enabled ? 'Disponible para alumnos y profesores de ambas sedes.' : 'Oculta para alumnos y profesores. Podés seguir administrándola.'}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy || loading} onClick={() => mutate(() => setRecipeVisibility(!enabled), enabled ? 'Sección oculta.' : 'Sección publicada.')} className="btn-secondary min-h-11">{enabled ? <EyeOff className="size-4" /> : <Eye className="size-4" />}{enabled ? 'Ocultar sección' : 'Mostrar sección'}</button><button type="button" onClick={() => startEdit()} className="btn-primary min-h-11"><Plus className="size-4" />Nueva receta</button></div></section>}
    {error && <div role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}<button type="button" onClick={load} className="btn-secondary ml-3 min-h-11">Reintentar</button></div>}
    {notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-700">{notice}</p>}
    {loading ? <p role="status">Cargando recetas…</p> : !enabled && !admin && !error ? <p className="rounded-2xl bg-white p-6 text-slate-600">El recetario no está disponible en este momento.</p> : <>
      <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm"><label className="relative block"><Search className="absolute left-3 top-3 size-5 text-slate-400" /><input aria-label="Buscar recetas" placeholder="Buscar receta o ingrediente" value={query} onChange={(e) => setQuery(e.target.value)} className={`${fieldClass} pl-10`} /></label><div className="flex flex-wrap items-center gap-3"><select aria-label="Categoría de recetas" value={category} onChange={(e) => setCategory(e.target.value)} className={`${fieldClass} !w-auto max-w-full`}><option>Todas</option>{categories.map((c) => <option key={c}>{c}</option>)}</select><label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={quick} onChange={(e) => setQuick(e.target.checked)} />Hasta 15 min</label>{admin && <select aria-label="Visibilidad de recetas" value={visibility} onChange={(e) => setVisibility(e.target.value)} className={`${fieldClass} !w-auto`}><option>Todas</option><option>Publicadas</option><option>Ocultas</option></select>}</div><p className="text-xs text-slate-500">{visible.length} recetas{admin ? ` · ${items.filter((r) => r.is_hidden).length} ocultas` : ''}</p></div>
      {!visible.length && !error && <p className="rounded-2xl bg-white p-6 text-center text-slate-500">No hay recetas con estos filtros.</p>}
      <CollapsibleSection title="Recetas disponibles" count={visible.length} collapsible={visible.length > 5} className="rounded-[22px] bg-white/60 p-3">
      <div className="grid grid-cols-1 gap-4 min-[440px]:grid-cols-2 lg:grid-cols-3">{visible.map((recipe) => <article key={recipe.id} className="min-w-0 overflow-hidden rounded-[22px] bg-white shadow-sm"><button type="button" onClick={() => setSelectedId(recipe.id)} className="block w-full text-left" aria-label={`Ver receta: ${recipe.title}`}><Photo recipe={recipe} /><div className="space-y-3 p-4"><div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span>{recipe.category}</span>{recipe.minutes != null && <span><Clock3 className="mr-1 inline size-3.5" />{recipe.minutes} min</span>}{admin && recipe.is_hidden && <span className="rounded-full bg-amber-50 px-2 py-1 font-bold text-amber-800">Oculta</span>}</div><h2 className="break-words text-lg font-black leading-snug">{recipe.title}</h2><Macros recipe={recipe} /><p className="text-xs font-bold text-[#E30613]">Ver ingredientes y preparación →</p></div></button>{admin && <div className="flex flex-wrap gap-2 border-t border-slate-100 p-3"><button aria-label={`Editar ${recipe.title}`} type="button" disabled={busy} onClick={() => startEdit(recipe)} className="btn-secondary min-h-11"><Pencil className="size-4" />Editar</button><button aria-label={`${recipe.is_hidden ? 'Mostrar' : 'Ocultar'} ${recipe.title}`} type="button" disabled={busy} onClick={() => mutate(() => setRecipeHidden(recipe.id, !recipe.is_hidden), recipe.is_hidden ? 'Receta publicada.' : 'Receta oculta.')} className="btn-secondary min-h-11">{recipe.is_hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}{recipe.is_hidden ? 'Mostrar' : 'Ocultar'}</button><button aria-label={`Eliminar ${recipe.title}`} type="button" disabled={busy} onClick={() => setDeleting(recipe)} className="btn-secondary min-h-11 text-red-700"><Trash2 className="size-4" /></button></div>}</article>)}</div>
      </CollapsibleSection>
    </>}
    <FormDialog open={!!selected && (admin || enabled)} onOpenChange={() => setSelectedId(null)} title={selected?.title || 'Receta'}>{selected && <div className="space-y-5"><Photo recipe={selected} large /><div className="flex items-center justify-between text-sm text-slate-500"><span>{selected.category}</span>{selected.minutes != null && <span>{selected.minutes} min</span>}</div><Macros recipe={selected} /><p className="text-xs leading-5 text-slate-500">Valores del recetario original; la porción no está indicada.</p><CollapsibleSection title="Ingredientes" count={selected.ingredients.length} collapsible={selected.ingredients.length > 5} className=""><ul className="list-disc space-y-2 pl-5 text-sm leading-6">{selected.ingredients.map((s, i) => <li key={i}>{s}</li>)}</ul></CollapsibleSection><CollapsibleSection title="Preparación" count={selected.steps.length} collapsible={selected.steps.length > 5} className=""><ol className="list-decimal space-y-4 pl-5 text-sm leading-6">{selected.steps.map((s, i) => <li key={i}>{s}</li>)}</ol></CollapsibleSection></div>}</FormDialog>
    <FormDialog open={admin && !!editor} onOpenChange={(v) => { if (!v && !busy) setEditor(null); }} title={editor?.id ? 'Editar receta' : 'Nueva receta'} description="Un ingrediente y un paso por línea.">{editor && <form onSubmit={submit} className="space-y-4">{[['title', 'Nombre'], ['image_url', 'Imagen (URL HTTPS)'], ['source', 'Fuente o referencia']].map(([key, label]) => <label key={key} className="block space-y-1 text-sm font-bold">{label}<input value={form[key] || ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} required={key === 'title'} maxLength={key === 'title' ? 200 : key === 'source' ? 300 : 2000} className={fieldClass} /></label>)}<label className="block space-y-1 text-sm font-bold">Categoría<select className={fieldClass} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((c) => <option key={c}>{c}</option>)}</select></label><div className="grid grid-cols-2 gap-3">{[['minutes', 'Tiempo (min)'], ['protein_g', 'Proteína (g)'], ['carbs_g', 'Carbohidratos (g)'], ['fat_g', 'Grasas (g)']].map(([key, label]) => <label key={key} className="text-sm font-bold">{label}<input type="number" min="0" max={key === 'minutes' ? 1440 : 10000} step={key === 'minutes' ? 1 : 'any'} className={fieldClass} value={form[key] ?? ''} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}</div>{[['ingredients', 'Ingredientes'], ['steps', 'Preparación']].map(([key, label]) => <label key={key} className="block space-y-1 text-sm font-bold">{label}<textarea required rows="6" className={fieldClass} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></label>)}<label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={form.is_hidden} onChange={(e) => setForm({ ...form, is_hidden: e.target.checked })} />Oculta para alumnos y profesores</label>{formError && <p role="alert" className="text-sm text-red-700">{formError}</p>}<button type="submit" disabled={busy} className="btn-primary min-h-12 w-full">{busy ? 'Guardando…' : 'Guardar receta'}</button></form>}</FormDialog>
    <FormDialog open={admin && !!deleting} onOpenChange={(v) => { if (!v && !busy) setDeleting(null); }} title="Eliminar receta"><p className="text-sm leading-6">¿Eliminar “{deleting?.title}”? Se quitará definitivamente. Podés ocultarla si querés conservarla.</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" disabled={busy} className="btn-secondary min-h-11" onClick={() => setDeleting(null)}>Cancelar</button><button type="button" disabled={busy} className="btn-primary min-h-11" onClick={async () => { if (await mutate(() => deleteRecipe(deleting.id), 'Receta eliminada.')) setDeleting(null); }}>Eliminar definitivamente</button></div></FormDialog>
  </div>;
}
