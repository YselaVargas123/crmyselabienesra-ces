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

export const OPERACIONES = ["Venta", "Alquiler", "Anticretico"] as const;
export const TIPOS_PROPIEDAD = ["Casa", "Departamento", "Terreno", "Local comercial", "Oficina", "Quinta", "Galpon", "Otro"] as const;
export const ESTADOS_PROPIEDAD = ["Disponible", "Reservada", "Vendida", "Alquilada", "Retirada"] as const;

export interface PipelineInfo { id: string; code: "captacion" | "colocacion"; name: string }
export interface Etapa {
  id: string; pipeline_id: string; name: string; color: string; sort_order: number; probability: number;
  kind: "abierta" | "ganada" | "perdida";
}
export interface Oportunidad {
  id: string; contact_id: string; pipeline_id: string; stage_id: string; operation_type: string; title: string;
  amount_usd: number; probability: number; expected_close: string | null; owner_id: string | null;
  status: "abierta" | "ganada" | "perdida" | "archivada"; next_followup_at: string | null; last_activity_at: string;
  notes: string | null; property_id: string | null; created_at: string;
  contact?: { first_name: string; last_name: string; whatsapp: string | null } | null;
  owner?: { full_name: string } | null;
}
export interface Propiedad {
  id: string; title: string; operation: string; property_type: string; status: string; price_usd: number;
  zone: string | null; address: string | null; bedrooms: number | null; bathrooms: number | null;
  area_m2: number | null; land_m2: number | null; commission_pct: number | null; owner_contact_id: string | null;
  contract_expires_at: string | null; listing_url: string | null; description: string | null; created_at: string;
  owner_contact?: { first_name: string; last_name: string } | null;
}
