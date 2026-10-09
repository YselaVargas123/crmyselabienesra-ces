import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import Catalogo from "./configuracion/Catalogo";
import Equipo from "./configuracion/Equipo";
import Etapas from "./configuracion/Etapas";
import Metas from "./configuracion/Metas";
import Salud from "./configuracion/Salud";

const TABS = [["metas", "Metas diarias"], ["origenes", "Orígenes"], ["perdidas", "Motivos de pérdida"], ["etapas", "Etapas"], ["salud", "Salud"], ["equipo", "Equipo"]] as const;
type Id = (typeof TABS)[number][0];

export default function Configuracion() {
  const { esAgente } = useAuth();
  const [tab, setTab] = useState<Id>("metas");
  const visibles = esAgente ? TABS : TABS.filter(([id]) => id === "metas");
  return (
    <>
      <h1 className="mb-3 text-xl font-extrabold">Configuración</h1>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Secciones de configuración">
        {visibles.map(([id, t]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`min-h-[36px] whitespace-nowrap rounded-full border px-3 text-sm font-semibold ${tab === id ? "border-brand bg-brand text-white" : "border-line text-muted"}`}>{t}</button>
        ))}
      </div>
      {!esAgente && <p className="mb-3 text-sm text-muted">Las demás opciones de configuración las administra la agente.</p>}
      {tab === "metas" && <Metas />}
      {esAgente && tab === "origenes" && <Catalogo tabla="lead_sources" titulo="Orígenes de contactos" ayuda="De dónde llegan tus contactos. Un origen desactivado deja de ofrecerse en los formularios, pero los contactos que ya lo tienen lo conservan." placeholder="Nuevo origen, por ejemplo «Feria inmobiliaria»" />}
      {esAgente && tab === "perdidas" && <Catalogo tabla="loss_reasons" titulo="Motivos de pérdida" ayuda="Se piden al marcar una oportunidad como perdida y alimentan el reporte de Pérdidas." placeholder="Nuevo motivo, por ejemplo «Precio fuera de mercado»" />}
      {esAgente && tab === "etapas" && <Etapas />}
      {esAgente && tab === "salud" && <Salud />}
      {esAgente && tab === "equipo" && <Equipo />}
    </>
  );
}
