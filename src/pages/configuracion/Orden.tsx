import { ArrowDown, ArrowUp } from "lucide-react";

export default function Orden({ nombre, puedeSubir, puedeBajar, onMover }: { nombre: string; puedeSubir: boolean; puedeBajar: boolean; onMover: (dir: -1 | 1) => void }) {
  const caja = "flex h-9 w-9 items-center justify-center rounded-md border border-line text-muted disabled:opacity-30";
  return (
    <span className="inline-flex gap-1">
      <button type="button" className={caja} disabled={!puedeSubir} aria-label={`Subir ${nombre}`} onClick={() => onMover(-1)}><ArrowUp size={16} /></button>
      <button type="button" className={caja} disabled={!puedeBajar} aria-label={`Bajar ${nombre}`} onClick={() => onMover(1)}><ArrowDown size={16} /></button>
    </span>
  );
}
