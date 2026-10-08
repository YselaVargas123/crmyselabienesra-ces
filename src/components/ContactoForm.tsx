import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { supabase } from "../lib/supabase";
import { normalizaTel } from "../lib/format";
import { TIPOS, nombreCompleto, type Contacto, type Opcion } from "../lib/types";
import { Boton, Campo, campo } from "./ui";
import Modal from "./Modal";
import { useToast } from "./Toast";

interface Props { contacto?: Contacto | null; onClose: () => void; onGuardado: (id: string) => void; onVer: (id: string) => void }
type Errores = Partial<Record<"nombre" | "whatsapp" | "origen" | "email" | "telefono", string>>;

export default function ContactoForm({ contacto, onClose, onGuardado, onVer }: Props) {
  const avisar = useToast();
  const [f, setF] = useState({
    first_name: contacto?.first_name ?? "", last_name: contacto?.last_name ?? "", whatsapp: contacto?.whatsapp ?? "",
    source_id: contacto?.source_id ?? "", contact_type: contacto?.contact_type ?? "Comprador",
    city: contacto?.city ?? "", document_id: contacto?.document_id ?? "", email: contacto?.email ?? "",
    phone: contacto?.phone ?? "", address: contacto?.address ?? "", birth_date: contacto?.birth_date ?? "", notes: contacto?.notes ?? "",
  });
  const [origenes, setOrigenes] = useState<Opcion[]>([]);
  const [masDatos, setMasDatos] = useState(Boolean(contacto));
  const [errores, setErrores] = useState<Errores>({});
  const [duplicados, setDuplicados] = useState<Contacto[]>([]);
  const [ignorarDup, setIgnorarDup] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    supabase.from("lead_sources").select("id,name").eq("active", true).order("sort_order").then(({ data }) => setOrigenes((data ?? []) as Opcion[]));
  }, []);

  // Detección de duplicados mientras se escribe (por WhatsApp o por nombre y apellido).
  useEffect(() => {
    const wa = normalizaTel(f.whatsapp);
    const nom = f.first_name.trim(), ape = f.last_name.trim();
    if (!wa && !(nom.length > 2 && ape.length > 2)) { setDuplicados([]); return; }
    const t = setTimeout(async () => {
      const limpio = (s: string) => s.replace(/[,()%]/g, "");
      const reglas: string[] = [];
      if (wa) reglas.push(`whatsapp.eq.${wa}`);
      if (nom.length > 2 && ape.length > 2) reglas.push(`and(first_name.ilike.${limpio(nom)},last_name.ilike.${limpio(ape)})`);
      let q = supabase.from("contacts").select("*").eq("archived", false).or(reglas.join(",")).limit(3);
      if (contacto) q = q.neq("id", contacto.id);
      const { data } = await q;
      setDuplicados((data ?? []) as Contacto[]);
    }, 400);
    return () => clearTimeout(t);
  }, [f.whatsapp, f.first_name, f.last_name, contacto]);

  const guardar = async () => {
    const e: Errores = {};
    if (!f.first_name.trim()) e.nombre = "Escribe el nombre.";
    const wa = normalizaTel(f.whatsapp);
    if (!wa) e.whatsapp = "Número boliviano de 8 dígitos, por ejemplo 7712 3456.";
    if (!f.source_id) e.origen = "Elige de dónde llegó este contacto.";
    if (f.email && !/^\S+@\S+\.\S+$/.test(f.email)) e.email = "El correo no es válido.";
    if (f.phone && !normalizaTel(f.phone)) e.telefono = "Teléfono de 8 dígitos.";
    setErrores(e);
    if (Object.keys(e).length) return;
    if (duplicados.length && !ignorarDup) { avisar("Revisa el posible duplicado antes de guardar.", "error"); return; }

    setGuardando(true);
    const payload = {
      first_name: f.first_name.trim(), last_name: f.last_name.trim(), whatsapp: wa, phone: f.phone ? normalizaTel(f.phone) : null,
      source_id: f.source_id, contact_type: f.contact_type, city: f.city || null, document_id: f.document_id || null,
      email: f.email || null, address: f.address || null, birth_date: f.birth_date || null, notes: f.notes || null,
    };
    const res = contacto
      ? await supabase.from("contacts").update(payload).eq("id", contacto.id).select("id").single()
      : await supabase.from("contacts").insert({ ...payload, owner_id: (await supabase.auth.getUser()).data.user?.id }).select("id").single();
    setGuardando(false);
    if (res.error || !res.data) { avisar("No se pudo guardar el contacto. Inténtalo de nuevo.", "error"); return; }
    avisar(contacto ? "Contacto actualizado." : "Contacto guardado.");
    onGuardado(res.data.id as string);
  };

  return (
    <Modal titulo={contacto ? "Editar contacto" : "Nuevo contacto"} onClose={onClose}>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Nombre" requerido error={errores.nombre}><input className={campo} value={f.first_name} onChange={(e) => set("first_name", e.target.value)} autoFocus /></Campo>
          <Campo label="Apellido"><input className={campo} value={f.last_name} onChange={(e) => set("last_name", e.target.value)} /></Campo>
        </div>
        <Campo label="WhatsApp" requerido error={errores.whatsapp}><input className={campo} inputMode="tel" placeholder="7712 3456" value={f.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></Campo>
        {duplicados.length > 0 && (
          <div role="alert" className="rounded-md border border-amber-800/40 bg-amber-100 p-3 text-sm text-amber-900">
            <div className="font-bold">▲ Posible duplicado</div>
            {duplicados.map((d) => (
              <div key={d.id} className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <span>{nombreCompleto(d)} · {d.whatsapp}</span>
                <Boton variante="secundario" onClick={() => onVer(d.id)}>Ver contacto</Boton>
              </div>
            ))}
            <label className="mt-2 flex min-h-[44px] items-center gap-2 font-semibold"><input type="checkbox" checked={ignorarDup} onChange={(e) => setIgnorarDup(e.target.checked)} className="h-5 w-5" />Crear de todos modos</label>
          </div>
        )}
        <Campo label="Origen" requerido error={errores.origen}>
          <select className={campo} value={f.source_id} onChange={(e) => set("source_id", e.target.value)}>
            <option value="">Elige un origen…</option>{origenes.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
        </Campo>
        <fieldset><legend className="text-sm font-semibold">Tipo</legend>
          <div className="mt-1 flex flex-wrap gap-2">{TIPOS.map((t) => (
            <button type="button" key={t} aria-pressed={f.contact_type === t} onClick={() => set("contact_type", t)}
              className={`min-h-[40px] rounded-full border px-3 text-sm font-semibold ${f.contact_type === t ? "border-brand bg-brand text-white" : "border-line text-muted"}`}>{t}</button>))}</div>
        </fieldset>
        <button type="button" onClick={() => setMasDatos((m) => !m)} aria-expanded={masDatos} className="flex min-h-[44px] w-full items-center justify-between rounded-md border-[1.5px] border-dashed border-muted px-3 text-sm font-semibold">
          Más datos (opcional)<ChevronDown size={16} className={masDatos ? "rotate-180" : ""} />
        </button>
        {masDatos && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Ciudad"><input className={campo} value={f.city} onChange={(e) => set("city", e.target.value)} /></Campo>
            <Campo label="CI / NIT"><input className={campo} value={f.document_id} onChange={(e) => set("document_id", e.target.value)} /></Campo>
            <Campo label="Correo" error={errores.email}><input type="email" className={campo} value={f.email} onChange={(e) => set("email", e.target.value)} /></Campo>
            <Campo label="Teléfono fijo o alterno" error={errores.telefono}><input className={campo} inputMode="tel" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></Campo>
            <Campo label="Dirección"><input className={campo} value={f.address} onChange={(e) => set("address", e.target.value)} /></Campo>
            <Campo label="Fecha de nacimiento"><input type="date" className={campo} value={f.birth_date} onChange={(e) => set("birth_date", e.target.value)} /></Campo>
            <div className="sm:col-span-2"><Campo label="Notas"><textarea className={`${campo} h-24 py-2`} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Campo></div>
          </div>
        )}
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-line bg-card px-5 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <Boton variante="texto" onClick={onClose}>Cancelar</Boton>
        <Boton variante="principal" cargando={guardando} onClick={guardar}>Guardar contacto</Boton>
      </div>
    </Modal>
  );
}
