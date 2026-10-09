import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { TIPOS_ACTIVIDAD } from "../lib/types";
import {
  SELECT_ACTIVIDAD, cancelarActividad, completarActividad, finHoy, inicioHoy, posponerActividad, type ActividadFila, type Posponer,
} from "../lib/actividades";
import { Boton, Tarjeta, Vacio, campo } from "../components/ui";
import ActividadForm from "../components/ActividadForm";
import FilaActividad from "../components/FilaActividad";
import { useToast } from "../components/Toast";

type Vista = "Vencidas" | "Hoy" | "Próximas" | "Completadas";
const VISTAS: Vista[] = ["Vencidas", "Hoy", "Próximas", "Completadas"];

export default function Actividades() {
  const avisar = useToast();
  const { perfil } = useAuth();
  const [vista, setVista] = useState<Vista>("Hoy");
  const [pend, setPend] = useState<ActividadFila[] | null>(null);
  const [hechas, setHechas] = useState<ActividadFila[] | null>(null);
  const [error, setError] = useState(false);
  const [soloMias, setSoloMias] = useState(false);
  const [tipo, setTipo] = useState("");
  const [nueva, setNueva] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const [p, h] = await Promise.all([
      supabase.from("activities").select(SELECT_ACTIVIDAD).eq("status", "Pendiente").order("due_at").limit(500),
      supabase.from("activities").select(SELECT_ACTIVIDAD).eq("status", "Completada").order("updated_at", { ascending: false }).limit(100),
    ]);
    if (p.error || h.error) { setError(true); setPend([]); setHechas([]); return; }
    setError(false);
    setPend((p.data ?? []) as unknown as ActividadFila[]);
    setHechas((h.data ?? []) as unknown as ActividadFila[]);
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const filtra = useCallback((l: ActividadFila[]) => l.filter((a) => (!soloMias || a.owner_id === perfil?.id) && (!tipo || a.activity_type === tipo)), [soloMias, tipo, perfil]);
  const grupos = useMemo(() => {
    const ini = inicioHoy().getTime(), fin = finHoy().getTime();
    const p = filtra(pend ?? []);
    return {
      Vencidas: p.filter((a) => new Date(a.due_at).getTime() < ini),
      Hoy: p.filter((a) => { const t = new Date(a.due_at).getTime(); return t >= ini && t <= fin; }),
      Próximas: p.filter((a) => new Date(a.due_at).getTime() > fin),
      Completadas: filtra(hechas ?? []),
    } satisfies Record<Vista, ActividadFila[]>;
  }, [pend, hechas, filtra]);

  const ejecutar = async (id: string, fn: () => Promise<boolean>, ok: string) => {
    setOcupado(id);
    const bien = await fn();
    setOcupado(null);
    if (!bien) return avisar("No se pudo guardar el cambio. Inténtalo de nuevo.", "error");
    avisar(ok);
    await cargar();
  };
  const cancelar = (a: ActividadFila) => {
    if (!window.confirm(`¿Cancelar «${a.title}»? Dejará de aparecer en tus pendientes.`)) return;
    void ejecutar(a.id, () => cancelarActividad(a.id), "Actividad cancelada.");
  };

  const lista = grupos[vista];
  const cargando = pend === null;
  const pildora = (activo: boolean) => `min-h-[36px] whitespace-nowrap rounded-full border px-3 text-sm font-semibold ${activo ? "border-brand bg-blue-100 text-brand dark:bg-blue-950 dark:text-blue-200" : "border-line text-muted"}`;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">Actividades</h1>
        <Boton variante="principal" onClick={() => setNueva(true)}><Plus size={15} />Nueva actividad</Boton>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {VISTAS.map((v) => (
          <button key={v} onClick={() => setVista(v)} aria-pressed={vista === v} className={pildora(vista === v)}>
            {v === "Vencidas" && grupos.Vencidas.length > 0 ? "! " : ""}{v} {grupos[v].length}
          </button>
        ))}
        <select aria-label="Filtrar por tipo" className={`${campo} !h-9 !w-auto`} value={tipo} onChange={(e) => setTipo(e.target.value)}>
          <option value="">Tipo: todos</option>{TIPOS_ACTIVIDAD.map((t) => <option key={t}>{t}</option>)}
        </select>
        <label className="flex min-h-[36px] items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={soloMias} onChange={(e) => setSoloMias(e.target.checked)} />Solo mías</label>
      </div>
      {error && <p role="alert" className="mb-2 text-sm font-semibold text-danger">! No se pudieron cargar las actividades. <button className="underline" onClick={cargar}>Reintentar</button></p>}
      <Tarjeta>
        {cargando && [0, 1, 2].map((i) => <div key={i} className="mb-2 h-14 animate-pulse rounded-md bg-head" />)}
        {!cargando && lista.length === 0 && (
          <Vacio titulo={vista === "Completadas" ? "Todavía no hay actividades completadas" : `No hay actividades ${vista === "Vencidas" ? "vencidas" : vista === "Hoy" ? "para hoy" : "próximas"}`}
            detalle={vista === "Vencidas" ? "¡Estás al día!" : "Agenda una llamada, visita o seguimiento con el botón + Nueva actividad."} />
        )}
        {lista.map((a) => (
          <FilaActividad key={a.id} a={a} ocupado={ocupado === a.id}
            onCompletar={() => void ejecutar(a.id, () => completarActividad(a.id), "Actividad completada.")}
            onPosponer={(op: Posponer) => void ejecutar(a.id, () => posponerActividad(a, op), "Actividad pospuesta.")}
            onCancelar={() => cancelar(a)} />
        ))}
      </Tarjeta>
      {nueva && <ActividadForm onClose={() => setNueva(false)} onGuardado={() => { setNueva(false); void cargar(); }} />}
    </>
  );
}
