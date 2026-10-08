import { useCallback, useEffect, useState } from "react";
import { X, Mail, Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { fechaHora, hace, usd } from "../lib/format";
import { nombreCompleto, type Contacto } from "../lib/types";
import { Boton, Campo, Etiqueta, TelefonoChip, Vacio, campo } from "./ui";
import ActividadForm from "./ActividadForm";
import { useToast } from "./Toast";

const TABS = ["Datos", "Oportunidades", "Actividad", "Notas", "Línea de tiempo", "Perfil de búsqueda"] as const;
type Tab = (typeof TABS)[number];
interface Fila { id: string; [k: string]: unknown }

const tonoEstado = (s: string) => (s === "Cliente" ? "verde" : s === "Lead activo" ? "azul" : "gris") as "verde" | "azul" | "gris";

export default function FichaContacto({ id, onClose, onEditar }: { id: string; onClose: () => void; onEditar: (c: Contacto) => void }) {
  const avisar = useToast();
  const [c, setC] = useState<Contacto | null>(null);
  const [tab, setTab] = useState<Tab>("Datos");
  const [actividad, setActividad] = useState(false);
  const [error, setError] = useState(false);

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.from("contacts").select("*, source:lead_sources(name), owner:profiles!contacts_owner_id_fkey(full_name)").eq("id", id).single();
    if (e || !data) { setError(true); return; }
    setError(false); setC(data as unknown as Contacto);
  }, [id]);
  useEffect(() => { setC(null); setTab("Datos"); void cargar(); }, [cargar]);

  return (
    <aside aria-label="Ficha del contacto" className="fixed inset-0 z-40 overflow-y-auto bg-card p-4 lg:static lg:z-auto lg:h-fit lg:rounded-xl lg:border lg:border-line">
      <div className="flex items-start justify-between">
        <h2 className="text-lg font-extrabold">{c ? nombreCompleto(c) : "Cargando…"}</h2>
        <button onClick={onClose} aria-label="Cerrar ficha" className="flex h-10 w-10 items-center justify-center text-muted"><X size={20} /></button>
      </div>
      {error && <p role="alert" className="text-sm font-semibold text-danger">! No se pudo cargar el contacto.</p>}
      {c && (
        <>
          <div className="my-1 flex flex-wrap gap-1"><Etiqueta tono={tonoEstado(c.status)}>{c.status}</Etiqueta><Etiqueta>{c.contact_type}</Etiqueta>{c.owner && <Etiqueta tono="azul">{c.owner.full_name}</Etiqueta>}</div>
          <TelefonoChip tel={c.whatsapp ?? c.phone} nombre={nombreCompleto(c)} />
          <div className="my-3 flex flex-wrap gap-2">
            {c.email && <a href={`mailto:${c.email}`} className="inline-flex min-h-[44px] items-center gap-1 rounded-md border-[1.5px] border-brand px-3 text-sm font-bold text-brand md:min-h-[36px] dark:text-blue-200"><Mail size={15} />Email</a>}
            <Boton onClick={() => setActividad(true)}><Plus size={15} />Actividad</Boton>
            <Boton onClick={() => setTab("Notas")}><Plus size={15} />Nota</Boton>
          </div>
          <div role="tablist" className="mb-3 flex gap-4 overflow-x-auto border-b border-line">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
                className={`min-h-[40px] whitespace-nowrap border-b-[3px] text-sm font-semibold ${tab === t ? "border-accent text-ink" : "border-transparent text-muted"}`}>{t}</button>))}
          </div>
          {tab === "Datos" && <Datos c={c} onEditar={() => onEditar(c)} />}
          {tab === "Oportunidades" && <Oportunidades id={id} />}
          {tab === "Actividad" && <Actividades id={id} />}
          {tab === "Notas" && <Notas id={id} onNota={cargar} />}
          {tab === "Línea de tiempo" && <Linea id={id} />}
          {tab === "Perfil de búsqueda" && <Perfil id={id} avisar={avisar} />}
        </>
      )}
      {actividad && c && <ActividadForm contactoId={id} contactoNombre={nombreCompleto(c)} onClose={() => setActividad(false)} onGuardado={() => { setActividad(false); setTab("Actividad"); }} />}
    </aside>
  );
}

