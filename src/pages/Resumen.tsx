import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useApp } from "../context/AppContext";
import { salud, usd } from "../lib/format";
import { cargarDatos, desde, haceDias, inicioMes, porcentaje, sumar, type DatosA } from "../lib/analisis";
import { Etiqueta, Tarjeta, Vacio } from "../components/ui";

function Kpi({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <Tarjeta>
      <div className="text-xs font-semibold text-muted">{titulo}</div>
      <div className="mt-1 text-2xl font-extrabold">{valor}</div>
      {detalle && <div className="mt-1 text-xs text-muted">{detalle}</div>}
    </Tarjeta>
  );
}
const EJE = { fill: "var(--muted)", fontSize: 12 };

export default function Resumen() {
  const { modo } = useApp();
  const [d, setD] = useState<DatosA | null>(null);
  const [error, setError] = useState(false);

  const cargar = () => { setError(false); void cargarDatos(inicioMes(-5)).then((r) => (r ? setD(r) : setError(true))); };
  useEffect(cargar, []);

  const m = useMemo(() => {
    if (!d) return null;
    const mes = inicioMes(0), prev = inicioMes(-1), h90 = haceDias(90), h7 = haceDias(7);
    const codigo = new Map(d.pipelines.map((p) => [p.id, p.code]));
    const abiertas = d.ops.filter((o) => o.status === "abierta");
    const ganadas = d.ops.filter((o) => o.status === "ganada");
    const ganadasMes = ganadas.filter((o) => desde(o.updated_at, mes));
    const cerradas90 = d.ops.filter((o) => (o.status === "ganada" || o.status === "perdida") && desde(o.updated_at, h90));
    const conversion = porcentaje(cerradas90.filter((o) => o.status === "ganada").length, cerradas90.length);
    const contactosMes = d.contactos.filter((c) => desde(c.created_at, mes)).length;
    const contactosPrev = d.contactos.filter((c) => desde(c.created_at, prev) && !desde(c.created_at, mes)).length;
    const pipeActual = d.pipelines.find((p) => p.code === (modo === "Captación" ? "captacion" : "colocacion"));
    const porEtapa = d.etapas.filter((e) => e.pipeline_id === pipeActual?.id && e.kind === "abierta").map((e) => {
      const l = abiertas.filter((o) => o.stage_id === e.id);
      return { etapa: e.name, color: e.color, cantidad: l.length, monto: sumar(l) };
    });
    const meses = Array.from({ length: 6 }, (_, i) => {
      const ini = inicioMes(i - 5), fin = inicioMes(i - 4);
      const l = ganadas.filter((o) => { const t = new Date(o.updated_at).getTime(); return t >= ini.getTime() && t < fin.getTime(); });
      return { mes: ini.toLocaleDateString("es-BO", { month: "short" }), monto: sumar(l), cantidad: l.length };
    });
    const estancadas = abiertas.filter((o) => salud(o.last_activity_at) === "Estancada").sort((a, b) => b.amount_usd - a.amount_usd);
    return {
      abiertas: abiertas.length, montoAbierto: sumar(abiertas), ponderado: abiertas.reduce((s, o) => s + o.amount_usd * (o.probability / 100), 0),
      porPipe: (["captacion", "colocacion"] as const).map((c) => abiertas.filter((o) => codigo.get(o.pipeline_id) === c).length),
      ganadasMes: ganadasMes.length, montoGanadoMes: sumar(ganadasMes), conversion, cerradas90: cerradas90.length,
      contactosMes, contactosPrev, actSemana: d.actividades.filter((a) => desde(a.updated_at, h7)).length,
      porEtapa, meses, estancadas,
    };
  }, [d, modo]);

  if (error) return <p role="alert" className="text-sm font-semibold text-danger">! No se pudo cargar el resumen. <button className="underline" onClick={cargar}>Reintentar</button></p>;
  if (!m || !d) return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-head" />)}</div>;

  const dif = m.contactosMes - m.contactosPrev;
  return (
    <>
      <h1 className="text-xl font-extrabold">Resumen</h1>
      <p className="mb-4 mt-1 text-sm text-muted">Cómo va tu negocio hoy. Los gráficos de etapas siguen el modo elegido arriba: {modo}.</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <Kpi titulo="Oportunidades abiertas" valor={String(m.abiertas)} detalle={`Captación ${m.porPipe[0]} · Colocación ${m.porPipe[1]} · ${usd(m.montoAbierto)}`} />
        <Kpi titulo="Valor ponderado por probabilidad" valor={usd(m.ponderado)} detalle="Lo que razonablemente esperas cerrar" />
        <Kpi titulo="Ganadas este mes" valor={String(m.ganadasMes)} detalle={usd(m.montoGanadoMes)} />
        <Kpi titulo="Conversión (últimos 90 días)" valor={m.cerradas90 ? `${m.conversion}%` : "—"} detalle={m.cerradas90 ? `${m.cerradas90} oportunidades cerradas` : "Aún no hay oportunidades cerradas"} />
        <Kpi titulo="Contactos nuevos este mes" valor={String(m.contactosMes)} detalle={`${dif >= 0 ? "+" : ""}${dif} frente al mes pasado`} />
        <Kpi titulo="Actividades completadas (7 días)" valor={String(m.actSemana)} detalle="Todo el equipo" />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Tarjeta>
          <h2 className="mb-2 font-bold">Oportunidades abiertas por etapa · {modo}</h2>
          {m.porEtapa.every((e) => e.cantidad === 0) ? <Vacio titulo="No hay oportunidades abiertas en este modo" detalle="Crea una desde Pipeline." /> : (
            <div role="img" aria-label={`Gráfico de oportunidades abiertas por etapa: ${m.porEtapa.map((e) => `${e.etapa} ${e.cantidad}`).join(", ")}`} style={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={m.porEtapa} margin={{ left: -10, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="etapa" tick={EJE} interval={0} tickFormatter={(v: string) => (v.length > 9 ? v.slice(0, 8) + "…" : v)} />
                  <YAxis allowDecimals={false} tick={EJE} />
                  <Tooltip formatter={(v, _n, p) => [`${v} · ${usd((p.payload as { monto: number }).monto)}`, "Oportunidades"]} />
                  <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>{m.porEtapa.map((e) => <Cell key={e.etapa} fill={e.color} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Tarjeta>
        <Tarjeta>
          <h2 className="mb-2 font-bold">Valor ganado, últimos 6 meses</h2>
          <div role="img" aria-label={`Valor ganado por mes: ${m.meses.map((x) => `${x.mes} ${usd(x.monto)}`).join(", ")}`} style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={m.meses} margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" vertical={false} />
                <XAxis dataKey="mes" tick={EJE} />
                <YAxis tick={EJE} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
                <Tooltip formatter={(v, _n, p) => [`${usd(Number(v))} · ${(p.payload as { cantidad: number }).cantidad} operación(es)`, "Ganado"]} />
                <Bar dataKey="monto" fill="#0C7A45" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Tarjeta>
      </div>
      <Tarjeta className="mt-4">
        <div className="mb-1 flex items-center justify-between gap-2"><h2 className="font-bold">Necesitan atención ({m.estancadas.length} estancadas)</h2><Link to="/pipeline" className="text-sm font-semibold text-brand underline-offset-2 hover:underline dark:text-blue-300">Ir al pipeline</Link></div>
        {m.estancadas.length === 0 ? <Vacio titulo="No tienes oportunidades estancadas" detalle="Todas tienen actividad reciente." /> :
          m.estancadas.slice(0, 5).map((o) => (
            <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line py-2 text-sm">
              <span className="font-semibold">{o.title}</span><span className="flex items-center gap-2"><b>{usd(o.amount_usd)}</b><Etiqueta tono="rojo">Estancada</Etiqueta></span>
            </div>))}
      </Tarjeta>
    </>
  );
}
