import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { diasHasta, textoDias } from "../lib/actividades";
import { usd } from "../lib/format";
import { Etiqueta, Tarjeta, TelefonoChip, Vacio } from "../components/ui";

type Tipo = "Contratos" | "Cierres" | "Cumpleaños";
interface Item { clave: string; tipo: Tipo; dias: number; titulo: string; detalle: string; enlace: string; tel?: string | null; nombre?: string }

const tono = (n: number) => (n < 0 ? "rojo" : n <= 7 ? "ambar" : "gris") as "rojo" | "ambar" | "gris";
const VENTANA = { Contratos: 60, Cierres: 30, Cumpleaños: 14 } as const;

/** Días hasta el próximo cumpleaños (0 = hoy). */
function diasCumple(fecha: string): number {
  const [, m, d] = fecha.slice(0, 10).split("-").map(Number);
  const hoy = new Date();
  let prox = `${hoy.getFullYear()}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  if (diasHasta(prox) < 0) prox = `${hoy.getFullYear() + 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return diasHasta(prox);
}

export default function Vencimientos() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState(false);
  const [filtro, setFiltro] = useState<"Todos" | Tipo>("Todos");

  const cargar = useCallback(async () => {
    const [p, o, c] = await Promise.all([
      supabase.from("properties").select("id,title,contract_expires_at,status").not("contract_expires_at", "is", null).in("status", ["Disponible", "Reservada"]),
      supabase.from("opportunities").select("id,title,amount_usd,expected_close,contact:contacts(first_name,last_name)").eq("status", "abierta").not("expected_close", "is", null),
      supabase.from("contacts").select("id,first_name,last_name,whatsapp,phone,birth_date").eq("archived", false).not("birth_date", "is", null).limit(2000),
    ]);
    // Si la tabla de propiedades aún no existe, el resto de la pantalla sigue funcionando.
    if (o.error || c.error) { setError(true); setItems([]); return; }
    setError(false);
    const lista: Item[] = [];
    for (const x of (p.error ? [] : p.data ?? []) as { id: string; title: string; contract_expires_at: string }[]) {
      const dias = diasHasta(x.contract_expires_at);
      if (dias <= VENTANA.Contratos) lista.push({ clave: `p${x.id}`, tipo: "Contratos", dias, titulo: x.title, detalle: "Vence el contrato de captación", enlace: "/propiedades" });
    }
    for (const x of (o.data ?? []) as unknown as { id: string; title: string; amount_usd: number; expected_close: string; contact: { first_name: string; last_name: string } | null }[]) {
      const dias = diasHasta(x.expected_close);
      if (dias <= VENTANA.Cierres) lista.push({ clave: `o${x.id}`, tipo: "Cierres", dias, titulo: x.title, detalle: `Cierre esperado · ${usd(Number(x.amount_usd))}${x.contact ? ` · ${`${x.contact.first_name} ${x.contact.last_name}`.trim()}` : ""}`, enlace: "/pipeline" });
    }
    for (const x of (c.data ?? []) as { id: string; first_name: string; last_name: string; whatsapp: string | null; phone: string | null; birth_date: string }[]) {
      const dias = diasCumple(x.birth_date);
      if (dias <= VENTANA.Cumpleaños) {
        const nombre = `${x.first_name} ${x.last_name}`.trim();
        lista.push({ clave: `c${x.id}`, tipo: "Cumpleaños", dias, titulo: nombre, detalle: "Cumpleaños", enlace: `/contactos?ficha=${x.id}`, tel: x.whatsapp ?? x.phone, nombre });
      }
    }
    lista.sort((a, b) => a.dias - b.dias);
    setItems(lista);
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const visibles = useMemo(() => (items ?? []).filter((i) => filtro === "Todos" || i.tipo === filtro), [items, filtro]);
  const cuenta = (t: "Todos" | Tipo) => (t === "Todos" ? items?.length : items?.filter((i) => i.tipo === t).length) ?? 0;
  const pildora = (activo: boolean) => `min-h-[36px] whitespace-nowrap rounded-full border px-3 text-sm font-semibold ${activo ? "border-brand bg-blue-100 text-brand dark:bg-blue-950 dark:text-blue-200" : "border-line text-muted"}`;

  return (
    <>
      <h1 className="text-xl font-extrabold">Vencimientos</h1>
      <p className="mb-3 mt-1 text-sm text-muted">Contratos de captación (60 días), cierres esperados (30 días) y cumpleaños (14 días).</p>
      <div className="mb-3 flex flex-wrap gap-2">
        {(["Todos", "Contratos", "Cierres", "Cumpleaños"] as const).map((t) => <button key={t} aria-pressed={filtro === t} onClick={() => setFiltro(t)} className={pildora(filtro === t)}>{t} {cuenta(t)}</button>)}
      </div>
      {error && <p role="alert" className="mb-2 text-sm font-semibold text-danger">! No se pudieron cargar los vencimientos. <button className="underline" onClick={cargar}>Reintentar</button></p>}
      <Tarjeta>
        {items === null && [0, 1, 2].map((i) => <div key={i} className="mb-2 h-14 animate-pulse rounded-md bg-head" />)}
        {items && visibles.length === 0 && !error && <Vacio titulo="No hay vencimientos próximos" detalle="Cuando cargues fechas de contrato, cierres esperados o cumpleaños, aparecerán aquí." />}
        {visibles.map((i) => (
          <div key={i.clave} className="flex flex-wrap items-center gap-3 border-t border-line py-3 first:border-t-0">
            <div className="min-w-[200px] flex-1">
              <Link to={i.enlace} className="text-sm font-semibold underline-offset-2 hover:underline">{i.titulo}</Link>
              <div className="text-xs text-muted">{i.detalle}</div>
              {i.tipo === "Cumpleaños" && <div className="mt-1"><TelefonoChip tel={i.tel} nombre={i.nombre} /></div>}
            </div>
            <Etiqueta tono={tono(i.dias)}>{textoDias(i.dias)}</Etiqueta>
          </div>
        ))}
      </Tarjeta>
    </>
  );
}