function Datos({ c, onEditar }: { c: Contacto; onEditar: () => void }) {
  const filas: [string, string | null][] = [["Origen", c.source?.name ?? null], ["Ciudad", c.city], ["CI / NIT", c.document_id], ["Correo", c.email], ["Teléfono alterno", c.phone], ["Dirección", c.address], ["Nacimiento", c.birth_date], ["Última interacción", hace(c.last_interaction_at)], ["Notas", c.notes]];
  return (
    <>
      <dl className="grid gap-2 text-sm">{filas.map(([k, v]) => <div key={k} className="flex justify-between gap-3"><dt className="text-muted">{k}</dt><dd className="text-right font-semibold">{v || "—"}</dd></div>)}</dl>
      <div className="mt-3"><Boton onClick={onEditar}>Editar datos</Boton></div>
    </>
  );
}
function useLista(tabla: string, columnas: string, id: string, orden: string, extra?: (q: any) => any) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [error, setError] = useState(false);
  const recargar = useCallback(async () => {
    let q = supabase.from(tabla).select(columnas).eq("contact_id", id).order(orden, { ascending: false }).limit(100);
    if (extra) q = extra(q);
    const { data, error: e } = await q;
    if (e) setError(true); else { setError(false); setFilas((data ?? []) as unknown as Fila[]); }
  }, [tabla, columnas, id, orden, extra]);
  useEffect(() => { void recargar(); }, [recargar]);
  return { filas, error, recargar };
}
const Cargando = () => <div className="h-12 animate-pulse rounded-md bg-head" />;
const Falla = () => <p role="alert" className="text-sm font-semibold text-danger">! No se pudo cargar esta pestaña.</p>;

