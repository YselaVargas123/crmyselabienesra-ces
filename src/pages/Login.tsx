import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { configurado } from "../lib/supabase";
import { Boton } from "../components/ui";

export default function Login() {
  const { entrar, recuperar, error: errorSesion } = useAuth();
  const [recuperacion, setRecuperacion] = useState(false);
  const [aviso, setAviso] = useState('');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return setError("Escribe un correo válido.");
    if (!recuperacion && password.length < 6) return setError("La contraseña tiene al menos 6 caracteres.");
    setEnviando(true);
    setError(null); setAviso('');
    try {
      const fallo = recuperacion ? await recuperar(email.trim()) : await entrar(email.trim(), password);
      setError(fallo);
      if (recuperacion && !fallo) setAviso('Si el correo corresponde a una cuenta, recibirás un enlace de recuperación. Revisa también spam.');
    } catch { setError('No se pudo conectar con el servicio de acceso.'); }
    finally { setEnviando(false); }
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
          {!recuperacion && <label className="mt-3 block text-sm font-semibold">Contraseña
            <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={campo} />
          </label>}
          {mensaje && <p role="alert" className="mt-3 text-sm font-semibold text-danger">! {mensaje}</p>}
          {aviso && <p role="status" className="mt-3 text-sm">{aviso}</p>}
          <Boton type="submit" variante="principal" cargando={enviando} disabled={!configurado} className="mt-4 w-full">{recuperacion ? 'Enviar enlace de recuperación' : 'Ingresar'}</Boton>
          <button type="button" className="mt-3 text-sm underline" onClick={() => { setRecuperacion(!recuperacion); setError(null); setAviso(''); }}>{recuperacion ? 'Volver al ingreso' : '¿Olvidaste tu contraseña?'}</button>
        </div>
      </form>
    </div>
  );
}
