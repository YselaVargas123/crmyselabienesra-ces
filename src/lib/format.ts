export const usd = (n: number) => "USD " + Math.round(n).toLocaleString("es-BO");

/** Normaliza un número boliviano al formato internacional sin signo (591XXXXXXXX). */
export function numeroWa(tel: string): string {
  const d = tel.replace(/\D/g, "");
  return d.startsWith("591") ? d : "591" + d;
}
export const enlaceWa = (tel: string, texto?: string) =>
  `https://wa.me/${numeroWa(tel)}` + (texto ? `?text=${encodeURIComponent(texto)}` : "");

export type Salud = "Al día" | "En riesgo" | "Estancada";
/** Umbrales iniciales (se volverán editables en Configuración, Fase 6). */
export const UMBRAL_RIESGO = 3;
export const UMBRAL_ESTANCADA = 10;
export function salud(ultimaActividad: string | null | undefined): Salud {
  if (!ultimaActividad) return "Estancada";
  const dias = (Date.now() - new Date(ultimaActividad).getTime()) / 86_400_000;
  if (dias <= UMBRAL_RIESGO) return "Al día";
  if (dias <= UMBRAL_ESTANCADA) return "En riesgo";
  return "Estancada";
}
export const iniciales = (nombre: string) =>
  nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

/** Valida un número boliviano (8 dígitos, con o sin +591). Devuelve el formato "+591 7712 3456" o null. */
export function normalizaTel(v: string): string | null {
  let d = v.replace(/\D/g, "");
  if (d.startsWith("591") && d.length === 11) d = d.slice(3);
  if (d.length !== 8) return null;
  return `+591 ${d.slice(0, 4)} ${d.slice(4)}`;
}
export function hace(fecha: string | null | undefined): string {
  if (!fecha) return "Sin interacción";
  const min = (Date.now() - new Date(fecha).getTime()) / 60000;
  if (min < 60) return "Hace un momento";
  if (min < 1440) return `Hace ${Math.floor(min / 60)} h`;
  const d = Math.floor(min / 1440);
  return d === 1 ? "Ayer" : d < 30 ? `Hace ${d} días` : new Date(fecha).toLocaleDateString("es-BO");
}
export const fechaHora = (f: string) => new Date(f).toLocaleString("es-BO", { dateStyle: "short", timeStyle: "short" });
