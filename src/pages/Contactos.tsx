import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Plus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { descargarCsv } from "../lib/csv";
import { hace } from "../lib/format";
import { ESTADOS, TIPOS, nombreCompleto, type Contacto, type Opcion } from "../lib/types";
import { Avatar, Boton, Etiqueta, TelefonoChip, Vacio, campo } from "../components/ui";
import ContactoForm from "../components/ContactoForm";
import FichaContacto from "../components/FichaContacto";
import Modal from "../components/Modal";
import { useToast } from "../components/Toast";

interface Filtros { estado: string; tipo: string; origen: string; sinAtender: boolean; q: string }
const LIBRE: Filtros = { estado: "Todos", tipo: "", origen: "", sinAtender: false, q: "" };
interface Vista { id: string; name: string; filters: Filtros }
const BASE: Vista[] = [
  { id: "todos", name: "Todos", filters: LIBRE },
  { id: "sin", name: "Leads sin atender", filters: { ...LIBRE, estado: "Lead activo", sinAtender: true } },
  { id: "prop", name: "Propietarios", filters: { ...LIBRE, tipo: "Propietario" } },
];
const tonoEstado = (s: string) => (s === "Cliente" ? "verde" : s === "Lead activo" ? "azul" : "gris") as "verde" | "azul" | "gris";

