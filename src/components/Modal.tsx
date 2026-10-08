import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/** Diálogo con franja tricolor. En celular ocupa toda la pantalla. */
export default function Modal({ titulo, onClose, children, ancho = "md:max-w-lg" }: { titulo: string; onClose: () => void; children: ReactNode; ancho?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("keydown", tecla); prev?.focus(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 md:items-center md:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={titulo} className={`flex w-full flex-col overflow-hidden bg-card outline-none md:max-h-[92vh] md:rounded-xl ${ancho}`}>
        <div className="flex h-1.5 shrink-0" aria-hidden><i className="flex-1 bg-brand" /><i className="flex-1 bg-white" /><i className="flex-1 bg-accent" /></div>
        <div className="flex items-center justify-between px-5 pt-4">
          <h2 className="text-lg font-extrabold">{titulo}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="flex h-10 w-10 items-center justify-center text-muted"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
