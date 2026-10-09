import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuth } from "../../context/AuthContext";
import { Avatar, Etiqueta, Tarjeta, campo } from "../../components/ui";
import { useToast } from "../../components/Toast";

interface Persona { id: string; full_name: string; email: string | null; role: "agente" | "asistente"; active: boolean }

export default function Equipo() {
  const avisar = useToast();
  const { perfil } = useAuth();
  const [lista, setLista] = useState<Persona[] | null>(null);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.from("profiles").select("id,full_name,email,role,active").order("full_name");
    if (e) { setError(true); setLista([]); return; }
    setError(false); setLista((data ?? []) as Persona[]);
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const cambiar = async (p: Persona, cambio: Partial<Persona>) => {
    const { error: e } = await supabase.from("profiles").update(cambio).eq("id", p.id);
    if (e) return avisar("No se pudo guardar el cambio.", "error");
    avisar("Cambio guardado."); await cargar();
  };

  return (
    <Tarjeta>
      <h2 className="font-bold">Equipo</h2>
      <p className="mb-3 text-sm text-muted">El agente ve y configura todo. El asistente trabaja con contactos, actividades y pipeline, sin acceso a esta configuración.</p>
      {error && <p role="alert" className="mb-2 text-sm font-semibold text-danger">! No se pudo cargar el equipo. <button className="underline" onClick={cargar}>Reintentar</button></p>}
      {lista === null ? [0, 1].map((i) => <div key={i} className="mb-2 h-12 animate-pulse rounded bg-head" />) : lista.map((p) => {
        const yo = p.id === perfil?.id;
        return (
          <div key={p.id} className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0">
            <Avatar nombre={p.full_name} />
            <div className="min-w-[180px] flex-1"><div className="text-sm font-semibold">{p.full_name}{yo && " (tú)"}</div><div className="text-xs text-muted">{p.email}</div></div>
            {!p.active && <Etiqueta tono="gris">Desactivado</Etiqueta>}
            <select aria-label={`Rol de ${p.full_name}`} disabled={yo} title={yo ? "No puedes cambiar tu propio rol" : undefined} className={`${campo} !h-10 !w-auto`} value={p.role} onChange={(e) => void cambiar(p, { role: e.target.value as Persona["role"] })}>
              <option value="agente">Agente</option><option value="asistente">Asistente</option>
            </select>
            <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" disabled={yo} checked={p.active} onChange={(e) => void cambiar(p, { active: e.target.checked })} />Activo</label>
          </div>
        );
      })}
      <div className="mt-3 rounded-md border border-dashed border-line p-3 text-sm text-muted">
        <b className="text-ink">¿Cómo agrego a una persona nueva?</b> En Supabase entra a Authentication → Users → Add user, con su correo y una contraseña. Al crearla aparece aquí como Asistente; si debe ser Agente, cámbiale el rol.
      </div>
    </Tarjeta>
  );
}