export default function Contactos() {
  const avisar = useToast();
  const [params, setParams] = useSearchParams();
  const fichaId = params.get("ficha");
  const [lista, setLista] = useState<Contacto[] | null>(null);
  const [origenes, setOrigenes] = useState<Opcion[]>([]);
  const [equipo, setEquipo] = useState<Opcion[]>([]);
  const [vistas, setVistas] = useState<Vista[]>([]);
  const [fil, setFil] = useState<Filtros>(LIBRE);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [error, setError] = useState(false);
  const [form, setForm] = useState<{ editar: Contacto | null } | null>(null);
  const [guardarVista, setGuardarVista] = useState(false);
  const [nombreVista, setNombreVista] = useState("");

  const abrirFicha = (id: string | null) => { const p = new URLSearchParams(params); if (id) p.set("ficha", id); else p.delete("ficha"); setParams(p); };

  const cargar = useCallback(async () => {
    const { data, error: e } = await supabase.from("contacts")
      .select("*, source:lead_sources(name), owner:profiles!contacts_owner_id_fkey(full_name)")
      .eq("archived", false).order("created_at", { ascending: false }).limit(1000);
    if (e) { setError(true); setLista([]); return; }
    setError(false); setLista((data ?? []) as unknown as Contacto[]);
  }, []);
  useEffect(() => {
    void cargar();
    supabase.from("lead_sources").select("id,name").eq("active", true).order("sort_order").then(({ data }) => setOrigenes((data ?? []) as Opcion[]));
    supabase.from("profiles").select("id,name:full_name").eq("active", true).then(({ data }) => setEquipo((data ?? []) as Opcion[]));
    supabase.from("saved_views").select("id,name,filters").eq("scope", "contactos").order("created_at").then(({ data }) => setVistas((data ?? []) as Vista[]));
  }, [cargar]);

  const visibles = useMemo(() => (lista ?? []).filter((c) => {
    if (fil.estado !== "Todos" && c.status !== fil.estado) return false;
    if (fil.tipo && c.contact_type !== fil.tipo) return false;
    if (fil.origen && c.source_id !== fil.origen) return false;
    if (fil.sinAtender && c.last_interaction_at) return false;
    const q = fil.q.trim().toLowerCase();
    return !q || `${nombreCompleto(c)} ${c.whatsapp ?? ""} ${c.email ?? ""}`.toLowerCase().includes(q);
  }), [lista, fil]);
  const cuenta = (e: string) => (e === "Todos" ? lista?.length : lista?.filter((c) => c.status === e).length) ?? 0;

  const marcados = visibles.filter((c) => sel.has(c.id));
  const alternar = (id: string) => setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const todos = visibles.length > 0 && visibles.every((c) => sel.has(c.id));

  const exportar = (filas: Contacto[]) => descargarCsv("contactos.csv", filas.map((c) => ({
    Nombre: c.first_name, Apellido: c.last_name, WhatsApp: c.whatsapp, Telefono: c.phone, Correo: c.email, "CI/NIT": c.document_id, Ciudad: c.city,
    Tipo: c.contact_type, Estado: c.status, Origen: c.source?.name, Responsable: c.owner?.full_name, "Ultima interaccion": c.last_interaction_at ?? "" })));

  const masivo = async (cambio: Record<string, unknown>, mensaje: string) => {
    const ids = marcados.map((c) => c.id);
    const { error: e } = await supabase.from("contacts").update(cambio).in("id", ids);
    if (e) return avisar("No se pudo aplicar el cambio.", "error");
    avisar(mensaje); setSel(new Set()); await cargar();
  };
  const archivar = async () => {
    if (!window.confirm(`¿Archivar ${marcados.length} contacto(s)? No se borran: dejan de aparecer en la lista y su historial se conserva.`)) return;
    await masivo({ archived: true }, "Contactos archivados.");
  };
  const guardarVistaActual = async () => {
    if (!nombreVista.trim()) return avisar("Ponle un nombre a la vista.", "error");
    const { data, error: e } = await supabase.from("saved_views").insert({ scope: "contactos", name: nombreVista.trim(), filters: fil }).select("id,name,filters").single();
    if (e || !data) return avisar("No se pudo guardar la vista.", "error");
    setVistas((v) => [...v, data as Vista]); setGuardarVista(false); setNombreVista(""); avisar("Vista guardada.");
  };

  const pildora = (activo: boolean) => `min-h-[36px] whitespace-nowrap rounded-full border px-3 text-sm font-semibold ${activo ? "border-brand bg-blue-100 text-brand dark:bg-blue-950 dark:text-blue-200" : "border-line text-muted"}`;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">Contactos</h1>
        <div className="flex gap-2">
          <Boton onClick={() => exportar(visibles)} disabled={!visibles.length}><Download size={15} />Exportar CSV</Boton>
          <Boton variante="principal" onClick={() => setForm({ editar: null })}><Plus size={15} />Nuevo contacto</Boton>
        </div>
      </div>
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        {[...BASE, ...vistas].map((v) => <button key={v.id} onClick={() => setFil(v.filters)} className={pildora(JSON.stringify(v.filters) === JSON.stringify(fil))}>{v.name}</button>)}
        <button onClick={() => setGuardarVista(true)} className="min-h-[36px] whitespace-nowrap px-2 text-sm font-semibold text-brand dark:text-blue-300">+ Guardar vista actual</button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {["Todos", ...ESTADOS].map((e) => <button key={e} onClick={() => setFil({ ...fil, estado: e })} className={pildora(fil.estado === e)}>{e} {cuenta(e)}</button>)}
        <select aria-label="Filtrar por tipo" className={`${campo} !h-9 !w-auto`} value={fil.tipo} onChange={(e) => setFil({ ...fil, tipo: e.target.value })}><option value="">Tipo: todos</option>{TIPOS.map((t) => <option key={t}>{t}</option>)}</select>
        <select aria-label="Filtrar por origen" className={`${campo} !h-9 !w-auto`} value={fil.origen} onChange={(e) => setFil({ ...fil, origen: e.target.value })}><option value="">Origen: todos</option>{origenes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
        <input aria-label="Buscar en la lista" placeholder="Buscar en la lista…" className={`${campo} !h-9 !w-48`} value={fil.q} onChange={(e) => setFil({ ...fil, q: e.target.value })} />
      </div>
      {marcados.length > 0 && (
        <div role="region" aria-label="Acciones sobre la selección" className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-brand/40 bg-blue-50 p-2 text-sm dark:bg-blue-950">
          <b>{marcados.length} seleccionado(s)</b>
          <select aria-label="Asignar responsable" className={`${campo} !h-9 !w-auto`} value="" onChange={(e) => e.target.value && masivo({ owner_id: e.target.value }, "Responsable asignado.")}><option value="">Asignar responsable…</option>{equipo.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
          <select aria-label="Cambiar estado" className={`${campo} !h-9 !w-auto`} value="" onChange={(e) => e.target.value && masivo({ status: e.target.value }, "Estado actualizado.")}><option value="">Cambiar estado…</option>{ESTADOS.map((s) => <option key={s}>{s}</option>)}</select>
          <Boton onClick={() => exportar(marcados)}>Exportar selección</Boton>
          <button onClick={archivar} className="min-h-[36px] rounded-md border-[1.5px] border-danger px-3 text-sm font-bold text-danger">Archivar</button>
        </div>
      )}
      {error && <p role="alert" className="mb-2 text-sm font-semibold text-danger">! No se pudieron cargar los contactos. <button className="underline" onClick={cargar}>Reintentar</button></p>}
      <div className={`grid gap-4 ${fichaId ? "lg:grid-cols-[1fr_380px]" : ""}`}>
        <div className="overflow-x-auto rounded-xl border border-line bg-card">
          {lista === null ? <div className="space-y-2 p-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-head" />)}</div> :
            visibles.length === 0 ? <div className="p-4"><Vacio titulo={lista.length ? "Ningún contacto coincide con estos filtros" : "Todavía no hay contactos"} detalle={lista.length ? "Prueba quitando algún filtro." : "Crea el primero con el botón + Nuevo contacto."} /></div> : (
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-head text-left text-[13px] text-muted"><tr>
                  <th className="w-10 px-3 py-2"><input type="checkbox" aria-label="Seleccionar todos" className="h-4 w-4" checked={todos} onChange={() => setSel(todos ? new Set() : new Set(visibles.map((c) => c.id)))} /></th>
                  {["Nombre", "Teléfono · WhatsApp", "Tipo", "Estado", "Origen", "Resp.", "Última interacción"].map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
                <tbody>{visibles.map((c) => (
                  <tr key={c.id} className={`border-t border-line ${fichaId === c.id ? "bg-blue-50 dark:bg-blue-950" : ""}`}>
                    <td className="px-3"><input type="checkbox" aria-label={`Seleccionar ${nombreCompleto(c)}`} className="h-4 w-4" checked={sel.has(c.id)} onChange={() => alternar(c.id)} /></td>
                    <td className="px-3 py-2"><button onClick={() => abrirFicha(c.id)} className="text-left font-semibold underline-offset-2 hover:underline">{nombreCompleto(c)}</button></td>
                    <td className="px-3"><TelefonoChip tel={c.whatsapp ?? c.phone} nombre={nombreCompleto(c)} /></td>
                    <td className="px-3">{c.contact_type}</td>
                    <td className="px-3"><Etiqueta tono={tonoEstado(c.status)}>{c.status}</Etiqueta></td>
                    <td className="px-3">{c.source?.name ?? "—"}</td>
                    <td className="px-3">{c.owner ? <span title={c.owner.full_name}><Avatar nombre={c.owner.full_name} /></span> : "—"}</td>
                    <td className="px-3 text-muted">{hace(c.last_interaction_at)}</td>
                  </tr>))}</tbody>
                <tfoot><tr className="border-t border-line text-xs text-muted"><td colSpan={8} className="px-3 py-2">{visibles.length} de {lista.length} contactos</td></tr></tfoot>
              </table>)}
        </div>
        {fichaId && <FichaContacto id={fichaId} onClose={() => abrirFicha(null)} onEditar={(c) => setForm({ editar: c })} />}
      </div>
      {form && <ContactoForm contacto={form.editar} onClose={() => setForm(null)} onVer={(id) => { setForm(null); abrirFicha(id); }} onGuardado={(id) => { setForm(null); void cargar(); abrirFicha(id); }} />}
      {guardarVista && (
        <Modal titulo="Guardar vista actual" onClose={() => setGuardarVista(false)}>
          <div className="px-5 py-4"><label className="block text-sm font-semibold">Nombre de la vista<input className={`${campo} mt-1`} value={nombreVista} onChange={(e) => setNombreVista(e.target.value)} autoFocus /></label></div>
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3"><Boton variante="texto" onClick={() => setGuardarVista(false)}>Cancelar</Boton><Boton variante="principal" onClick={guardarVistaActual}>Guardar vista</Boton></div>
        </Modal>)}
    </>
  );
}
