import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { studentAvatarUrl } from "../../services/accountProfile";

export default function ClientAvatar({ personId, name }) {
  const { user, permissions } = useAuth();
  const allowed = Boolean(permissions?.canViewStudentPhotos);
  const [photo, setPhoto] = useState("");
  useEffect(() => {
    let active = true, loaded = "";
    setPhoto("");
    if (allowed) studentAvatarUrl(personId).then(url => {
      loaded = url;
      if (active) setPhoto(url); else if (url.startsWith("blob:")) URL.revokeObjectURL(url);
    }).catch(() => {});
    return () => { active = false; if (loaded.startsWith("blob:")) URL.revokeObjectURL(loaded); };
  }, [personId, user?.id, allowed]);
  if (!allowed) return null;
  return <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100">
    {photo ? <img src={photo} alt={`Foto de ${name}`} className="size-full object-cover" onError={() => setPhoto("")} /> : <UserRound className="size-5 text-slate-400" aria-hidden="true" />}
  </span>;
}
