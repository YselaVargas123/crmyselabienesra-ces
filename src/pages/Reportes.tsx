import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";
import { useApp } from "../context/AppContext";
import { descargarCsv } from "../lib/csv";
import { usd } from "../lib/format";
import { TIPOS_CONTACTO, TIPOS_VISITA } from "../lib/actividades";
import { cargarDatos, desde, haceDias, inicioMes, porcentaje, sumar, type DatosA } from "../lib/analisis";
import { Barra, Boton, Tarjeta, Vacio } from "../components/ui";

type Tab = "Embudo" | "Orígenes" | "Pérdidas" | "Equipo";
const TABS: Tab[] = ["Embudo", "Orígenes", "Pérdidas", "Equipo"];
const RANGOS: [string, () => Date][] = [["Este mes", () => inicioMes(0)], ["30 días", () => haceDias(30)], ["90 días", () => haceDias(90)], ["12 meses", () => haceDias(365)]];
type Celda = string | number;

function Tabla({ cols, filas, vacio }: { cols: string[]; filas: Celda[][]; vacio: string }) {
  if (filas.length === 0) return <Vacio titulo={vacio} detalle="Prueba con un período más largo." />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-sm">
        <thead className="bg-head text-left text-[13px] text-muted"><tr>{cols.map((c, i) => <th key={c} className={`px-3 py-2 font-semibold ${i > 0 ? "text-right" : ""}`}>{c}</th>)}</tr></thead>
        <tbody>{filas.map((f, i) => <tr key={i} className="border-t border-line">{f.map((c, j) => <td key={j} className={`px-3 py-2 ${j > 0 ? "text-right" : "font-semibold"}`}>{c}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

export default function Reportes() {
  const { modo } = useApp();
  const [d, setD] = useState<DatosA | null>(null);
  const [error, setError] = useState(false);
  const [tab, setTab] = useState<Tab>("Embudo");
  const [rango, setRango] = useState(1);

  const cargar = () => { setError(false); void cargarDatos(haceDias(365)).then((r) => (r ? setD(r) : setError(true))); };
  useEffect(cargar, []);

  const t = useMemo(() => {
    if (!d) return null;
    const ini = RANGOS[rango][1]();
    const nombreOrigen = new Map(d.origenes.map((o) => [o.id, o.name]));
    const origenContacto = new Map(d.contactos.map((c) => [c.id, c.source_id]));
    const origenOp = (o: { source_id: string | null; contact_id: string }) => o.source_id ?? origenContacto.get(o.contact_id) ?? null;
    const etiqueta = (id: string | null) => (id ? nombreOrigen.get(id) ?? "Sin origen" : "Sin origen");

    // Embudo del modo actual
    const pipe = d.pipelines.find((p) => p.code === (modo === "Captación" ? "captacion" : "colocacion"));
    const opsP = d.ops.filter((o) => o.pipeline_id === pipe?.id);
    const creadas = opsP.filter((o) => desde(o.created_at, ini));
    const ganadas = opsP.filter((o) => o.status === "ganada" && desde(o.updated_at, ini));
    const perdidas = opsP.filter((o) => o.status === "perdida" && desde(o.updated_at, ini));
    const embudo = d.etapas.filter((e) => e.pipeline_id === pipe?.id).map((e) => {
      const l = opsP.filter((o) => o.stage_id === e.id);
      return [e.name, l.length, usd(sumar(l)), e.kind === "abierta" ? `${e.probability}%` : e.kind === "ganada" ? "Ganada" : "Perdida"] as Celda[];
    });

    // Orígenes
    const claves = new Set<string | null>([...d.origenes.map((o) => o.id), null]);
    const origenes = [...claves].map((id) => {
      const cn = d.contactos.filter((c) => (c.source_id ?? null) === id && desde(c.created_at, ini)).length;
      const oc = d.ops.filter((o) => (origenOp(o) ?? null) === id && desde(o.created_at, ini)).length;
      const g = d.ops.filter((o) => (origenOp(o) ?? null) === id && o.status === "ganada" && desde(o.updated_at, ini));
      return { nombre: etiqueta(id), cn, oc, ng: g.length, monto: sumar(g) };
    }).filter((x) => x.cn + x.oc + x.ng > 0).sort((a, b) => b.cn - a.cn);

    // Pérdidas (ambos pipelines)
    const nombreRazon = new Map(d.razones.map((r) => [r.id, r.name]));
    const perdTodas = d.ops.filter((o) => o.status === "perdida" && desde(o.updated_at, ini));
    const grupos = new Map<string, typeof perdTodas>();
    for (const o of perdTodas) { const k = o.loss_reason_id ? nombreRazon.get(o.loss_reason_id) ?? "Sin motivo" : "Sin motivo"; grupos.set(k, [...(grupos.get(k) ?? []), o]); }
    const perdidasTabla = [...grupos.entries()].map(([k, l]) => ({ motivo: k, n: l.length, monto: sumar(l) })).sort((a, b) => b.n - a.n);

    // Equipo
    const equipo = d.equipo.map((p) => {
      const acts = d.actividades.filter((a) => a.owner_id === p.id && desde(a.updated_at, ini));
      const g = d.ops.filter((o) => o.owner_id === p.id && o.status === "ganada" && desde(o.updated_at, ini));
      const ab = d.ops.filter((o) => o.owner_id === p.id && o.status === "abierta");
      return {
        nombre: p.name, acts: acts.length, contactos: acts.filter((a) => TIPOS_CONTACTO.includes(a.activity_type)).length,
        visitas: acts.filter((a) => TIPOS_VISITA.includes(a.activity_type)).length, ganadas: g.length, monto: sumar(g), abiertas: ab.length, montoAb: sumar(ab),
      };
    });
    return {
      resumen: [creadas.length, ganadas.length, perdidas.length, porcentaje(ganadas.length, ganadas.length + perdidas.length), sumar(ganadas)],
      embudo, origenes, perdidasTabla, totalPerdidas: perdTodas.length, equipo,
    };
  }, [d, rango, modo]);

  if (error) return <p role="alert" className="text-sm font-semibold text-danger">! No se pudieron cargar los reportes. <button className="underline" onClick={cargar}>Reintentar</button></p>;
  if (!t) return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-head" />)}</div>;

  const COLS: Record<Tab, string[]> = {
    Embudo: ["Etapa", "Oportunidades", "Monto", "Probabilidad"],
    Orígenes: ["Origen", "Contactos nuevos", "Oportunidades creadas", "Ganadas", "Monto ganado"],
    Pérdidas: ["Motivo", "Oportunidades", "Monto", "% del total"],
    Equipo: ["Persona", "Actividades", "Contactos", "Visitas", "Ganadas", "Monto ganado", "Abiertas", "Monto abierto"],
  };
  const FILAS: Record<Tab, Celda[][]> = {
    Embudo: t.embudo,
    Orígenes: t.origenes.map((x) => [x.nombre, x.cn, x.oc, x.ng, usd(x.monto)]),
    Pérdidas: t.perdidasTabla.map((x) => [x.motivo, x.n, usd(x.monto), `${porcentaje(x.n, t.totalPerdidas)}%`]),
    Equipo: t.equipo.map((x) => [x.nombre, x.acts, x.contactos, x.visitas, x.ganadas, usd(x.monto), x.abiertas, usd(x.montoAb)]),
  };
  const exportar = () => descargarCsv(`reporte-${tab.toLowerCase()}.csv`, FILAS[tab].map((f) => Object.fromEntries(COLS[tab].map((c, i) => [c, f[i]]))));
  const pildora = (a: boolean) => `min-h-[36px] whitespace-nowrap rounded-full border px-3 text-sm font-semibold ${a ? "border-brand bg-blue-100 text-brand dark:bg-blue-950 dark:text-blue-200" : "border-line text-muted"}`;
  const [creadas, ganadas, perdidas, conv, monto] = t.resumen;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold">Reportes</h1>
        <Boton onClick={exportar} disabled={FILAS[tab].length === 0}><Download size={15} />Exportar CSV</Boton>
      </div>
      <div className="mb-2 flex flex-wrap gap-2">{TABS.map((x) => <button key={x} aria-pressed={tab === x} onClick={() => setTab(x)} className={pildora(tab === x)}>{x}</button>)}</div>
      <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-sm text-muted">Período:</span>{RANGOS.map(([n], i) => <button key={n} aria-pressed={rango === i} onClick={() => setRango(i)} className={pildora(rango === i)}>{n}</button>)}</div>
      {tab === "Embudo" && (
        <div className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[["Creadas", String(creadas)], ["Ganadas", `${ganadas} · ${usd(Number(monto))}`], ["Perdidas", String(perdidas)], ["Conversión", ganadas + perdidas ? `${conv}%` : "—"]].map(([k, v]) => (
            <Tarjeta key={k}><div className="text-xs font-semibold text-muted">{k} ({modo})</div><div className="mt-1 text-xl font-extrabold">{v}</div></Tarjeta>))}
        </div>
      )}
      <Tarjeta className="!p-0">
        <Tabla cols={COLS[tab]} filas={FILAS[tab]} vacio={tab === "Pérdidas" ? "No hay oportunidades perdidas en este período" : "No hay datos en este período"} />
      </Tarjeta>
      {tab === "Pérdidas" && t.perdidasTabla.length > 0 && (
        <Tarjeta className="mt-3"><h2 className="mb-2 font-bold">Peso de cada motivo</h2>
          {t.perdidasTabla.map((x) => <div key={x.motivo} className="mb-2"><div className="mb-1 flex justify-between text-sm"><span>{x.motivo}</span><b>{porcentaje(x.n, t.totalPerdidas)}%</b></div><Barra valor={porcentaje(x.n, t.totalPerdidas)} /></div>)}
        </Tarjeta>
      )}
      <p className="mt-3 text-xs text-muted">Las fechas de «ganada» y «perdida» se toman de la última modificación de la oportunidad. Los orígenes usan el origen del contacto cuando la oportunidad no tiene uno propio.</p>
    </>
  );
}
