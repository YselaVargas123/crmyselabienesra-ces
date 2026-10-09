import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { Etapa, PipelineInfo } from "../../lib/types";
import { Boton, Etiqueta, Tarjeta, campo } from "../../components/ui";
import { useToast } from "../../components/Toast";
import Orden from "./Orden";

interface FilaProps { e: Etapa; primera: boolean; ultima: boolean; onGuardar: (c: Partial<Etapa>, ok: string) => Promise<boolean>; onActivo: (a: boolean) => void; onMover: (d: -1 | 1) => void }
type EtapaCfg = Etapa & { active: boolean };

function FilaEtapa({ e, primera, ultima, onGuardar, onActivo, onMover }: FilaProps & { e: EtapaCfg }) {
  const [nombre, setNombre] = useState(e.name);
  const [prob, setProb] = useState(String(e.probability));
  const [color, setColor] = useState(e.color);
  useEffect(() => { setNombre(e.name); setProb(String(e.probability)); setColor(e.color); }, [e.name, e.probability, e.color]);
  const abierta = e.kind === "abierta";
  const guardarNombre = async () => {
    const n = nombre.trim();
    if (n === e.name) return;
    if (!n || !(await onGuardar({ name: n }, "Nombre actualizado."))) setNombre(e.name);
  };
  const guardarProb = async () => {
    const p = Number(prob);
    if (p === e.probability) return;
    if (!Number.isInteger(p) || p < 0 || p > 100 || !(await onGuardar({ probability: p }, "Probabilidad actualizada."))) setProb(String(e.probability));
  };
  return (
    <div className="flex flex-wrap items-center gap-2 border-t border-line py-2 first:border-t-0">
      <input type="color" aria-label={`Color de ${e.name}`} value={color} onChange={(ev) => setColor(ev.target.value)} onBlur={() => color !== e.color && void onGuardar({ color }, "Color actualizado.")} className="h-10 w-10 shrink-0 cursor-pointer rounded border border-line bg-transparent p-0.5" />
      <input aria-label={`Nombre de la etapa ${e.name}`} className={`${campo} !h-10 min-w-[180px] flex-1 ${e.active ? "" : "opacity-60"}`} value={nombre} onChange={(ev) => setNombre(ev.target.value)} onBlur={guardarNombre} onKeyDown={(ev) => { if (ev.key === "Enter") (ev.target as HTMLInputElement).blur(); }} />
      {abierta ? (
        <label className="flex items-center gap-1 text-sm font-semibold">
          <input aria-label={`Probabilidad de ${e.name}`} inputMode="numeric" className={`${campo} !h-10 !w-16 text-center`} value={prob} onChange={(ev) => setProb(ev.target.value)} onBlur={guardarProb} />%
        </label>
      ) : <Etiqueta tono={e.kind === "ganada" ? "verde" : "rojo"}>{e.kind === "ganada" ? "Ganada" : "Perdida"}</Etiqueta>}
      <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-5 w-5" checked={e.active} onChange={(ev) => onActivo(ev.target.checked)} />Activa</label>
      <Orden nombre={e.name} puedeSubir={!primera} puedeBajar={!ultima} onMover={onMover} />
    </div>
  );
}

