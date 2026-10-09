import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useApp } from "../context/AppContext";
import { salud, usd, hace } from "../lib/format";
import { nombreCompleto, type Etapa, type Opcion, type Oportunidad, type PipelineInfo } from "../lib/types";
import { Boton, Etiqueta, Vacio, campo, tonoSalud } from "../components/ui";
import Modal from "../components/Modal";
import OportunidadForm from "../components/OportunidadForm";
import { useToast } from "../components/Toast";

export default function Pipeline() {
  const { modo } = useApp();
  const avisar = useToast();
  const codigo = modo === "Captación" ? "captacion" : "colocacion";
  const [pipe, setPipe] = useState<PipelineInfo | null>(null);
  const [etapas, setEtapas] = useState<Etapa[]>([]);
  const [ops, setOps] = useState<Oportunidad[] | null>(null);
  const [razones, setRazones] = useState<Opcion[]>([]);
  const [error, setError] = useState(false);
  const [nueva, setNueva] = useState(false);
  const [perdiendo, setPerdiendo] = useState<{ op: Oportunidad; etapa: Etapa } | null>(null);
  const [razon, setRazon] = useState("");
  const [sobre, setSobre] = useState<string | null>(null);
  const [soloMias, setSoloMias] = useState(false);
  const [yo, setYo] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setOps(null); setError(false);
    const { data: p, error: ep } = await supabase.from("pipelines").select("*").eq("code", codigo).single();
    if (ep || !p) { setError(true); setOps([]); return; }
    setPipe(p as PipelineInfo);
    const [e, o] = await Promise.all([
      supabase.from("pipeline_stages").select("*").eq("pipeline_id", p.id).eq("active", true).order("sort_order"),
      supabase.from("opportunities")
        .select("*, contact:contacts(first_name,last_name,whatsapp), owner:profiles!opportunities_owner_id_fkey(full_name)")
        .eq("pipeline_id", p.id).neq("status", "archivada").order("last_activity_at", { ascending: false }).limit(500),
    ]);
    if (e.error || o.error) { setError(true); setOps([]); return; }
    setEtapas((e.data ?? []) as Etapa[]);
    setOps((o.data ?? []) as unknown as Oportunidad[]);
  }, [codigo]);

  useEffect(() => { void cargar(); }, [cargar]);
  useEffect(() => {
    supabase.from("loss_reasons").select("id,name").eq("active", true).order("sort_order").then(({ data }) => setRazones((data ?? []) as Opcion[]));
    supabase.auth.getUser().then(({ data }) => setYo(data.user?.id ?? null));
  }, []);

  const visibles = useMemo(() => (ops ?? []).filter((o) => !soloMias || o.owner_id === yo), [ops, soloMias, yo]);
  const abiertas = visibles.filter((o) => o.status === "abierta");
  const totalAbierto = abiertas.reduce((s, o) => s + Number(o.amount_usd), 0);
  const ponderado = abiertas.reduce((s, o) => s + Number(o.amount_usd) * (o.probability / 100), 0);

  const mover = async (op: Oportunidad, etapa: Etapa, razonId?: string) => {
    if (op.stage_id === etapa.id) return;
    if (etapa.kind === "perdida" && !razonId) { setRazon(""); setPerdiendo({ op, etapa }); return; }
    const anterior = etapas.find((x) => x.id === op.stage_id)?.name ?? "—";
    const previo = ops;
    setOps((p) => (p ?? []).map((x) => (x.id === op.id ? { ...x, stage_id: etapa.id, status: etapa.kind, probability: etapa.probability } : x)));
    const { error: e } = await supabase.from("opportunities").update({
      stage_id: etapa.id, status: etapa.kind, probability: etapa.probability,
      loss_reason_id: etapa.kind === "perdida" ? razonId : null, last_activity_at: new Date().toISOString(),
    }).eq("id", op.id);
    if (e) { setOps(previo); avisar("No se pudo mover la oportunidad. Inténtalo de nuevo.", "error"); return; }
    await supabase.from("timeline_events").insert({
      contact_id: op.contact_id, opportunity_id: op.id, event_type: "cambio_etapa",
      description: `Pasó de «${anterior}» a «${etapa.name}»`, origin: "sistema",
    });
    avisar(etapa.kind === "ganada" ? "¡Operación ganada!" : `Movida a «${etapa.name}».`);
  };

  const confirmarPerdida = async () => {
    if (!perdiendo) return;
    if (!razon) return avisar("Elige el motivo de la pérdida.", "error");
    const { op, etapa } = perdiendo;
    setPerdiendo(null);
    await mover(op, etapa, razon);
  };

  const primeraEtapa = etapas.find((e) => e.kind === "abierta");

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-extrabold">Pipeline · {modo}</h1>
          <p className="text-sm text-muted">{abiertas.length} abiertas · {usd(totalAbierto)} · ponderado {usd(ponderado)}</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-semibold md:min-h-[36px]"><input type="checkbox" className="h-5 w-5" checked={soloMias} onChange={(e) => setSoloMias(e.target.checked)} />Solo mías</label>
          <Boton variante="principal" disabled={!pipe || !primeraEtapa} onClick={() => setNueva(true)}><Plus size={15} />Oportunidad</Boton>
        </div>
      </div>
      {error && <p role="alert" className="mb-2 text-sm font-semibold text-danger">! No se pudo cargar el pipeline. <button className="underline" onClick={cargar}>Reintentar</button></p>}
      {ops === null ? (
        <div className="flex gap-3 overflow-x-auto">{[0, 1, 2, 3].map((i) => <div key={i} className="h-64 w-[260px] shrink-0 animate-pulse rounded-xl bg-head" />)}</div>
      ) : etapas.length === 0 ? (
        <Vacio titulo="Este pipeline no tiene etapas" detalle="Revisa la tabla pipeline_stages en Supabase." />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {etapas.map((et) => {
            const col = visibles.filter((o) => o.stage_id === et.id);
            const suma = col.reduce((s, o) => s + Number(o.amount_usd), 0);
            return (
              <section key={et.id} aria-label={et.name}
                onDragOver={(e) => { e.preventDefault(); setSobre(et.id); }} onDragLeave={() => setSobre((s) => (s === et.id ? null : s))}
                onDrop={(e) => { e.preventDefault(); setSobre(null); const op = ops.find((o) => o.id === e.dataTransfer.getData("text/plain")); if (op) void mover(op, et); }}
                className={`flex max-h-[calc(100vh-230px)] w-[260px] shrink-0 flex-col rounded-xl border bg-head ${sobre === et.id ? "border-brand ring-2 ring-brand/30" : "border-line"}`}>
                <header className="border-b border-line px-3 py-2" style={{ borderTop: `4px solid ${et.color}`, borderRadius: "0.75rem 0.75rem 0 0" }}>
                  <div className="flex items-center justify-between gap-2"><h2 className="text-sm font-extrabold leading-tight">{et.name}</h2><span className="text-xs font-bold text-muted">{col.length}</span></div>
                  <div className="text-xs text-muted">{usd(suma)}{et.kind === "abierta" ? ` · ${et.probability}%` : ""}</div>
                </header>
                <div className="flex-1 space-y-2 overflow-y-auto p-2">
                  {col.length === 0 && <p className="px-1 py-3 text-center text-xs text-muted">Sin oportunidades</p>}
                  {col.map((o) => {
                    const s = salud(o.last_activity_at);
                    return (
                      <article key={o.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", o.id)} className="cursor-grab rounded-lg border border-line bg-card p-3 text-sm shadow-sm active:cursor-grabbing">
                        <div className="font-bold leading-tight">{o.title}</div>
                        <Link to={`/contactos?ficha=${o.contact_id}`} className="text-xs font-semibold text-brand underline-offset-2 hover:underline dark:text-blue-300">{o.contact ? nombreCompleto(o.contact) : "Contacto"}</Link>
                        <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
                          <span className="font-bold">{usd(Number(o.amount_usd))}</span>
                          {o.status === "abierta" && <Etiqueta tono={tonoSalud(s)}>{s}</Etiqueta>}
                        </div>
                        <div className="mt-1 text-xs text-muted">{o.operation_type === "Anticretico" ? "Anticrético" : o.operation_type} · {hace(o.last_activity_at)}</div>
                        <select aria-label={`Mover ${o.title} a otra etapa`} className={`${campo} mt-2 !h-9 !text-sm`} value={o.stage_id} onChange={(e) => { const dest = etapas.find((x) => x.id === e.target.value); if (dest) void mover(o, dest); }}>
                          {etapas.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                        </select>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {nueva && pipe && primeraEtapa && <OportunidadForm pipelineId={pipe.id} etapaInicial={primeraEtapa} onClose={() => setNueva(false)} onGuardado={() => { setNueva(false); void cargar(); }} />}
      {perdiendo && (
        <Modal titulo="¿Por qué se perdió?" onClose={() => setPerdiendo(null)}>
          <div className="space-y-3 px-5 py-4">
            <p className="text-sm text-muted">«{perdiendo.op.title}» pasará a «{perdiendo.etapa.name}». El motivo ayuda a mejorar tus reportes.</p>
            <select aria-label="Motivo de pérdida" className={campo} value={razon} onChange={(e) => setRazon(e.target.value)} autoFocus>
              <option value="">Elige un motivo…</option>{razones.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3"><Boton variante="texto" onClick={() => setPerdiendo(null)}>Cancelar</Boton><Boton variante="principal" onClick={confirmarPerdida}>Marcar como perdida</Boton></div>
        </Modal>
      )}
    </>
  );
}
