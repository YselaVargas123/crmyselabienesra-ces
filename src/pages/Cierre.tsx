import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../context/AuthContext";
import { usd } from "../lib/format";
import {
  SELECT_ACTIVIDAD, TIPOS_CONTACTO, TIPOS_SEGUIMIENTO, TIPOS_VISITA, completarActividad, finHoy, finManana, inicioHoy,
  nuevaFecha, posponerActividad, type ActividadFila, type Posponer,
} from "../lib/actividades";
import { Barra, Boton, Tarjeta, Vacio } from "../components/ui";
import FilaActividad from "../components/FilaActividad";
import { useToast } from "../components/Toast";

interface Metas { daily_contacts: number; daily_followups: number; daily_visits: number }
const METAS_BASE: Metas = { daily_contacts: 10, daily_followups: 6, daily_visits: 3 };
interface Datos {
  metas: Metas; hechas: { activity_type: string }[]; pend: ActividadFila[];
  ganadas: number; montoGanado: number; movimientos: number; manana: number;
}

export default function Cierre() {
  const avisar = useToast();
  const { perfil } = useAuth();
  const [d, setD] = useState<Datos | null>(null);
  const [error, setError] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [masivo, setMasivo] = useState(false);

  const cargar = useCallback(async () => {
    if (!perfil) return;
    const uid = perfil.id, ini = inicioHoy().toISOString(), fin = finHoy().toISOString();
    const [m, h, p, g, mv, mn] = await Promise.all([
      supabase.from("activity_goals").select("daily_contacts,daily_followups,daily_visits").eq("user_id", uid).maybeSingle(),
      supabase.from("activities").select("activity_type").eq("status", "Completada").eq("owner_id", uid).gte("updated_at", ini),
      supabase.from("activities").select(SELECT_ACTIVIDAD).eq("status", "Pendiente").eq("owner_id", uid).lte("due_at", fin).order("due_at"),
      supabase.from("opportunities").select("amount_usd").eq("status", "ganada").gte("updated_at", ini),
      supabase.from("timeline_events").select("id", { count: "exact", head: true }).eq("event_type", "cambio_etapa").gte("occurred_at", ini),
      supabase.from("activities").select("id", { count: "exact", head: true }).eq("status", "Pendiente").eq("owner_id", uid).gt("due_at", fin).lte("due_at", finManana().toISOString()),
    ]);
    if (m.error || h.error || p.error || g.error || mv.error || mn.error) { setError(true); return; }
    setError(false);
    setD({
      metas: (m.data as Metas | null) ?? METAS_BASE,
      hechas: (h.data ?? []) as { activity_type: string }[],
      pend: (p.data ?? []) as unknown as ActividadFila[],
      ganadas: g.data?.length ?? 0,
      montoGanado: (g.data ?? []).reduce((s, x) => s + Number(x.amount_usd), 0),
      movimientos: mv.count ?? 0, manana: mn.count ?? 0,
    });
  }, [perfil]);
  useEffect(() => { void cargar(); }, [cargar]);

  const ejecutar = async (id: string, fn: () => Promise<boolean>, ok: string) => {
    setOcupado(id);
    const bien = await fn();
    setOcupado(null);
    if (!bien) return avisar("No se pudo guardar el cambio. Inténtalo de nuevo.", "error");
    avisar(ok);
    await cargar();
  };
  const pasarTodasAManana = async () => {
    if (!d || d.pend.length === 0) return;
    setMasivo(true);
    const res = await Promise.all(d.pend.map((a) => supabase.from("activities").update({ due_at: nuevaFecha(a.due_at, "manana") }).eq("id", a.id)));
    setMasivo(false);
    if (res.some((r) => r.error)) avisar("Algunas actividades no se pudieron mover. Revisa la lista.", "error");
    else avisar(`${d.pend.length} actividad(es) pasadas a mañana.`);
    await cargar();
  };

  if (error) return <p role="alert" className="text-sm font-semibold text-danger">! No se pudo cargar el cierre del día. <button className="underline" onClick={cargar}>Reintentar</button></p>;
  if (!d) return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-head" />)}</div>;

  const cuenta = (tipos: string[]) => d.hechas.filter((x) => tipos.includes(x.activity_type)).length;
  const filas: [string, number, number][] = [
    ["Contactos (llamadas, WhatsApp, correos, reuniones)", cuenta(TIPOS_CONTACTO), d.metas.daily_contacts],
    ["Seguimientos y documentación", cuenta(TIPOS_SEGUIMIENTO), d.metas.daily_followups],
    ["Visitas", cuenta(TIPOS_VISITA), d.metas.daily_visits],
  ];

  return (
    <>
      <h1 className="text-xl font-extrabold">Cierre del día</h1>
      <p className="mb-4 mt-1 text-sm text-muted">Revisa tus metas, ordena lo que quedó pendiente y deja mañana listo.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <h2 className="mb-3 font-bold">Metas de hoy</h2>
          <div className="space-y-4">
            {filas.map(([t, hecho, meta]) => (
              <div key={t}>
                <div className="mb-1 flex justify-between gap-2 text-sm"><span>{t}</span><b>{hecho} de {meta}{hecho >= meta ? " ●" : ""}</b></div>
                <Barra valor={meta > 0 ? (hecho / meta) * 100 : 100} />
              </div>
            ))}
          </div>
        </Tarjeta>
        <Tarjeta>
          <h2 className="mb-3 font-bold">Resultados del día</h2>
          <dl className="grid gap-2 text-sm">
            <div className="flex justify-between"><dt>Operaciones ganadas</dt><dd className="font-bold">{d.ganadas}{d.montoGanado > 0 ? ` · ${usd(d.montoGanado)}` : ""}</dd></div>
            <div className="flex justify-between"><dt>Oportunidades movidas de etapa (equipo)</dt><dd className="font-bold">{d.movimientos}</dd></div>
            <div className="flex justify-between"><dt>Actividades completadas</dt><dd className="font-bold">{d.hechas.length}</dd></div>
            <div className="flex justify-between"><dt>Ya agendadas para mañana</dt><dd className="font-bold">{d.manana}</dd></div>
          </dl>
        </Tarjeta>
      </div>
      <Tarjeta className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-bold">Pendientes de hoy y vencidas ({d.pend.length})</h2>
          {d.pend.length > 0 && <Boton cargando={masivo} onClick={pasarTodasAManana}>Pasar todas a mañana</Boton>}
        </div>
        {d.pend.length === 0 && <div className="mt-3"><Vacio titulo="No te queda nada pendiente" detalle="Día cerrado. Puedes agendar el seguimiento de mañana en Actividades." /></div>}
        {d.pend.map((a) => (
          <FilaActividad key={a.id} a={a} ocupado={ocupado === a.id}
            onCompletar={() => void ejecutar(a.id, () => completarActividad(a.id), "Actividad completada.")}
            onPosponer={(op: Posponer) => void ejecutar(a.id, () => posponerActividad(a, op), "Actividad pospuesta.")} />
        ))}
      </Tarjeta>
    </>
  );
}
