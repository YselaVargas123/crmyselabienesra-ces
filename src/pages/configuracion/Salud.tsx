import { useState } from "react";
import { getUmbrales } from "../../lib/format";
import { guardarUmbrales } from "../../lib/ajustes";
import { Boton, Campo, Etiqueta, Tarjeta, campo } from "../../components/ui";
import { useToast } from "../../components/Toast";

export default function Salud() {
  const avisar = useToast();
  const u = getUmbrales();
  const [riesgo, setRiesgo] = useState(String(u.riesgo));
  const [estancada, setEstancada] = useState(String(u.estancada));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    const r = Number(riesgo), e = Number(estancada);
    if (!Number.isInteger(r) || !Number.isInteger(e) || r < 1 || e > 365) return setError("Usa números enteros entre 1 y 365.");
    if (r >= e) return setError("«En riesgo» debe ser menor que «Estancada».");
    setError(null); setGuardando(true);
    const ok = await guardarUmbrales({ riesgo: r, estancada: e });
    setGuardando(false);
    avisar(ok ? "Umbrales guardados." : "No se pudieron guardar. ¿Ya ejecutaste el SQL de la Fase 6 en Supabase?", ok ? "ok" : "error");
  };
  const r = Number(riesgo) || 0;
  return (
    <Tarjeta>
      <h2 className="font-bold">Salud de oportunidades</h2>
      <p className="mb-3 text-sm text-muted">Según los días sin actividad, cada oportunidad se marca así en el pipeline, en Hoy y en el Resumen.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo label="Pasa a «En riesgo» después de (días)"><input className={campo} inputMode="numeric" value={riesgo} onChange={(e) => setRiesgo(e.target.value)} /></Campo>
        <Campo label="Pasa a «Estancada» después de (días)" error={error ?? undefined}><input className={campo} inputMode="numeric" value={estancada} onChange={(e) => setEstancada(e.target.value)} /></Campo>
      </div>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm"><Etiqueta tono="verde">Al día</Etiqueta> hasta {r} días <Etiqueta tono="ambar">En riesgo</Etiqueta> hasta {Number(estancada) || 0} días <Etiqueta tono="rojo">Estancada</Etiqueta> más allá</p>
      <div className="mt-4 flex justify-end"><Boton variante="principal" cargando={guardando} onClick={guardar}>Guardar umbrales</Boton></div>
    </Tarjeta>
  );
}
