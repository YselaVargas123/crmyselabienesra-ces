import { useState } from "react";
import { supabase } from "../lib/supabase";
import { ESTADOS_PROPIEDAD, OPERACIONES, TIPOS_PROPIEDAD, type Propiedad } from "../lib/types";
import { Boton, Campo, campo } from "./ui";
import Modal from "./Modal";
import SelectorContacto, { type ContactoMin } from "./SelectorContacto";
import { useToast } from "./Toast";

interface Props { propiedad?: Propiedad | null; onClose: () => void; onGuardado: () => void }
const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));

export default function PropiedadForm({ propiedad, onClose, onGuardado }: Props) {
  const avisar = useToast();
  const [f, setF] = useState({
    title: propiedad?.title ?? "", operation: propiedad?.operation ?? "Venta", property_type: propiedad?.property_type ?? "Casa",
    status: propiedad?.status ?? "Disponible", price_usd: propiedad?.price_usd?.toString() ?? "", zone: propiedad?.zone ?? "",
    address: propiedad?.address ?? "", bedrooms: propiedad?.bedrooms?.toString() ?? "", bathrooms: propiedad?.bathrooms?.toString() ?? "",
    area_m2: propiedad?.area_m2?.toString() ?? "", land_m2: propiedad?.land_m2?.toString() ?? "",
    commission_pct: propiedad?.commission_pct?.toString() ?? "", contract_expires_at: propiedad?.contract_expires_at ?? "",
    listing_url: propiedad?.listing_url ?? "", description: propiedad?.description ?? "",
  });
  const [dueno, setDueno] = useState<ContactoMin | null>(
    propiedad?.owner_contact_id && propiedad.owner_contact ? { id: propiedad.owner_contact_id, ...propiedad.owner_contact, whatsapp: null } : null);
  const [errores, setErrores] = useState<{ titulo?: string; precio?: string; comision?: string; url?: string }>({});
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const guardar = async () => {
    const e: typeof errores = {};
    if (!f.title.trim()) e.titulo = "Escribe un título, por ejemplo «Casa 3 dorm. Equipetrol».";
    const precio = f.price_usd === "" ? 0 : Number(f.price_usd);
    if (Number.isNaN(precio) || precio < 0) e.precio = "El precio debe ser un número positivo.";
    const com = num(f.commission_pct);
    if (com !== null && (Number.isNaN(com) || com < 0 || com > 100)) e.comision = "Un porcentaje entre 0 y 100.";
    if (f.listing_url && !/^https?:\/\//i.test(f.listing_url)) e.url = "Debe empezar con http:// o https://";
    setErrores(e);
    if (Object.keys(e).length) return;

    setGuardando(true);
    const payload = {
      title: f.title.trim(), operation: f.operation, property_type: f.property_type, status: f.status, price_usd: precio,
      zone: f.zone || null, address: f.address || null, bedrooms: num(f.bedrooms), bathrooms: num(f.bathrooms),
      area_m2: num(f.area_m2), land_m2: num(f.land_m2), commission_pct: com, owner_contact_id: dueno?.id ?? null,
      contract_expires_at: f.contract_expires_at || null, listing_url: f.listing_url || null, description: f.description || null,
    };
    const { error } = propiedad
      ? await supabase.from("properties").update(payload).eq("id", propiedad.id)
      : await supabase.from("properties").insert(payload);
    setGuardando(false);
    if (error) { avisar("No se pudo guardar la propiedad. Revisa los datos.", "error"); return; }
    avisar(propiedad ? "Propiedad actualizada." : "Propiedad guardada.");
    onGuardado();
  };

  const pildora = (activo: boolean) => `min-h-[40px] rounded-full border px-3 text-sm font-semibold ${activo ? "border-brand bg-brand text-white" : "border-line text-muted"}`;

  return (
    <Modal titulo={propiedad ? "Editar propiedad" : "Nueva propiedad"} onClose={onClose} ancho="md:max-w-2xl">
      <div className="flex-1 space-y-3 overflow-y-auto px-5 py-4">
        <Campo label="Título" requerido error={errores.titulo}><input className={campo} value={f.title} onChange={(e) => set("title", e.target.value)} autoFocus /></Campo>
        <fieldset><legend className="text-sm font-semibold">Operación</legend>
          <div className="mt-1 flex flex-wrap gap-2">{OPERACIONES.map((o) => <button type="button" key={o} aria-pressed={f.operation === o} onClick={() => set("operation", o)} className={pildora(f.operation === o)}>{o === "Anticretico" ? "Anticrético" : o}</button>)}</div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-3">
          <Campo label="Tipo"><select className={campo} value={f.property_type} onChange={(e) => set("property_type", e.target.value)}>{TIPOS_PROPIEDAD.map((t) => <option key={t}>{t}</option>)}</select></Campo>
          <Campo label="Estado"><select className={campo} value={f.status} onChange={(e) => set("status", e.target.value)}>{ESTADOS_PROPIEDAD.map((t) => <option key={t}>{t}</option>)}</select></Campo>
          <Campo label="Precio (USD)" error={errores.precio}><input className={campo} inputMode="decimal" value={f.price_usd} onChange={(e) => set("price_usd", e.target.value)} /></Campo>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Zona / barrio"><input className={campo} value={f.zone} onChange={(e) => set("zone", e.target.value)} /></Campo>
          <Campo label="Dirección"><input className={campo} value={f.address} onChange={(e) => set("address", e.target.value)} /></Campo>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Campo label="Dormitorios"><input className={campo} inputMode="numeric" value={f.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} /></Campo>
          <Campo label="Baños"><input className={campo} inputMode="numeric" value={f.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} /></Campo>
          <Campo label="Construido m²"><input className={campo} inputMode="decimal" value={f.area_m2} onChange={(e) => set("area_m2", e.target.value)} /></Campo>
          <Campo label="Terreno m²"><input className={campo} inputMode="decimal" value={f.land_m2} onChange={(e) => set("land_m2", e.target.value)} /></Campo>
        </div>
        <SelectorContacto label="Propietario (contacto)" valor={dueno} onChange={setDueno} />
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Comisión (%)" error={errores.comision}><input className={campo} inputMode="decimal" value={f.commission_pct} onChange={(e) => set("commission_pct", e.target.value)} /></Campo>
          <Campo label="Vence contrato de captación"><input type="date" className={campo} value={f.contract_expires_at} onChange={(e) => set("contract_expires_at", e.target.value)} /></Campo>
        </div>
        <Campo label="Enlace del anuncio" error={errores.url}><input className={campo} inputMode="url" placeholder="https://" value={f.listing_url} onChange={(e) => set("listing_url", e.target.value)} /></Campo>
        <Campo label="Descripción"><textarea className={`${campo} h-24 py-2`} value={f.description} onChange={(e) => set("description", e.target.value)} /></Campo>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-line bg-card px-5 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <Boton variante="texto" onClick={onClose}>Cancelar</Boton>
        <Boton variante="principal" cargando={guardando} onClick={guardar}>Guardar propiedad</Boton>
      </div>
    </Modal>
  );
}
