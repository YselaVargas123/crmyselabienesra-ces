import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type Aviso = (mensaje: string, tipo?: "ok" | "error") => void;
const Ctx = createContext<Aviso>(() => undefined);
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; m: string; t: "ok" | "error" }[]>([]);
  const avisar = useCallback<Aviso>((m, t = "ok") => {
    const id = Date.now() + Math.random();
    setItems((p) => [...p, { id, m, t }]);
    setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 4000);
  }, []);
  return (
    <Ctx.Provider value={avisar}>
      {children}
      <div className="fixed bottom-20 left-1/2 z-[60] flex -translate-x-1/2 flex-col gap-2 md:bottom-6" role="status" aria-live="polite">
        {items.map((x) => (
          <div key={x.id} className={`rounded-md border px-4 py-2 text-sm font-semibold shadow-lg ${x.t === "ok" ? "border-green-800/40 bg-green-100 text-green-900" : "border-red-800/40 bg-red-100 text-red-900"}`}>
            {x.t === "ok" ? "● " : "! "}{x.m}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
