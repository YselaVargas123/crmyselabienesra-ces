import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserPlus } from "lucide-react";
import { supabase } from "../lib/supabase";
import { usd } from "../lib/format";
import Modal from "./Modal";
import { campo } from "./ui";

interface Res { contactos: { id: string; first_name: string; last_name: string; whatsapp: string | null }[]; oportunidades: { id: string; title: string; amount_usd: number; contact_id: string }[]; actividades: { id: string; title: string; contact_id: string | null }[] }

export default function Buscador({ onClose, onNuevoContacto }: { onClose: () => void; onNuevoContacto: () => void }) {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [res, setRes] = useState<Res | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    const t = q.trim().replace(/[,()%]/g, "");
    if (t.length < 2) { setRes(null); return; }
    const h = setTimeout(async () => {
      const [c, o, a] = await Promise.all([
        supabase.from("contacts").select("id,first_name,last_name,whatsapp").eq("archived", false).or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,whatsapp.ilike.%${t}%`).limit(5),
        supabase.from("opportunities").select("id,title,amount_usd,contact_id").ilike("title", `%${t}%`).limit(5),
        supabase.from("activities").select("id,title,contact_id").ilike("title", `%${t}%`).limit(5),
      ]);
      if (c.error || o.error || a.error) { setError(true); return; }
      setError(false); setRes({ contactos: c.data ?? [], oportunidades: o.data ?? [], actividades: a.data ?? [] });
    }, 300);
    return () => clearTimeout(h);
  }, [q]);

  const ir = (contactId: string | null) => { onClose(); nav(contactId ? `/contactos?ficha=${contactId}` : "/actividades"); };
  const fila = "flex min-h-[44px] w-full items-center justify-between rounded-md px-2 text-left text-sm hover:bg-head";
  const vacio = res && !res.contactos.length && !res.oportunidades.length && !res.actividades.length;

  return (
    <Modal titulo="Buscar o ejecutar acción" onClose={onClose}>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <div className="relative"><Search size={16} className="absolute left-3 top-3.5 text-muted" />
          <input autoFocus aria-label="Buscar" className={`${campo} pl-9`} placeholder="Nombre, WhatsApp, oportunidad o actividad…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="mt-3">
          <div className="text-xs font-semibold text-muted">Acciones</div>
          <button className={fila} onClick={() => { onClose(); onNuevoContacto(); }}><span className="flex items-center gap-2"><UserPlus size={15} />Crear contacto nuevo</span></button>
          {error && <p role="alert" className="text-sm font-semibold text-danger">! La búsqueda falló. Inténtalo de nuevo.</p>}
          {vacio && <p className="py-3 text-sm text-muted">No se encontró nada para “{q}”.</p>}
          {res && res.contactos.length > 0 && <><div className="mt-2 text-xs font-semibold text-muted">Contactos</div>{res.contactos.map((c) => <button key={c.id} className={fila} onClick={() => ir(c.id)}><span>{c.first_name} {c.last_name}</span><span className="text-xs text-muted">{c.whatsapp}</span></button>)}</>}
          {res && res.oportunidades.length > 0 && <><div className="mt-2 text-xs font-semibold text-muted">Oportunidades</div>{res.oportunidades.map((o) => <button key={o.id} className={fila} onClick={() => ir(o.contact_id)}><span>{o.title}</span><span className="text-xs font-bold text-ok">{usd(o.amount_usd)}</span></button>)}</>}
          {res && res.actividades.length > 0 && <><div className="mt-2 text-xs font-semibold text-muted">Actividades</div>{res.actividades.map((a) => <button key={a.id} className={fila} onClick={() => ir(a.contact_id)}><span>{a.title}</span></button>)}</>}
        </div>
      </div>
    </Modal>
  );
}
