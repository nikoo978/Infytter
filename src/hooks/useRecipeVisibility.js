import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { getRecipeVisibility } from '../services/recipes';
export default function useRecipeVisibility(preview = false) {
  const { user } = useAuth();
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (preview || !user?.id) { setEnabled(false); return; }
    let alive = true;
    const load = async () => { const result = await getRecipeVisibility(); if (alive) setEnabled(result.enabled); };
    void load();
    window.addEventListener('focus', load);
    const timer = window.setInterval(load, 60000);
    return () => { alive = false; window.removeEventListener('focus', load); window.clearInterval(timer); };
  }, [preview, user?.id]);
  return enabled;
}
