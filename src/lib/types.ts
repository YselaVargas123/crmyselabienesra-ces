export const ESTADOS = ["En base", "Lead activo", "Cliente", "Inactivo"] as const;
export const TIPOS = ["Propietario", "Comprador", "Inquilino", "Anticresista", "Agente inmobiliario", "Otro"] as const;
export const TIPOS_ACTIVIDAD = ["Llamada", "WhatsApp", "Email", "Reunion", "Visita", "Seguimiento", "Envio de documentacion", "Firma de contrato", "Cobro de comision", "Nota interna"] as const;

export interface Contacto {
  id: string; first_name: string; last_name: string; whatsapp: string | null; phone: string | null;
  email: string | null; document_id: string | null; city: string | null; address: string | null;
  birth_date: string | null; contact_type: string; source_id: string | null; owner_id: string | null;
  status: string; notes: string | null; archived: boolean; last_interaction_at: string | null; created_at: string;
  source?: { name: string } | null; owner?: { full_name: string } | null;
}
export interface Opcion { id: string; name: string }
export const nombreCompleto = (c: { first_name: string; last_name: string }) => `${c.first_name} ${c.last_name}`.trim();
