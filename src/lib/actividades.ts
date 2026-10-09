import { supabase } from "./supabase";

export interface ActividadFila {
  id: string; title: string; activity_type: string; due_at: string; status: string; priority: string;
  contact_id: string | null; opportunity_id: string | null; owner_id: string | null;
  contact: { first_name: string; last_name: string; whatsapp: string | null; phone: string | null } | null;
  opportunity: { title: string; amount_usd: number } | null;
}
export const SELECT_ACTIVIDAD =
  "id,title,activity_type,due_at,status,priority,contact_id,opportunity_id,owner_id,contact:contacts(first_name,last_name,whatsapp,phone),opportunity:opportunities(title,amount_usd)";

export const inicioHoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
export const finHoy = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };
export const finManana = () => { const d = finHoy(); d.setDate(d.getDate() + 1); return d; };

export type Posponer = "manana" | "3dias" | "semana";
export const OPCIONES_POSPONER: [Posponer, string][] = [["manana", "Mañana"], ["3dias", "En 3 días"], ["semana", "En una semana"]];

/** Nueva fecha relativa a HOY (no a la fecha vencida), conservando la hora original. */
export function nuevaFecha(dueIso: string, op: Posponer): string {
  const due = new Date(dueIso);
  const d = new Date();
  d.setDate(d.getDate() + (op === "manana" ? 1 : op === "3dias" ? 3 : 7));
  d.setHours(due.getHours(), due.getMinutes(), 0, 0);
  return d.toISOString();
}

/** Tipos que cuentan para cada meta diaria. */
export const TIPOS_CONTACTO = ["Llamada", "WhatsApp", "Email", "Reunion"];
export const TIPOS_SEGUIMIENTO = ["Seguimiento", "Envio de documentacion"];
export const TIPOS_VISITA = ["Visita"];

export const fechaCorta = (iso: string) => new Date(iso).toLocaleDateString("es-BO", { weekday: "short", day: "numeric", month: "short" });
export const horaCorta = (iso: string) => new Date(iso).toLocaleTimeString("es-BO", { hour: "2-digit", minute: "2-digit" });

/** Días desde hoy hasta una fecha "YYYY-MM-DD" (negativo = ya pasó). */
export function diasHasta(fecha: string): number {
  const [y, m, d] = fecha.slice(0, 10).split("-").map(Number);
  const h = new Date();
  return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(h.getFullYear(), h.getMonth(), h.getDate())) / 86_400_000);
}
export function textoDias(n: number): string {
  if (n === 0) return "Hoy";
  if (n === 1) return "Mañana";
  if (n === -1) return "Venció ayer";
  return n > 0 ? `En ${n} días` : `Venció hace ${-n} días`;
}

export async function completarActividad(id: string): Promise<boolean> {
  const { error } = await supabase.from("activities").update({ status: "Completada" }).eq("id", id);
  return !error;
}
export async function posponerActividad(a: { id: string; due_at: string }, op: Posponer): Promise<boolean> {
  const { error } = await supabase.from("activities").update({ due_at: nuevaFecha(a.due_at, op) }).eq("id", a.id);
  return !error;
}
export async function cancelarActividad(id: string): Promise<boolean> {
  const { error } = await supabase.from("activities").update({ status: "Cancelada" }).eq("id", id);
  return !error;
}
