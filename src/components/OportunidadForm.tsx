import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { OPERACIONES, type Etapa } from "../lib/types";
import { Boton, Campo, campo } from "./ui";
import Modal from "./Modal";
import SelectorContacto, { type ContactoMin } from "./SelectorContacto";
import { useToast } from "./Toast";

interface Props { pipelineId: string; etapaInicial: Etapa; contactoInicial?: ContactoMin | null; onClose: () => void; onGuardado: () => void }
interface PropMin { id: string; title: string; price_usd: number }

export default function OportunidadForm({ pipelineId, etapaInicial, contactoInicial = null, onClose, onGuardado }: Props) {
  const avisar = useToast();
  const [contacto, setContacto] = useState<ContactoMin | null>(contactoInicial);
  const [f, setF] = useState({ title: "", operation_type: "Venta", amount_usd: "", expected_close: "", property_id: "", notes: "" });
  const [props, setProps] = useState<PropMin[]>([]);
  const [errores, setErrores] = useState<{ contacto?: string; titulo?: string; monto?: string }>({});
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    supabase.from("properties").select("id,title,price_usd").eq("status", "Disponible").order("title").limit(200)
      .then(({ data }) => setProps((data ?? []) as PropMin[]));
  }, []);

  const guardar = async () => {
    const e: typeof errores = {};
    if (!contacto) e.contacto = "Elige el contacto de esta oportunidad.";
    if (!f.title.trim()) e.titulo = "Escribe un título corto, por ejemplo «Casa Equipetrol».";
    const monto = f.amount_usd === "" ? 0 : Number(f.amount_usd);
    if (Number.isNaN(monto) || monto < 0) e.monto = "El monto debe ser un número positivo.";
    setErrores(e);
    if (Object.keys(e).length || !contacto) return;

    setGuardando(true);
    const uid = (await supabase.auth.getUser()).data.user?.id;
    const payload: Record<string, unknown> = {
      contact_id: contacto.id, pipeline_id: pipelineId, stage_id: etapaInicial.id, operation_type: f.operation_type,
      title: f.title.trim(), amount_usd: monto, probability: etapaInicial.probability, status: "abierta",
      expected_close: f.expected_close || null, notes: f.notes || null, owner_id: uid,
    };
    if (f.property_id) payload.property_id = f.property_id;
    const { data, error } = await supabase.from("opportunities").insert(payload).select("id").single();
    if (error || !data) { setGuardando(false); avisar("No se pudo crear la oportunidad. Inténtalo de nuevo.", "error"); return; }
    await supabase.from("timeline_events").insert({
      contact_id: contacto.id, opportunity_id: data.id, event_type: "oportunidad_creada",
      description: `Nueva oportunidad «${f.title.trim()}» en la etapa «${etapaInicial.name}»`, origin: "sistema",
    });
    setGuardando(false);
    avisar("Oportunidad creada.");
    onGuardado();
  };

  return (
    <Modal titulo="Nueva oportunidad" onClose={onClose}>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <SelectorContacto label="Contacto" requerido valor={contacto} onChange={setContacto} error={errores.contacto} />
        <Campo label="Título" requerido error={errores.titulo}><input className={campo} value={f.title} onChange={(e) => set("title", e.target.value)} /></Campo>
        <fieldset><legend className="text-sm font-semibold">Operación</legend>
          <div className="mt-1 flex flex-wrap gap-2">{OPERACIONES.map((o) => (
            <button type="button" key={o} aria-pressed={f.operation_type === o} onClick={() => set("operation_type", o)}
              className={`min-h-[40px] rounded-full border px-3 text-sm font-semibold ${f.operation_type === o ? "border-brand bg-brand text-white" : "border-line text-muted"}`}>{o === "Anticretico" ? "Anticrético" : o}</button>))}</div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Monto estimado (USD)" error={errores.monto}><input className={campo} inputMode="decimal" value={f.amount_usd} onChange={(e) => set("amount_usd", e.target.value)} /></Campo>
          <Campo label="Cierre esperado"><input type="date" className={campo} value={f.expected_close} onChange={(e) => set("expected_close", e.target.value)} /></Campo>
        </div>
        <Campo label="Propiedad (opcional)">
          <select className={campo} value={f.property_id} onChange={(e) => set("property_id", e.target.value)}>
            <option value="">Sin propiedad asociada</option>{props.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </Campo>
        <Campo label="Notas"><textarea className={`${campo} h-20 py-2`} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Campo>
        <p className="text-xs text-muted">Se crea en la etapa «{etapaInicial.name}».</p>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-line bg-card px-5 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <Boton variante="texto" onClick={onClose}>Cancelar</Boton>
        <Boton variante="principal" cargando={guardando} onClick={guardar}>Crear oportunidad</Boton>
      </div>
    </Modal>
  );
}