function Oportunidades({ id }: { id: string }) {
  const { filas, error } = useLista("opportunities", "id,title,amount_usd,probability,status,stage:pipeline_stages(name)", id, "created_at");
  if (error) return <Falla />;
  if (!filas) return <Cargando />;
  if (!filas.length) return <Vacio titulo="Sin oportunidades" detalle="Cuando este contacto tenga una operación posible, aparecerá aquí." />;
  return <ul className="grid gap-2">{filas.map((o) => (
    <li key={o.id} className="rounded-md border border-line p-2 text-sm"><div className="font-semibold">{String(o.title)}</div>
      <div className="text-xs text-muted">{(o.stage as { name: string } | null)?.name} · {String(o.probability)}% · <span className="font-bold text-ok">{usd(Number(o.amount_usd))}</span></div></li>))}</ul>;
}
function Actividades({ id }: { id: string }) {
  const { filas, error } = useLista("activities", "id,title,activity_type,due_at,status", id, "due_at");
  if (error) return <Falla />;
  if (!filas) return <Cargando />;
  if (!filas.length) return <Vacio titulo="Sin actividades" detalle="Agenda una llamada, visita o seguimiento con el botón + Actividad." />;
  return <ul className="grid gap-2">{filas.map((a) => (
    <li key={a.id} className="flex items-center justify-between gap-2 rounded-md border border-line p-2 text-sm">
      <div><div className="font-semibold">{String(a.title)}</div><div className="text-xs text-muted">{String(a.activity_type)} · {fechaHora(String(a.due_at))}</div></div>
      <Etiqueta tono={a.status === "Completada" ? "verde" : a.status === "Cancelada" ? "gris" : "ambar"}>{String(a.status)}</Etiqueta></li>))}</ul>;
}
function Linea({ id }: { id: string }) {
  const filtro = useCallback((q: any) => q.eq("archived", false), []); // eslint-disable-line @typescript-eslint/no-explicit-any
  const { filas, error } = useLista("timeline_events", "id,event_type,description,occurred_at", id, "occurred_at", filtro);
  if (error) return <Falla />;
  if (!filas) return <Cargando />;
  if (!filas.length) return <Vacio titulo="Aún no hay eventos" detalle="Notas, actividades y cambios de estado se registran aquí solos." />;
  return <ol>{filas.map((e) => (
    <li key={e.id} className="mb-3 border-l-2 border-brand pl-3"><div className="text-sm font-semibold">{String(e.description)}</div><div className="text-xs text-muted">{fechaHora(String(e.occurred_at))} · {String(e.event_type)}</div></li>))}</ol>;
}
function Notas({ id, onNota }: { id: string; onNota: () => void }) {
  const avisar = useToast();
  const filtro = useCallback((q: any) => q.eq("archived", false), []); // eslint-disable-line @typescript-eslint/no-explicit-any
  const { filas, error, recargar } = useLista("notes", "id,body,created_at", id, "created_at", filtro);
  const [texto, setTexto] = useState("");
  const [guardando, setGuardando] = useState(false);
  const guardar = async () => {
    if (!texto.trim()) return avisar("Escribe la nota antes de guardar.", "error");
    setGuardando(true);
    const { error: e } = await supabase.from("notes").insert({ contact_id: id, body: texto.trim() });
    setGuardando(false);
    if (e) return avisar("No se pudo guardar la nota.", "error");
    setTexto(""); avisar("Nota guardada."); await recargar(); onNota();
  };
  return (
    <>
      <Campo label="Nueva nota"><textarea className={`${campo} h-24 py-2`} value={texto} onChange={(e) => setTexto(e.target.value)} /></Campo>
      <div className="my-2"><Boton variante="principal" cargando={guardando} onClick={guardar}>Guardar nota</Boton></div>
      {error ? <Falla /> : !filas ? <Cargando /> : filas.length === 0 ? <Vacio titulo="Sin notas" detalle="Anota lo que conversaste para no depender de la memoria." /> :
        <ul className="grid gap-2">{filas.map((n) => <li key={n.id} className="rounded-md border border-line p-2 text-sm"><div>{String(n.body)}</div><div className="mt-1 text-xs text-muted">{fechaHora(String(n.created_at))}</div></li>)}</ul>}
    </>
  );
}
function Perfil({ id, avisar }: { id: string; avisar: (m: string, t?: "ok" | "error") => void }) {
  const vacio = { operation: "Venta", property_type: "", zones: "", budget_min_usd: "", budget_max_usd: "", bedrooms: "", payment_method: "Contado", urgency_days: "" };
  const [f, setF] = useState(vacio);
  const [listo, setListo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof typeof vacio, v: string) => setF((p) => ({ ...p, [k]: v }));
  useEffect(() => {
    supabase.from("search_profiles").select("*").eq("contact_id", id).maybeSingle().then(({ data }) => {
      if (data) setF({ operation: data.operation ?? "Venta", property_type: data.property_type ?? "", zones: data.zones ?? "", budget_min_usd: data.budget_min_usd?.toString() ?? "", budget_max_usd: data.budget_max_usd?.toString() ?? "", bedrooms: data.bedrooms?.toString() ?? "", payment_method: data.payment_method ?? "Contado", urgency_days: data.urgency_days?.toString() ?? "" });
      setListo(true);
    });
  }, [id]);
  const num = (v: string) => (v === "" ? null : Number(v));
  const guardar = async () => {
    const min = num(f.budget_min_usd), max = num(f.budget_max_usd);
    if (min !== null && max !== null && max < min) return avisar("El presupuesto máximo no puede ser menor al mínimo.", "error");
    setGuardando(true);
    const { error: e } = await supabase.from("search_profiles").upsert({ contact_id: id, operation: f.operation, property_type: f.property_type || null, zones: f.zones || null, budget_min_usd: min, budget_max_usd: max, bedrooms: num(f.bedrooms), payment_method: f.payment_method, urgency_days: num(f.urgency_days), updated_at: new Date().toISOString() });
    setGuardando(false);
    avisar(e ? "No se pudo guardar el perfil." : "Perfil de búsqueda guardado.", e ? "error" : "ok");
  };
  if (!listo) return <Cargando />;
  return (
    <div className="grid gap-3">
      <Campo label="Operación"><select className={campo} value={f.operation} onChange={(e) => set("operation", e.target.value)}><option>Venta</option><option>Alquiler</option><option>Anticretico</option></select></Campo>
      <Campo label="Tipo de propiedad"><input className={campo} value={f.property_type} onChange={(e) => set("property_type", e.target.value)} placeholder="Departamento, casa, terreno…" /></Campo>
      <Campo label="Zonas"><input className={campo} value={f.zones} onChange={(e) => set("zones", e.target.value)} placeholder="Sirari, Cota Cota…" /></Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="Presupuesto mín. USD"><input type="number" min={0} className={campo} value={f.budget_min_usd} onChange={(e) => set("budget_min_usd", e.target.value)} /></Campo>
        <Campo label="Presupuesto máx. USD"><input type="number" min={0} className={campo} value={f.budget_max_usd} onChange={(e) => set("budget_max_usd", e.target.value)} /></Campo>
        <Campo label="Dormitorios"><input type="number" min={0} className={campo} value={f.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} /></Campo>
        <Campo label="Urgencia (días)"><input type="number" min={0} className={campo} value={f.urgency_days} onChange={(e) => set("urgency_days", e.target.value)} /></Campo>
      </div>
      <Campo label="Forma de pago"><select className={campo} value={f.payment_method} onChange={(e) => set("payment_method", e.target.value)}><option>Contado</option><option>Credito</option><option>Anticretico</option></select></Campo>
      <Boton variante="principal" cargando={guardando} onClick={guardar}>Guardar perfil</Boton>
    </div>
  );
}
