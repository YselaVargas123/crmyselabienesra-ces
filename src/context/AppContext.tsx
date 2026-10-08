import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Modo = "Captación" | "Colocación";
interface Ctx { oscuro: boolean; alternarTema: () => void; modo: Modo; setModo: (m: Modo) => void }
const C = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  // El tema es la única preferencia que se guarda en el navegador.
  const [oscuro, setOscuro] = useState(() => {
    try { return localStorage.getItem("tema") === "oscuro"; } catch { return false; }
  });
  const [modo, setModo] = useState<Modo>("Colocación");
  useEffect(() => {
    document.documentElement.classList.toggle("dark", oscuro);
    try { localStorage.setItem("tema", oscuro ? "oscuro" : "claro"); } catch { /* sin almacenamiento */ }
  }, [oscuro]);
  return <C.Provider value={{ oscuro, alternarTema: () => setOscuro((o) => !o), modo, setModo }}>{children}</C.Provider>;
}
export function useApp(): Ctx {
  const c = useContext(C);
  if (!c) throw new Error("useApp debe usarse dentro de AppProvider");
  return c;
}
