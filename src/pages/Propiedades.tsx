import { useCallback, useEffect, useMemo, useState } from "react";
import { BedDouble, Bath, ExternalLink, Maximize, Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { usd } from "../lib/format";
import { ESTADOS_PROPIEDAD, OPERACIONES, nombreCompleto, type Propiedad } from "../lib/types";
import { Boton, Etiqueta, Vacio, campo } from "../components/ui";
import PropiedadForm from "../components/PropiedadForm";
import { useToast } from "../components/Toast";

const tonoEstado = (s: string) => (s === "Disponible" ? "verde" : s === "Reservada" ? "ambar" : s === "Retirada" ? "gris" : "azul") as "verde" | "ambar" | "gris" | "azul";

export default function Propiedades() {
  const avisar = useToast();
  const [lista, setLista] = useState<Propiedad[] | null>(null);
  const [error, setError] = useState(false);
  const [form, setForm] = useState<{ editar: Propiedad | null } | null>(null);
  const [fil, setFil] = useState({ estado: "Disponible", operacion: "", q: "" });

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.from("properties")
      .select("*, owner_contact:contacts!owner_contact_id(first_name,last_name)").order("created_at", { ascending: false }).limit(500);
    if (e) { setError(true); setLista([]); return; }
    setError(false); setLista((data ?? []) as unknown as Propiedad[]);
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const visibles = useMemo(() => (lista ?? []).filter((p) => {
    if (fil.estado && p.status !== fil.estado) return false;
    if (fil.operacion && p.operation !== fil.operacion) return false;
    const q = fil.q.trim().toLowerCase();
    return !q || `${p.title} ${p.zone ?? ""} ${p.address ?? ""}`.toLowerCase().includes(q);
  }), [lista, fil]);

  const cambiarEstado = async (p: Propiedad, estado: string) => {
    const { error: e } = await supabase.from("properties").update({ status: estado }).eq("id", p.id);
    if (e) return avisar("No se pudo cambiar el estado.", "error");
    setLista((l) => (l ?? []).map((x) => (x.id === p.id ? { ...x, status: estado } : x)));
    avisar("Estado actualizado.");
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">Propiedades</h1>
        <Boton variante="principal" onClick={() => setForm({ editar: null })}><Plus size={15} />Nueva propiedad</Boton>
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <select aria-label="Filtrar por estado" className={`${campo} !h-9 !w-auto`} value={fil.estado} onChange={(e) => setFil({ ...fil, estado: e.target.value })}><option value="">Estado: todos</option>{ESTADOS_PROPIEDAD.map((s) => <option key={s}>{s}</option>)}</select>
        <select aria-label="Filtrar por operación" className={`${campo} !h-9 !w-auto`} value={fil.operacion} onChange={(e) => setFil({ ...fil, operacion: e.target.value })}><option value="">Operación: todas</option>{OPERACIONES.map((o) => <option key={o} value={o}>{o === "Anticretico" ? "Anticrético" : o}</option>)}</select>
        <input aria-label="Buscar propiedad" placeholder="Buscar por título o zona…" className={`${campo} !h-9 !w-56`} value={fil.q} onChange={(e) => setFil({ ...fil, q: e.target.value })} />
      </div>
      {error && <p role="alert" className="mb-2 text-sm font-semibold text-danger">! No se pudieron cargar las propiedades. ¿Ya ejecutaste el SQL de la Fase 3 en Supabase? <button className="underline" onClick={cargar}>Reintentar</button></p>}
      {lista === null ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-xl bg-head" />)}</div>
      ) : visibles.length === 0 ? (
        <Vacio titulo={lista.length ? "Ninguna propiedad coincide con estos filtros" : "Todavía no hay propiedades"} detalle={lista.length ? "Prueba quitando algún filtro." : "Crea la primera con el botón + Nueva propiedad."} />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {visibles.map((p) => (
            <article key={p.id} className="flex flex-col rounded-xl border border-line bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <button onClick={() => setForm({ editar: p })} className="text-left font-bold leading-tight underline-offset-2 hover:underline">{p.title}</button>
                <Etiqueta tono={tonoEstado(p.status)}>{p.status}</Etiqueta>
              </div>
              <div className="text-xs text-muted">{p.property_type} · {p.operation === "Anticretico" ? "Anticrético" : p.operation}{p.zone ? ` · ${p.zone}` : ""}</div>
              <div className="mt-2 text-lg font-extrabold">{usd(Number(p.price_usd))}</div>
              <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted">
                {p.bedrooms !== null && <span className="inline-flex items-center gap-1"><BedDouble size={14} />{p.bedrooms}</span>}
                {p.bathrooms !== null && <span className="inline-flex items-center gap-1"><Bath size={14} />{p.bathrooms}</span>}
                {p.area_m2 !== null && <span className="inline-flex items-center gap-1"><Maximize size={14} />{p.area_m2} m²</span>}
              </div>
              {p.owner_contact && <div className="mt-2 text-xs">Propietario: <b>{nombreCompleto(p.owner_contact)}</b></div>}
              {p.contract_expires_at && <div className="text-xs text-muted">Contrato vence: {new Date(p.contract_expires_at + "T00:00:00").toLocaleDateString("es-BO")}</div>}
              <div className="mt-3 flex items-center gap-2 pt-1">
                <select aria-label={`Cambiar estado de ${p.title}`} className={`${campo} !h-9 !text-sm`} value={p.status} onChange={(e) => void cambiarEstado(p, e.target.value)}>{ESTADOS_PROPIEDAD.map((s) => <option key={s}>{s}</option>)}</select>
                {p.listing_url && <a href={p.listing_url} target="_blank" rel="noreferrer" aria-label={`Abrir anuncio de ${p.title}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-brand"><ExternalLink size={16} /></a>}
              </div>
            </article>
          ))}
        </div>
      )}
      {form && <PropiedadForm propiedad={form.editar} onClose={() => setForm(null)} onGuardado={() => { setForm(null); void cargar(); }} />}
    </>
  );
}
