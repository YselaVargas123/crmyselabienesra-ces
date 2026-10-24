import { supabase } from './supabase';

export interface LineaWA { id: string; name: string; owner_id: string; state: string; phone: string | null; heartbeat_at: string | null; last_error: string | null }
export interface HiloWA { id: string; device_id: string; contact_id: string | null; jid: string; display_name: string | null; last_message: string | null; last_at: string }
export interface MensajeWA { id: string; direction: 'in' | 'out'; body: string; kind: string; media_path: string | null; delivery: string | null; created_at: string }
export interface PlantillaWA { id: string; title: string; body: string }
export interface ReglaWA { id: string; device_id: string; title: string; keyword: string; match_mode: string; replies: string[]; enabled: boolean }
export interface ComandoWA { id: string; device_id: string; state: string; action: string; payload: { body?: string; scheduled?: boolean }; scheduled_at: string; result: string | null }

export function conectorEncendido(linea: LineaWA): boolean {
  return !!linea.heartbeat_at && Date.now() - Date.parse(linea.heartbeat_at) < 45_000;
}
export function descripcionLinea(linea: LineaWA): string {
  if (!conectorEncendido(linea)) return 'Conector de la computadora apagado';
  return ({ connected: 'WhatsApp conectado', connecting: 'Esperando vinculación', error: 'Revisa la conexión', offline: 'WhatsApp sin vincular' })[linea.state] ?? 'Sin conexión';
}
export function errorWhatsapp(error: { code?: string; message: string }): string {
  if (['42P01', 'PGRST205', '42883', 'PGRST202'].includes(error.code || '')) return 'Falta instalar la ampliación de WhatsApp en Supabase. Sigue la guía de instalación incluida en el repositorio.';
  return error.message;
}
export async function solicitarWA(device_id: string, action: string, payload: object = {}, fecha?: string) {
  const scheduled = fecha ? new Date(fecha) : new Date();
  if (!Number.isFinite(scheduled.getTime())) throw new Error('Revisa la fecha.');
  if (fecha && scheduled.getTime() < Date.now()) throw new Error('Elige una fecha futura.');
  const { error } = await supabase.from('crm_wa_commands').insert({
    device_id, action, payload, scheduled_at: scheduled.toISOString(),
    expires_at: new Date(scheduled.getTime() + (fecha ? 15 : 5) * 60_000).toISOString(),
  });
  if (error) throw new Error(errorWhatsapp(error));
}
