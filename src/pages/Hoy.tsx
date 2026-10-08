import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { salud, usd } from "../lib/format";
import { Barra, Boton, Etiqueta, Tarjeta, TelefonoChip, Vacio, tonoSalud } from "../components/ui";

interface Fila {
  id: string; title: string; due_at: string; priority: string;
  contact: { first_name: string; last_name: string; whatsapp: string | null; phone: string | null } | null;
  opportunity: { amount_usd: number; last_activity_at: string } | null;
}
interface Panel { vencidas: number; hoy: number; leadsSinAtender: number }

const saludo = () => { const h = new Date().getHours(); return h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches"; };

export default function Hoy() {
  const { perfil } = useAuth();
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [panel, setPanel] = useState<Panel>({ vencidas: 0, hoy: 0, leadsSinAtender: 0 });
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const fin = new Date(); fin.setHours(23, 59, 59, 999);
    const inicio = new Date(); inicio.setHours(0, 0, 0, 0);
    const [act, leads] = await Promise.all([
      supabase.from("activities")
        .select("id,title,due_at,priority,contact:contacts(first_name,last_name,whatsapp,phone),opportunity:opportunities(amount_usd,last_activity_at)")
        .eq("status", "Pendiente").lte("due_at", fin.toISOString()).order("due_at"),
      supabase.from("contacts").select("id", { count: "exact", head: true }).eq("status", "Lead activo").eq("archived", false).is("last_interaction_at", null),
    ]);
    if (act.error || leads.error) { setError("No se pudieron cargar tus tareas. Revisa tu conexión e inténtalo de nuevo."); setFilas([]); return; }
    setError(null);
    const lista = (act.data ?? []) as unknown as Fila[];
    lista.sort((a, b) => (b.opportunity?.amount_usd ?? 0) - (a.opportunity?.amount_usd ?? 0));
    setFilas(lista);
    setPanel({
      vencidas: lista.filter((f) => new Date(f.due_at) < inicio).length,
      hoy: lista.filter((f) => new Date(f.due_at) >= inicio).length,
      leadsSinAtender: leads.count ?? 0,
    });
  }, []);
  useEffect(() => { void cargar(); }, [cargar]);

  const accion = async (f: Fila, tipo: "completar" | "posponer") => {
    setOcupado(f.id);
    const cambio = tipo === "completar"
      ? { status: "Completada" }
      : { due_at: new Date(new Date(f.due_at).getTime() + 86_400_000).toISOString() };
    const { error: e } = await supabase.from("activities").update(cambio).eq("id", f.id);
    setOcupado(null);
    if (e) setError("No se pudo guardar el cambio. Inténtalo de nuevo.");
    else await cargar();
  };
  const enJuego = useMemo(() => (filas ?? []).reduce((a, f) => a + (f.opportunity?.amount_usd ?? 0), 0), [filas]);
  const nombre = perfil?.full_name.split(" ")[0] ?? "";

  return (
    <>
      <h1 className="text-2xl font-extrabold">{saludo()}, {nombre}</h1>
      <p className="mb-4 mt-1 text-sm text-muted">{filas ? `${filas.length} tareas para hoy y vencidas · ${usd(enJuego)} en juego` : "Cargando tu día…"}</p>
      {error && <p role="alert" className="mb-3 text-sm font-semibold text-danger">! {error}</p>}
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <Tarjeta>
          <h2 className="mb-2 font-bold">Haz esto hoy, ordenado por dinero en juego</h2>
          {filas === null && [0, 1, 2].map((i) => <div key={i} className="mb-2 h-14 animate-pulse rounded-md bg-head" />)}
          {filas?.length === 0 && !error && <Vacio titulo="No tienes tareas pendientes para hoy" detalle="Cuando agendes llamadas, visitas o seguimientos aparecerán aquí." />}
          {filas?.map((f) => {
            const nom = f.contact ? `${f.contact.first_name} ${f.contact.last_name}`.trim() : "Sin contacto";
            const s = f.opportunity ? salud(f.opportunity.last_activity_at) : null;
            const vencida = new Date(f.due_at) < new Date(new Date().setHours(0, 0, 0, 0));
            return (
              <div key={f.id} className="flex flex-wrap items-center gap-3 border-t border-line py-3">
                <div className="min-w-[200px] flex-1">
                  <div className="text-sm font-semibold">{f.title}</div>
                  <div className="text-xs text-muted">{nom}{vencida && <span className="font-bold text-danger"> · ! Vencida</span>}</div>
                  <div className="mt-1"><TelefonoChip tel={f.contact?.whatsapp ?? f.contact?.phone} nombre={nom} /></div>
                </div>
                {f.opportunity && <div className="text-sm font-bold text-ok">{usd(f.opportunity.amount_usd)}</div>}
                {s && <Etiqueta tono={tonoSalud(s)}>{s}</Etiqueta>}
                <div className="flex gap-2">
                  <Boton cargando={ocupado === f.id} onClick={() => accion(f, "completar")}>Completar</Boton>
                  <Boton variante="texto" disabled={ocupado === f.id} onClick={() => accion(f, "posponer")}>Posponer</Boton>
                </div>
              </div>
            );
          })}
        </Tarjeta>
        <Tarjeta className="h-fit">
          <h2 className="mb-2 font-bold">Tu día</h2>
          <div className="mb-1 text-xs text-muted">Tareas de hoy completadas: se mostrará con las metas de actividad</div>
          <Barra valor={0} />
          <dl className="mt-3 grid gap-2 text-sm">
            <div className="flex justify-between"><dt>Vencidas</dt><dd className={`font-bold ${panel.vencidas ? "text-danger" : ""}`}>{panel.vencidas ? "! " : ""}{panel.vencidas}</dd></div>
            <div className="flex justify-between"><dt>Para hoy</dt><dd className="font-bold">{panel.hoy}</dd></div>
            <div className="flex justify-between"><dt>Leads sin atender</dt><dd className="font-bold">{panel.leadsSinAtender}</dd></div>
          </dl>
        </Tarjeta>
      </div>
    </>
  );
}
