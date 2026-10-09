import { supabase } from "./supabase";
import type { Etapa, Opcion, PipelineInfo } from "./types";

export interface OpA {
  id: string; title: string; contact_id: string; pipeline_id: string; stage_id: string; status: string; amount_usd: number;
  probability: number; source_id: string | null; loss_reason_id: string | null; owner_id: string | null;
  created_at: string; updated_at: string; last_activity_at: string;
}
export interface ContactoA { id: string; source_id: string | null; created_at: string }
export interface ActA { owner_id: string | null; activity_type: string; updated_at: string }
export interface DatosA {
  ops: OpA[]; contactos: ContactoA[]; actividades: ActA[]; etapas: Etapa[]; pipelines: PipelineInfo[];
  origenes: Opcion[]; razones: Opcion[]; equipo: Opcion[];
}

/** PostgREST devuelve máximo 1000 filas por consulta: se pide por páginas. */
async function paginar<T>(q: (a: number, b: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>): Promise<T[] | null> {
  const out: T[] = [];
  for (let i = 0; i < 20; i++) {
    const { data, error } = await q(i * 1000, i * 1000 + 999);
    if (error) return null;
    const pagina = (data ?? []) as T[];
    out.push(...pagina);
    if (pagina.length < 1000) break;
  }
  return out;
}

/** Carga todo lo necesario para Resumen y Reportes. Devuelve null si algo falla. */
export async function cargarDatos(desdeActividades: Date): Promise<DatosA | null> {
  const [ops, contactos, actividades, e, p, o, r, q] = await Promise.all([
    paginar<OpA>((a, b) => supabase.from("opportunities")
      .select("id,title,contact_id,pipeline_id,stage_id,status,amount_usd,probability,source_id,loss_reason_id,owner_id,created_at,updated_at,last_activity_at")
      .neq("status", "archivada").order("id").range(a, b)),
    paginar<ContactoA>((a, b) => supabase.from("contacts").select("id,source_id,created_at").eq("archived", false).order("id").range(a, b)),
    paginar<ActA>((a, b) => supabase.from("activities").select("owner_id,activity_type,updated_at").eq("status", "Completada")
      .gte("updated_at", desdeActividades.toISOString()).order("updated_at").range(a, b)),
    supabase.from("pipeline_stages").select("*").eq("active", true).order("sort_order"),
    supabase.from("pipelines").select("*"),
    supabase.from("lead_sources").select("id,name"),
    supabase.from("loss_reasons").select("id,name"),
    supabase.from("profiles").select("id,name:full_name"),
  ]);
  if (!ops || !contactos || !actividades || e.error || p.error || o.error || r.error || q.error) return null;
  return {
    ops: ops.map((x) => ({ ...x, amount_usd: Number(x.amount_usd) })), contactos, actividades,
    etapas: (e.data ?? []) as Etapa[], pipelines: (p.data ?? []) as PipelineInfo[],
    origenes: (o.data ?? []) as Opcion[], razones: (r.data ?? []) as Opcion[], equipo: (q.data ?? []) as Opcion[],
  };
}

export const inicioMes = (offset = 0) => { const h = new Date(); return new Date(h.getFullYear(), h.getMonth() + offset, 1); };
export const haceDias = (n: number) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return d; };
export const desde = (iso: string, d: Date) => new Date(iso).getTime() >= d.getTime();
export const sumar = (l: OpA[]) => l.reduce((s, o) => s + o.amount_usd, 0);
export const porcentaje = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);
