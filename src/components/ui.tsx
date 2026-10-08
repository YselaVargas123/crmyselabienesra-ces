import type { ButtonHTMLAttributes, ReactNode } from "react";
import { MessageCircle, Phone } from "lucide-react";
import { enlaceWa, iniciales, type Salud } from "../lib/format";

type Tono = "azul" | "verde" | "rojo" | "ambar" | "gris";
const TONOS: Record<Tono, string> = {
  azul: "bg-blue-100 text-brand border-brand/30 dark:bg-blue-950 dark:text-blue-200",
  verde: "bg-green-100 text-green-900 border-green-800/30 dark:bg-green-950 dark:text-green-200",
  rojo: "bg-red-100 text-red-900 border-red-800/30 dark:bg-red-950 dark:text-red-200",
  ambar: "bg-amber-100 text-amber-900 border-amber-800/30 dark:bg-amber-950 dark:text-amber-200",
  gris: "bg-slate-200 text-slate-800 border-slate-400/40 dark:bg-slate-700 dark:text-slate-100",
};
const MARCA: Partial<Record<Tono, string>> = { rojo: "! ", ambar: "▲ ", verde: "● " };

export function Etiqueta({ tono = "gris", children }: { tono?: Tono; children: ReactNode }) {
  return <span className={`inline-block rounded-full border px-2 text-xs font-semibold leading-5 ${TONOS[tono]}`}>{MARCA[tono]}{children}</span>;
}
export const tonoSalud = (s: Salud): Tono => (s === "Al día" ? "verde" : s === "En riesgo" ? "ambar" : "rojo");

export function Tarjeta({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-line bg-card p-4 ${className}`}>{children}</div>;
}
export function Avatar({ nombre }: { nombre: string }) {
  return <span aria-hidden className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-brand">{iniciales(nombre)}</span>;
}

type Variante = "principal" | "secundario" | "texto";
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variante?: Variante; cargando?: boolean }
export function Boton({ variante = "secundario", cargando, children, className = "", disabled, ...rest }: BtnProps) {
  const base = "inline-flex min-h-[44px] items-center justify-center gap-1 rounded-md px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 md:min-h-[36px]";
  const v = {
    principal: "bg-accent text-white hover:brightness-110 active:brightness-90",
    secundario: "border-[1.5px] border-brand text-brand hover:bg-blue-50 dark:text-blue-200 dark:hover:bg-blue-950",
    texto: "text-muted hover:text-ink",
  }[variante];
  return <button {...rest} disabled={disabled || cargando} className={`${base} ${v} ${className}`}>{cargando ? "Cargando…" : children}</button>;
}

/** Teléfono con enlace tel: y botones de WhatsApp y Llamar. */
export function TelefonoChip({ tel, nombre }: { tel: string | null | undefined; nombre?: string }) {
  if (!tel) return <span className="text-xs text-muted">Sin teléfono</span>;
  const limpio = tel.replace(/[^\d+]/g, "");
  const caja = "inline-flex h-8 w-8 items-center justify-center rounded-md text-white";
  return (
    <span className="inline-flex items-center gap-1">
      <a href={`tel:${limpio}`} className="text-xs font-bold">{tel}</a>
      <a href={enlaceWa(tel)} target="_blank" rel="noreferrer" aria-label={`WhatsApp a ${nombre ?? tel}`} className={`${caja} bg-ok`} style={{ background: "#0C7A45" }}><MessageCircle size={16} /></a>
      <a href={`tel:${limpio}`} aria-label={`Llamar a ${nombre ?? tel}`} className={`${caja} bg-brand`}><Phone size={16} /></a>
    </span>
  );
}
export function Barra({ valor, className = "" }: { valor: number; className?: string }) {
  const v = Math.max(0, Math.min(100, valor));
  return <div role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} className={`h-2 overflow-hidden rounded-full bg-head ${className}`}><div className="h-full bg-brand" style={{ width: `${v}%` }} /></div>;
}
export function Vacio({ titulo, detalle }: { titulo: string; detalle: string }) {
  return <div className="rounded-xl border border-dashed border-line p-8 text-center"><div className="font-bold">{titulo}</div><p className="mt-1 text-sm text-muted">{detalle}</p></div>;
}

export const campo = "h-11 w-full rounded-md border-[1.5px] border-muted bg-card px-3 text-base";
export function Campo({ label, error, requerido, children }: { label: string; error?: string; requerido?: boolean; children: ReactNode }) {
  return (
    <label className="block text-sm font-semibold">
      {label}{requerido && <span className="text-danger"> *</span>}
      <div className="mt-1 font-normal">{children}</div>
      {error && <span role="alert" className="mt-1 block text-xs font-semibold text-danger">! {error}</span>}
    </label>
  );
}