export default function Etapas() {
  const avisar = useToast();
  const [pipes, setPipes] = useState<PipelineInfo[]>([]);
  const [pid, setPid] = useState("");
  const [etapas, setEtapas] = useState<EtapaCfg[] | null>(null);
  const [error, setError] = useState(false);
  const [nuevo, setNuevo] = useState("");

  useEffect(() => {
    supabase.from("pipelines").select("*").order("code").then(({ data }) => {
      const l = (data ?? []) as PipelineInfo[];
      setPipes(l); if (l[0]) setPid(l[0].id);
    });
  }, []);
  const cargar = useCallback(async () => {
    if (!pid) return;
    const { data, error: e } = await supabase.from("pipeline_stages").select("*").eq("pipeline_id", pid).order("sort_order");
    if (e) { setError(true); setEtapas([]); return; }
    setError(false); setEtapas((data ?? []) as EtapaCfg[]);
  }, [pid]);
  useEffect(() => { setEtapas(null); void cargar(); }, [cargar]);

  const guardar = async (id: string, cambio: Partial<Etapa> | { active: boolean }, ok: string): Promise<boolean> => {
    const { error: e } = await supabase.from("pipeline_stages").update(cambio).eq("id", id);
    if (e) { avisar("No se pudo guardar el cambio.", "error"); return false; }
    avisar(ok); await cargar(); return true;
  };
  const alternar = async (et: EtapaCfg, activa: boolean) => {
    if (!activa) {
      const { count, error: e } = await supabase.from("opportunities").select("id", { count: "exact", head: true }).eq("stage_id", et.id);
      if (e) return avisar("No se pudo verificar la etapa.", "error");
      if ((count ?? 0) > 0) return avisar(`Hay ${count} oportunidad(es) en «${et.name}». Muévelas a otra etapa antes de desactivarla.`, "error");
      if (et.kind === "abierta" && (etapas ?? []).filter((x) => x.kind === "abierta" && x.active).length <= 1) return avisar("Debe quedar al menos una etapa abierta activa.", "error");
    }
    await guardar(et.id, { active: activa }, activa ? "Etapa activada." : "Etapa desactivada.");
  };
  const normaliza = async (lista: EtapaCfg[]) => {
    const cambios = lista.map((f, i) => ({ f, orden: i + 1 })).filter((x) => x.f.sort_order !== x.orden);
    const res = await Promise.all(cambios.map((x) => supabase.from("pipeline_stages").update({ sort_order: x.orden }).eq("id", x.f.id)));
    if (res.some((r) => r.error)) avisar("No se pudo guardar el orden.", "error");
    await cargar();
  };
  const mover = (i: number, d: -1 | 1) => {
    if (!etapas) return;
    const j = i + d;
    if (j < 0 || j >= etapas.length) return;
    if ((etapas[i].kind === "abierta") !== (etapas[j].kind === "abierta")) return avisar("Las etapas abiertas siempre van antes que las de cierre.", "error");
    const l = [...etapas]; [l[i], l[j]] = [l[j], l[i]];
    void normaliza(l);
  };
  const agregar = async () => {
    const n = nuevo.trim();
    if (!n || !etapas) return avisar("Escribe un nombre para la etapa.", "error");
    const { data, error: e } = await supabase.from("pipeline_stages").insert({ pipeline_id: pid, name: n, kind: "abierta", probability: 50, color: "#003DA5", sort_order: 999 }).select("*").single();
    if (e || !data) return avisar("No se pudo agregar la etapa.", "error");
    const k = etapas.findIndex((x) => x.kind !== "abierta");
    const l = [...etapas]; l.splice(k === -1 ? l.length : k, 0, data as EtapaCfg);
    setNuevo(""); avisar("Etapa agregada. Ajusta su probabilidad si hace falta.");
    await normaliza(l);
  };

  return (
    <Tarjeta>
      <h2 className="font-bold">Etapas del pipeline</h2>
      <p className="mb-3 text-sm text-muted">Cambia nombres, orden, color y probabilidad. La probabilidad nueva se aplica a cada oportunidad la próxima vez que se modifique. Las etapas Ganada y Perdida no se pueden cambiar de tipo.</p>
      <div className="mb-3 flex gap-2" role="group" aria-label="Pipeline">
        {pipes.map((p) => <button key={p.id} aria-pressed={pid === p.id} onClick={() => setPid(p.id)} className={`min-h-[36px] rounded-full border px-3 text-sm font-semibold ${pid === p.id ? "border-brand bg-brand text-white" : "border-line text-muted"}`}>{p.name}</button>)}
      </div>
      {error && <p role="alert" className="mb-2 text-sm font-semibold text-danger">! No se pudieron cargar las etapas. <button className="underline" onClick={cargar}>Reintentar</button></p>}
      {etapas === null ? [0, 1, 2].map((i) => <div key={i} className="mb-2 h-10 animate-pulse rounded bg-head" />) :
        etapas.map((et, i) => <FilaEtapa key={et.id} e={et} primera={i === 0} ultima={i === etapas.length - 1}
          onGuardar={(c, ok) => guardar(et.id, c, ok)} onActivo={(a) => void alternar(et, a)} onMover={(d) => mover(i, d)} />)}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
        <input aria-label="Nombre de la nueva etapa" className={`${campo} min-w-[200px] flex-1`} placeholder="Nueva etapa abierta, por ejemplo «Tasación»" value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void agregar(); }} />
        <Boton variante="principal" onClick={agregar}>Agregar etapa</Boton>
      </div>
    </Tarjeta>
  );
}
