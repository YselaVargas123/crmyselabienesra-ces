import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, configurado, enlaceRecuperacion } from "../lib/supabase";
import { cargarUmbrales } from "../lib/ajustes";

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
  recuperando: boolean;
  terminarRecuperacion: () => void;
  recuperar: (email: string) => Promise<string | null>;
  actualizarPassword: (password: string) => Promise<string | null>;
}
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [cargando, setCargando] = useState(configurado);
  const [error, setError] = useState<string | null>(null);
  const [recuperando, setRecuperando] = useState(enlaceRecuperacion);

  useEffect(() => {
    if (!configurado) return;
    supabase.auth.getSession().then(({ data, error: fallo }) => {
      setSession(data.session);
      if (fallo) setError('No se pudo validar el enlace o la sesión. Solicita un enlace nuevo.');
      if (!data.session) setCargando(false);
    }).catch(() => { setError('No se pudo conectar con el servicio de acceso.'); setCargando(false); });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, s) => {
      setSession(s);
      if (evento === 'PASSWORD_RECOVERY') { setRecuperando(true); setCargando(false); }
      if (evento === 'SIGNED_OUT') setRecuperando(false);
      if (!s) { setPerfil(null); setCargando(false); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    if (recuperando) { setCargando(false); return; }
    let activo = true;
    setCargando(true);
    supabase.from("profiles").select("*").eq("id", session.user.id).single().then(async ({ data, error: e }) => {
      if (!activo) return;
      if (e || !data) {
        setError("No se encontró tu perfil. Pide al administrador que revise tu usuario.");
        await supabase.auth.signOut();
      } else if (!data.active) {
        setError("Tu usuario está desactivado. Habla con la administradora.");
        await supabase.auth.signOut();
      } else {
        setError(null);
        await cargarUmbrales();
        setPerfil(data as Perfil);
      }
      setCargando(false);
    });
    return () => { activo = false; };
  }, [session, recuperando]);

  const entrar = async (email: string, password: string) => {
    setError(null);
    const { error: e } = await supabase.auth.signInWithPassword({ email, password });
    if (!e) return null;
    return e.message.toLowerCase().includes("invalid") ? "Correo o contraseña incorrectos." : "No se pudo iniciar sesión: " + e.message;
  };
  const salir = async () => { await supabase.auth.signOut(); };
  const terminarRecuperacion = () => {
    setRecuperando(false);
    window.history.replaceState(null, '', window.location.pathname);
  };
  const recuperar = async (email: string) => {
    const { error: fallo } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin + '/' });
    return fallo ? 'No se pudo enviar el correo de recuperación. Si hiciste varios intentos, espera antes de repetir.' : null;
  };
  const actualizarPassword = async (password: string) => {
    const { error: fallo } = await supabase.auth.updateUser({ password });
    return fallo ? 'No se pudo cambiar la contraseña. Revisa los requisitos o solicita un enlace nuevo.' : null;
  };

  return (
    <AuthCtx.Provider value={{ session, perfil, cargando, esAgente: perfil?.role === "agente", error, entrar, salir, recuperando, terminarRecuperacion, recuperar, actualizarPassword }}>
      {children}
    </AuthCtx.Provider>
  );
}
export function useAuth(): Ctx {
  const c = useContext(AuthCtx);
  if (!c) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return c;
}
