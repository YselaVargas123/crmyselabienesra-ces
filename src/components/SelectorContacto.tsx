import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { Campo, campo } from "./ui";

export interface ContactoMin { id: string; first_name: string; last_name: string; whatsapp: string | null }
const nombre = (c: ContactoMin) => `${c.first_name} ${c.last_name}`.trim();

interface Props { label: string; valor: ContactoMin | null; onChange: (c: ContactoMin | null) => void; requerido?: boolean; error?: string }

/** Buscador de contactos por nombre o WhatsApp. */
export default function SelectorContacto({ label, valor, onChange, requerido, error }: Props) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState<ContactoMin[]>([]);

  useEffect(() => {
    const t = q.trim().replace(/[,()%]/g, "");
    if (t.length < 2) { setRes([]); return; }
    const id = setTimeout(async () => {
      const { data } = await supabase.from("contacts").select("id,first_name,last_name,whatsapp")
        .eq("archived", false).or(`first_name.ilike.%${t}%,last_name.ilike.%${t}%,whatsapp.ilike.%${t}%`).limit(6);
      setRes((data ?? []) as ContactoMin[]);
    }, 300);
    return () => clearTimeout(id);
  }, [q]);

  if (valor) {
    return (
      <Campo label={label} requerido={requerido} error={error}>
        <div className="flex min-h-[44px] items-center justify-between rounded-md border-[1.5px] border-muted px-3">
          <span className="font-semibold">{nombre(valor)}{valor.whatsapp ? ` · ${valor.whatsapp}` : ""}</span>
          <button type="button" aria-label="Quitar contacto" onClick={() => onChange(null)} className="p-2 text-muted"><X size={16} /></button>
        </div>
      </Campo>
    );
  }
  return (
    <Campo label={label} requerido={requerido} error={error}>
      <input className={campo} placeholder="Escribe nombre o WhatsApp…" value={q} onChange={(e) => setQ(e.target.value)} />
      {res.length > 0 && (
        <ul className="mt-1 overflow-hidden rounded-md border border-line bg-card">
          {res.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => { onChange(c); setQ(""); setRes([]); }} className="flex min-h-[44px] w-full items-center justify-between px-3 text-left text-sm hover:bg-head">
                <span className="font-semibold">{nombre(c)}</span><span className="text-muted">{c.whatsapp ?? ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Campo>
  );
}
