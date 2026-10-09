import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { TIPOS_ACTIVIDAD } from "../lib/types";
import { Boton, Campo, campo } from "./ui";
import Modal from "./Modal";
import SelectorContacto, { type ContactoMin } from "./SelectorContacto";
import { useToast } from "./Toast";

interface Props { contactoId?: string; contactoNombre?: string; onClose: () => void; onGuardado: () => void }
interface OpMin { id: string; title: string }

/** Si recibe contactoId, la actividad es de ese contacto; si no, deja elegir uno (opcional). */
export default function ActividadForm({ contactoId, contactoNombre, onClose, onGuardado }: Props) {
  const avisar = useToast();
  const manana = new Date(Date.now() + 86_400_000);
  const [f, setF] = useState({ title: "", activity_type: "Seguimiento", fecha: manana.toISOString().slice(0, 10), hora: "10:00", priority: "Media", opportunity_id: "" });
  const [contacto, setContacto] = useState<ContactoMin | null>(null);
  const [ops, setOps] = useState<OpMin[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const idContacto = contactoId ?? contacto?.id ?? null;

  useEffect(() => {
    setF((p) => ({ ...p, opportunity_id: "" }));
    if (!idContacto) { setOps([]); return; }
    supabase.from("opportunities").select("id,title").eq("contact_id", idContacto).eq("status", "abierta").order("created_at", { ascending: false })
      .then(({ data }) => setOps((data ?? []) as OpMin[]));
  }, [idContacto]);

  const guardar = async () => {
    if (!f.title.trim()) return setError("Escribe qué hay que hacer.");
    if (!f.fecha || !f.hora) return setError("Elige fecha y hora.");
    setError(null); setGuardando(true);
    const { error: e } = await supabase.from("activities").insert({
      title: f.title.trim(), activity_type: f.activity_type, due_at: new Date(`${f.fecha}T${f.hora}`).toISOString(),
      priority: f.priority, contact_id: idContacto, opportunity_id: f.opportunity_id || null,
    });
    setGuardando(false);
    if (e) return avisar("No se pudo guardar la actividad.", "error");
    avisar("Actividad agendada.");
    onGuardado();
  };
  return (
    <Modal titulo={contactoNombre ? `Nueva actividad · ${contactoNombre}` : "Nueva actividad"} onClose={onClose}>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <Campo label="¿Qué hay que hacer?" requerido error={error ?? undefined}><input className={campo} value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus /></Campo>
        <Campo label="Tipo"><select className={campo} value={f.activity_type} onChange={(e) => set("activity_type", e.target.value)}>{TIPOS_ACTIVIDAD.map((t) => <option key={t}>{t}</option>)}</select></Campo>
        <div className="grid grid-cols-2 gap-3">
          <Campo label="Fecha"><input type="date" className={campo} value={f.fecha} onChange={(e) => set("fecha", e.target.value)} /></Campo>
          <Campo label="Hora"><input type="time" className={campo} value={f.hora} onChange={(e) => set("hora", e.target.value)} /></Campo>
        </div>
        <Campo label="Prioridad"><select className={campo} value={f.priority} onChange={(e) => set("priority", e.target.value)}><option>Alta</option><option>Media</option><option>Baja</option></select></Campo>
        {!contactoId && <SelectorContacto label="Contacto (opcional)" valor={contacto} onChange={setContacto} />}
        {ops.length > 0 && (
          <Campo label="Oportunidad (opcional)">
            <select className={campo} value={f.opportunity_id} onChange={(e) => set("opportunity_id", e.target.value)}>
              <option value="">Sin oportunidad</option>{ops.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
            </select>
          </Campo>
        )}
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-line px-5 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <Boton variante="texto" onClick={onClose}>Cancelar</Boton>
        <Boton variante="principal" cargando={guardando} onClick={guardar}>Guardar actividad</Boton>
      </div>
    </Modal>
  );
}
