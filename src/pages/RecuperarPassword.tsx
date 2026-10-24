import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { Boton, Campo, campo, Tarjeta } from '../components/ui';

export default function RecuperarPassword() {
  const { session, actualizarPassword, terminarRecuperacion } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmar, setConfirmar] = useState('');
  const [error, setError] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [listo, setListo] = useState(false);
  async function guardar(event: FormEvent) {
    event.preventDefault();
    if (password.length < 8) return setError('Usa al menos 8 caracteres.');
    if (password !== confirmar) return setError('Las contraseñas no coinciden.');
    setOcupado(true); setError('');
    try { const fallo = await actualizarPassword(password); if (fallo) setError(fallo); else setListo(true); }
    catch { setError('No se pudo conectar. Intenta de nuevo cuando tengas conexión.'); }
    finally { setOcupado(false); }
  }
  return <div className="min-h-full flex items-center justify-center p-4"><div className="w-full max-w-sm"><Tarjeta>
    {listo ? <><h1 className="text-xl font-bold">Contraseña actualizada</h1><Boton className="mt-4" variante="principal" onClick={terminarRecuperacion}>Continuar al CRM</Boton></> : !session ? <><h1 className="font-bold text-xl">No se pudo validar la recuperación</h1><p className="my-3 text-sm">El enlace venció o no pudo validarse. Vuelve al ingreso y solicita uno nuevo.</p><Boton onClick={terminarRecuperacion}>Volver al ingreso</Boton></> : <form onSubmit={guardar} className="space-y-4"><h1 className="font-bold text-xl">Elige una contraseña nueva</h1><Campo label="Contraseña nueva"><input autoComplete="new-password" type="password" minLength={8} required className={campo} value={password} onChange={e => setPassword(e.target.value)} /></Campo><Campo label="Repite la contraseña"><input autoComplete="new-password" type="password" required className={campo} value={confirmar} onChange={e => setConfirmar(e.target.value)} /></Campo>{error && <p role="alert" className="text-danger text-sm">{error}</p>}<Boton type="submit" variante="principal" cargando={ocupado}>Guardar contraseña</Boton></form>}
  </Tarjeta></div></div>;
}
