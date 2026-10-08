import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, configurado } from "../lib/supabase";

export interface Perfil {
  id: string;
  full_name: string;
  email: string | null;
  role: "agente" | "asistente";
  active: boolean;
  avatar_initials: string | null;
}
interface Ctx {
  session: Session | null;
  perfil: Perfil | null;
  cargando: boolean;
  esAgente: boolean;
  error: string | null;
  entrar: (email: string, password: string) => Promise<string | null>;
  salir: () => Promise<void>;
}
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(configurado);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!configurado) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setCargando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (!s) { setPerfil(null); setCargando(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    setCargando(true);
    supabase.from("profiles").select("*").eq("id", session.user.id).single().then(async ({ data, error: e }) => {
      if (e || !data) {
        setError("No se encontró tu perfil. Pide al administrador que revise tu usuario.");
        await supabase.auth.signOut();
      } else if (!data.active) {
        setError("Tu usuario está desactivado. Habla con la administradora.");
        await supabase.auth.signOut();
      } else {
        setError(null);
        setPerfil(data as Perfil);
      }
      setCargando(false);
    });
  }, [session]);

  const entrar = async (email: string, password: string) => {
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    if (!e) return null;
    return e.message.toLowerCase().includes("invalid") ? "Correo o contraseña incorrectos." : "No se pudo iniciar sesión: " + e.message;
  };
  const salir = async () => { await supabase.auth.signOut(); };

  return (
    <AuthCtx.Provider value={{ session, perfil, cargando, esAgente: perfil?.role === "agente", error, entrar, salir }}>
      {children}
    </AuthCtx.Provider>
  );
}
export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return c;
}
