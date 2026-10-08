import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { configurado } from "../lib/supabase";
import { Boton } from "../components/ui";

export default function Login() {
  const { entrar, error: errorSesion } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return setError("Escribe un correo válido.");
    if (password.length < 6) return setError("La contraseña tiene al menos 6 caracteres.");
    setEnviando(true);
    setError(await entrar(email.trim(), password));
    setEnviando(false);
  };
  const mensaje = error ?? errorSesion;
  const campo = "mt-1 h-11 w-full rounded-md border-[1.5px] border-muted bg-card px-3 text-base";

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form onSubmit={enviar} noValidate className="w-full max-w-sm overflow-hidden rounded-xl border border-line bg-card">
        <div className="flex h-1.5" aria-hidden><i className="flex-1 bg-brand" /><i className="flex-1 bg-white" /><i className="flex-1 bg-accent" /></div>
        <div className="p-6">
          <h1 className="text-xl font-extrabold">Ysela Vargas · Bienes Raíces</h1>
          <p className="mb-4 text-sm text-muted">Ingresa con tu usuario para ver tu día.</p>
          {!configurado && (
            <div role="alert" className="mb-3 rounded-md border border-amber-800/40 bg-amber-100 p-2 text-sm text-amber-900">▲ Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY. Revisa el archivo .env.</div>
          )}
          <label className="block text-sm font-semibold">Correo
            <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} className={campo} />
          </label>
          <label className="mt-3 block text-sm font-semibold">Contraseña
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={campo} />
          </label>
          {mensaje && <p role="alert" className="mt-3 text-sm font-semibold text-danger">! {mensaje}</p>}
          <Boton type="submit" variante="principal" cargando={enviando} disabled={!configurado} className="mt-4 w-full">Ingresar</Boton>
        </div>
      </form>
    </div>
  );
}
