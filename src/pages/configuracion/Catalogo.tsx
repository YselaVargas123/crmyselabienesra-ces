import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Boton, Tarjeta, Vacio, campo } from "../../components/ui";
import { useToast } from "../../components/Toast";
import Orden from "./Orden";

interface Fila { id: string; name: string; active: boolean; sort_order: number }
interface Props { tabla: "lead_sources" | "loss_reasons"; titulo: string; ayuda: string; placeholder: string }

function FilaCat({ f, primera, ultima, onNombre, onActivo, onMover }: { f: Fila; primera: boolean; ultima: boolean; onNombre: (n: string) => Promise<boolean>; onActivo: (a: boolean) => void; onMover: (d: -1 | 1) => void }) {
  const [nombre, setNombre] = useState(f.name);
  useEffect(() => setNombre(f.name), [f.name]);
  const guardar = async () => {
    const limpio = nombre.trim();
    if (limpio === f.name) return;
    if (!limpio || !(await onNombre(limpio))) setNombre(f.name);
  };
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line py-2 first:border-t-0">
      <input aria-label={`Nombre de ${f.name}`} className={`${campo} !h-10 min-w-[180px] flex-1 ${f.active ? "" : "opacity-60"}`} value={nombre}
        onChange={(e) => setNombre(e.target.value)} onBlur={guardar} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={f.active} onChange={(e) => onActivo(e.target.checked)} />Activo</label>
      <Orden nombre={f.name} puedeSubir={!primera} puedeBajar={!ultima} onMover={onMover} />
    </div>
  );
}

export default function Catalogo({ tabla, titulo, ayuda, placeholder }: Props) {
  const avisar = useToast();
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [nuevo, setNuevo] = useState("");
  const [error, setError] = useState(false);
  const [agregando, setAgregando] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.from(tabla).select("id,name,active,sort_order").order("sort_order").order("name");
    if (e) { setError(true); setFilas([]); return; }
    setError(false); setFilas((data ?? []) as Fila[]);
  }, [tabla]);
  useEffect(() => { void cargar(); }, [cargar]);

  const normaliza = async (lista: Fila[]) => {
    const cambios = lista.map((f, i) => ({ f, orden: i + 1 })).filter((x) => x.f.sort_order !== x.orden);
    const res = await Promise.all(cambios.map((x) => supabase.from(tabla).update({ sort_order: x.orden }).eq("id", x.f.id)));
    if (res.some((r) => r.error)) avisar("No se pudo guardar el orden.", "error");
    await cargar();
  };
  const mover = (i: number, d: -1 | 1) => {
    if (!filas) return;
    const l = [...filas]; const j = i + d;
    if (j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    void normaliza(l);
  };
  const cambiar = async (id: string, cambio: Record<string, unknown>, ok: string): Promise<boolean> => {
    const { error: e } = await supabase.from(tabla).update(cambio).eq("id", id);
    if (e) { avisar(e.code === "23505" ? "Ya existe un registro con ese nombre." : "No se pudo guardar el cambio.", "error"); return false; }
    avisar(ok); await cargar(); return true;
  };
  const agregar = async () => {
    const n = nuevo.trim();
    if (!n) return avisar("Escribe un nombre.", "error");
    setAgregando(true);
    const { error: e } = await supabase.from(tabla).insert({ name: n, sort_order: (filas?.length ?? 0) + 1 });
    setAgregando(false);
    if (e) return avisar(e.code === "23505" ? "Ya existe un registro con ese nombre." : "No se pudo agregar.", "error");
    setNuevo(""); avisar("Agregado."); await cargar();
  };

  return (
    <Tarjeta>
      <h2 className="font-bold">{titulo}</h2>
      <p className="mb-3 text-sm text-muted">{ayuda}</p>
      {error && <p role="alert" className="mb-2 text-sm font-semibold text-danger">! No se pudo cargar. <button className="underline" onClick={cargar}>Reintentar</button></p>}
      {filas === null ? [0, 1, 2].map((i) => <div key={i} className="mb-2 h-10 animate-pulse rounded bg-head" />) :
        filas.length === 0 ? <Vacio titulo="Todavía no hay registros" detalle="Agrega el primero abajo." /> :
          filas.map((f, i) => <FilaCat key={f.id} f={f} primera={i === 0} ultima={i === filas.length - 1}
            onNombre={(n) => cambiar(f.id, { name: n }, "Nombre actualizado.")} onActivo={(a) => void cambiar(f.id, { active: a }, a ? "Activado." : "Desactivado.")} onMover={(d) => mover(i, d)} />)}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
        <input aria-label={`Nuevo: ${titulo}`} className={`${campo} min-w-[200px] flex-1`} placeholder={placeholder} value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void agregar(); }} />
        <Boton variante="principal" cargando={agregando} onClick={agregar}>Agregar</Boton>
      </div>
    </Tarjeta>
  );
}
