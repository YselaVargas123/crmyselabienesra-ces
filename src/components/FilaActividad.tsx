import { Boton, Etiqueta, TelefonoChip } from "./ui";
import { OPCIONES_POSPONER, fechaCorta, horaCorta, inicioHoy, type ActividadFila, type Posponer } from "../lib/actividades";

interface Props {
  a: ActividadFila; ocupado: boolean;
  onCompletar: () => void; onPosponer: (op: Posponer) => void; onCancelar?: () => void;
}

export default function FilaActividad({ a, ocupado, onCompletar, onPosponer, onCancelar }: Props) {
  const nom = a.contact ? `${a.contact.first_name} ${a.contact.last_name}`.trim() : "Sin contacto";
  const pendiente = a.status === "Pendiente";
  const vencida = pendiente && new Date(a.due_at) < inicioHoy();
  return (
    <div className="flex flex-wrap items-center gap-3 border-t border-line py-3">
      <div className="min-w-[200px] flex-1">
        <div className="text-sm font-semibold">{a.title}</div>
        <div className="text-xs text-muted">{a.activity_type} · {nom}{a.opportunity ? ` · ${a.opportunity.title}` : ""}</div>
        <div className="text-xs text-muted">{fechaCorta(a.due_at)} · {horaCorta(a.due_at)}{vencida && <b className="text-danger"> · ! Vencida</b>}</div>
        {a.contact && <div className="mt-1"><TelefonoChip tel={a.contact.whatsapp ?? a.contact.phone} nombre={nom} /></div>}
      </div>
      {a.priority === "Alta" && pendiente && <Etiqueta tono="rojo">Alta</Etiqueta>}
      {!pendiente && <Etiqueta tono={a.status === "Completada" ? "verde" : "gris"}>{a.status}</Etiqueta>}
      {pendiente && (
        <div className="flex flex-wrap items-center gap-2">
          <Boton cargando={ocupado} onClick={onCompletar}>Completar</Boton>
          <select aria-label={`Posponer ${a.title}`} disabled={ocupado} value="" onChange={(e) => e.target.value && onPosponer(e.target.value as Posponer)}
            className="h-11 rounded-md border-[1.5px] border-line bg-card px-2 text-sm font-semibold text-muted md:h-9">
            <option value="">Posponer…</option>{OPCIONES_POSPONER.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          {onCancelar && <Boton variante="texto" disabled={ocupado} onClick={onCancelar}>Cancelar</Boton>}
        </div>
      )}
    </div>
  );
}
