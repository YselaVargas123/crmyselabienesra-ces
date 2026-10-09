import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import type { Opcion } from "../../lib/types";
import { Boton, Campo, Tarjeta, campo } from "../../components/ui";
import { useToast } from "../../components/Toast";

export default function Metas() {
  const avisar = useToast();
  const { perfil, esAgente } = useAuth();
  const [equipo, setEquipo] = useState<Opcion[]>([]);
  const [uid, setUid] = useState(perfil?.id ?? "");
  const [m, setM] = useState({ daily_contacts: "10", daily_followups: "6", daily_visits: "3" });
  const [errores, setErrores] = useState<Partial<Record<keyof typeof m, string>>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!esAgente) return;
    supabase.from("profiles").select("id,name:full_name").eq("active", true).order("full_name").then(({ data }) => setEquipo((data ?? []) as Opcion[]));
  }, [esAgente]);
  useEffect(() => {
    if (!uid) return;
    supabase.from("activity_goals").select("daily_contacts,daily_followups,daily_visits").eq("user_id", uid).maybeSingle().then(({ data }) => {
      setM(data ? { daily_contacts: String(data.daily_contacts), daily_followups: String(data.daily_followups), daily_visits: String(data.daily_visits) } : { daily_contacts: "10", daily_followups: "6", daily_visits: "3" });
    });
  }, [uid]);

  const guardar = async () => {
    const e: typeof errores = {};
    (Object.keys(m) as (keyof typeof m)[]).forEach((k) => { const n = Number(m[k]); if (m[k].trim() === "" || !Number.isInteger(n) || n < 0 || n > 500) e[k] = "Un número entero entre 0 y 500."; });
    setErrores(e);
    if (Object.keys(e).length) return;
    setGuardando(true);
    const { error } = await supabase.from("activity_goals").upsert({ user_id: uid, daily_contacts: Number(m.daily_contacts), daily_followups: Number(m.daily_followups), daily_visits: Number(m.daily_visits) }, { onConflict: "user_id" });
    setGuardando(false);
    avisar(error ? "No se pudieron guardar las metas." : "Metas guardadas.", error ? "error" : "ok");
  };
  const set = (k: keyof typeof m, v: string) => setM((p) => ({ ...p, [k]: v }));

  return (
    <Tarjeta>
      <h2 className="font-bold">Metas diarias</h2>
      <p className="mb-3 text-sm text-muted">Se usan en el Cierre del día para medir tu avance.</p>
      {esAgente && equipo.length > 1 && (
        <div className="mb-3 max-w-xs"><Campo label="Persona"><select className={campo} value={uid} onChange={(e) => setUid(e.target.value)}>{equipo.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></Campo></div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo label="Contactos por día" error={errores.daily_contacts}><input className={campo} inputMode="numeric" value={m.daily_contacts} onChange={(e) => set("daily_contacts", e.target.value)} /></Campo>
        <Campo label="Seguimientos por día" error={errores.daily_followups}><input className={campo} inputMode="numeric" value={m.daily_followups} onChange={(e) => set("daily_followups", e.target.value)} /></Campo>
        <Campo label="Visitas por día" error={errores.daily_visits}><input className={campo} inputMode="numeric" value={m.daily_visits} onChange={(e) => set("daily_visits", e.target.value)} /></Campo>
      </div>
      <div className="mt-4 flex justify-end"><Boton variante="principal" cargando={guardando} onClick={guardar}>Guardar metas</Boton></div>
    </Tarjeta>
  );
}
