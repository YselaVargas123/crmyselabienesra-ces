import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, RefreshCw, Send, Smartphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Boton, campo, Campo, Etiqueta, Tarjeta, Vacio } from '../components/ui';
import { conectorEncendido, descripcionLinea, errorWhatsapp, solicitarWA, type LineaWA, type HiloWA, type MensajeWA, type PlantillaWA, type ReglaWA, type ComandoWA } from '../lib/whatsapp';

type ContactoBreve = { id: string; first_name: string; last_name: string; whatsapp: string | null; phone: string | null };
const fecha = (valor: string) => new Date(valor).toLocaleString('es-BO');
const area = 'min-h-[88px] w-full rounded-md border-[1.5px] border-muted bg-card p-3 text-sm';

export default function WhatsApp() {
  const { perfil, esAgente } = useAuth();
  const [tab, setTab] = useState('Bandeja');
  const [lineas, setLineas] = useState<LineaWA[]>([]);
  const [hilos, setHilos] = useState<HiloWA[]>([]);
  const [mensajes, setMensajes] = useState<MensajeWA[]>([]);
  const [plantillas, setPlantillas] = useState<PlantillaWA[]>([]);
  const [reglas, setReglas] = useState<ReglaWA[]>([]);
  const [comandos, setComandos] = useState<ComandoWA[]>([]);
  const [contactos, setContactos] = useState<ContactoBreve[]>([]);
  const [lineaId, setLineaId] = useState('');
  const [hiloId, setHiloId] = useState('');
  const [qr, setQr] = useState<string | null>(null);
  const [texto, setTexto] = useState('');
  const [programar, setProgramar] = useState('');
  const [adjunto, setAdjunto] = useState<File | null>(null);
  const [nombreLinea, setNombreLinea] = useState('WhatsApp de la oficina');
  const [contactoId, setContactoId] = useState('');
  const [titulo, setTitulo] = useState('');
  const [contenido, setContenido] = useState('');
  const [palabra, setPalabra] = useState('');
  const [coincidencia, setCoincidencia] = useState('exact');
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const linea = lineas.find(l => l.id === lineaId);
  const hilo = hilos.find(h => h.id === hiloId);
  const propia = linea?.owner_id === perfil?.id && esAgente;
  const disponible = !!linea && conectorEncendido(linea) && linea.state === 'connected';

  const cargar = useCallback(async () => {
    const respuestas = await Promise.all([
      supabase.from('crm_wa_devices').select('*').order('created_at'),
      supabase.from('crm_wa_threads').select('*').order('last_at', { ascending: false }).limit(300),
      supabase.from('crm_wa_templates').select('*').order('title'),
      supabase.from('crm_wa_rules').select('*').order('created_at'),
      supabase.from('crm_wa_commands').select('*').order('created_at', { ascending: false }).limit(100),
    ]);
    const fallo = respuestas.find(r => r.error)?.error;
    if (fallo) { setError(errorWhatsapp(fallo)); return; }
    setLineas(respuestas[0].data as LineaWA[]);
    setHilos(respuestas[1].data as HiloWA[]);
    setPlantillas(respuestas[2].data as PlantillaWA[]);
    setReglas(respuestas[3].data as ReglaWA[]);
    setComandos(respuestas[4].data as ComandoWA[]);
    setLineaId(actual => actual || respuestas[0].data?.[0]?.id || '');
  }, []);

  useEffect(() => {
    void cargar();
    const timer = setInterval(() => { void cargar(); }, 5000);
    supabase.from('contacts').select('id,first_name,last_name,whatsapp,phone').eq('archived', false).order('first_name').limit(1000).then(({ data, error: fallo }) => {
      if (fallo) setError(errorWhatsapp(fallo));
      else setContactos((data || []) as ContactoBreve[]);
    });
    return () => clearInterval(timer);
  }, [cargar]);

  useEffect(() => {
    let activo = true;
    setMensajes([]);
    if (!hiloId) return;
    const actualizar = async () => {
      const { data, error: fallo } = await supabase.from('crm_wa_messages').select('*').eq('thread_id', hiloId).order('created_at', { ascending: false }).limit(200);
      if (!activo) return;
      if (fallo) setError(errorWhatsapp(fallo));
      else setMensajes(((data || []) as MensajeWA[]).reverse());
    };
    void actualizar();
    const timer = setInterval(() => { void actualizar(); }, 3000);
    return () => { activo = false; clearInterval(timer); };
  }, [hiloId]);

  useEffect(() => {
    let activo = true;
    setQr(null);
    if (!lineaId || !propia) return;
    const actualizar = async () => {
      const { data, error: fallo } = await supabase.from('crm_wa_pairings').select('qr,updated_at').eq('device_id', lineaId).maybeSingle();
      if (!activo) return;
      if (fallo) setError(errorWhatsapp(fallo));
      else setQr(data?.qr && Date.now() - Date.parse(data.updated_at) < 60_000 ? data.qr : null);
    };
    void actualizar();
    const timer = setInterval(() => { void actualizar(); }, 3000);
    return () => { activo = false; clearInterval(timer); };
  }, [lineaId, propia]);

  async function ejecutar(accion: () => Promise<void>) {
    if (ocupado) return;
    setOcupado(true); setError(''); setAviso('');
    try { await accion(); await cargar(); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo completar la acción.'); }
    finally { setOcupado(false); }
  }
  async function crearLinea() {
    if (!nombreLinea.trim()) throw new Error('Escribe un nombre para la línea.');
    const { data, error: fallo } = await supabase.from('crm_wa_devices').insert({ name: nombreLinea.trim() }).select('id').single();
    if (fallo) throw new Error(errorWhatsapp(fallo));
    setLineaId(data.id); setAviso('Línea creada. Abre el conector en tu computadora con tu mismo usuario del CRM.');
  }
  async function abrirContacto() {
    if (!lineaId || !contactoId) throw new Error('Elige una línea y un contacto.');
    const { data, error: fallo } = await supabase.rpc('crm_wa_open_thread', { p_device: lineaId, p_contact: contactoId });
    if (fallo) throw new Error(errorWhatsapp(fallo));
    setHiloId(data as string); setTab('Bandeja');
  }
  async function enviar() {
    if (!hilo || (!texto.trim() && !adjunto)) throw new Error('Elige una conversación y escribe un mensaje o adjunta un archivo.');
    if (!programar && !disponible) throw new Error('Enciende el conector y vincula WhatsApp para enviar.');
    let media = null;
    if (adjunto) {
      const mime = adjunto.type;
      if (!['image/jpeg','image/png','image/webp','audio/ogg','audio/mpeg','audio/mp4','audio/wav','application/pdf'].includes(mime)) throw new Error('Adjunta una imagen, audio o PDF compatible.');
      if (adjunto.size > 10 * 1024 * 1024) throw new Error('El archivo no debe superar 10 MB.');
      if (mime.startsWith('audio/') && texto.trim()) throw new Error('Envía el audio y el texto en mensajes separados.');
      const path = `outgoing/${perfil!.id}/${crypto.randomUUID()}`;
      const { error: fallo } = await supabase.storage.from('crm-wa-media').upload(path, adjunto, { contentType: mime });
      if (fallo) throw new Error(fallo.message);
      media = { path, mime, name: adjunto.name, kind: mime.startsWith('image/') ? 'image' : mime.startsWith('audio/') ? 'audio' : 'document' };
    }
    await solicitarWA(lineaId, 'send', { thread_id: hilo.id, body: texto.trim(), media, scheduled: !!programar }, programar || undefined);
    setTexto(''); setProgramar(''); setAdjunto(null);
    setAviso(programar ? 'Programado. La computadora y el conector deben estar encendidos a esa hora. Vence 15 minutos después si no se puede enviar.' : 'Solicitud en cola. El estado aparecerá en Programados y envíos; todavía no confirma entrega.');
  }
  async function guardarTexto() {
    if (!titulo.trim() || !contenido.trim()) throw new Error('Completa el título y el contenido.');
    const { error: fallo } = tab === 'Respuestas rápidas'
      ? await supabase.from('crm_wa_templates').insert({ title: titulo.trim(), body: contenido.trim() })
      : await supabase.from('crm_wa_rules').insert({ device_id: lineaId, title: titulo.trim(), keyword: palabra.trim(), match_mode: coincidencia, replies: contenido.split('\n---\n').map(t => t.trim()).filter(Boolean), enabled: false });
    if (fallo) throw new Error(errorWhatsapp(fallo));
    setTitulo(''); setContenido(''); setPalabra('');
    setAviso(tab === 'Reglas del bot' ? 'Regla guardada desactivada. Revísala antes de activarla.' : 'Respuesta rápida guardada.');
  }
  async function verArchivo(path: string) {
    const ventana = window.open('about:blank', '_blank');
    const { data, error: fallo } = await supabase.storage.from('crm-wa-media').createSignedUrl(path, 60);
    if (fallo) { ventana?.close(); setError(fallo.message); }
    else if (ventana) { ventana.opener = null; ventana.location.href = data.signedUrl; }
  }

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-extrabold flex items-center gap-2"><MessageCircle size={24} />WhatsApp</h1><p className="text-sm text-muted">Tu CRM inmobiliario con conversaciones y automatizaciones desde tu computadora.</p></div><Boton onClick={() => { void cargar(); }}><RefreshCw size={15} />Actualizar</Boton></div>
    <Tarjeta><p className="text-sm"><strong>Funciona mientras el conector esté abierto.</strong> Si apagas o suspendes la computadora, el CRM sigue disponible, pero no procesa WhatsApp ni ejecuta el bot. No se importa todo el historial anterior.</p></Tarjeta>
    {error && <div role="alert" className="rounded-lg border border-danger p-3 text-sm text-danger">{error}</div>}
    {aviso && <div role="status" className="rounded-lg border border-line bg-head p-3 text-sm">{aviso}</div>}
    <div className="flex flex-wrap gap-2" aria-label="Secciones de WhatsApp">{['Bandeja', 'Conexiones', 'Respuestas rápidas', 'Reglas del bot', 'Programados y envíos'].map(t => <Boton key={t} variante={tab === t ? 'principal' : 'secundario'} onClick={() => { setTab(t); setTitulo(''); setContenido(''); }}>{t}</Boton>)}</div>
    <Campo label="Línea de WhatsApp"><select className={campo} value={lineaId} onChange={e => { setLineaId(e.target.value); setHiloId(''); setTexto(''); setProgramar(''); setAdjunto(null); }}><option value="">Elige una línea</option>{lineas.map(l => <option key={l.id} value={l.id}>{l.name} · {descripcionLinea(l)}</option>)}</select></Campo>
    {linea && <div className="flex flex-wrap items-center gap-2 text-sm"><Etiqueta tono={disponible ? 'verde' : 'ambar'}>{descripcionLinea(linea)}</Etiqueta><span>{linea.phone || 'Sin número vinculado'}</span>{linea.last_error && <span className="text-danger">{linea.last_error}</span>}</div>}

    {tab === 'Conexiones' && <div className="grid gap-4 lg:grid-cols-2"><Tarjeta><h2 className="font-bold mb-3">Conector en tu computadora</h2><ol className="list-decimal pl-5 space-y-2 text-sm"><li>Descarga la rama de integración y abre <strong>Iniciar WhatsApp.cmd</strong> en Windows.</li><li>Ingresa tu usuario y contraseña del CRM inmobiliario en la ventana del conector.</li><li>Mantén esa ventana abierta. Cuando aparezca «Conector listo», pulsa Conectar aquí.</li><li>En el celular: WhatsApp → Dispositivos vinculados → Vincular un dispositivo.</li></ol><p className="mt-3 text-sm text-muted">Usa un solo conector por línea. No vincules el mismo número simultáneamente en los dos CRM durante la prueba.</p></Tarjeta>
      <Tarjeta>{esAgente && <div className="space-y-3"><Campo label="Nombre de una nueva línea"><input className={campo} value={nombreLinea} onChange={e => setNombreLinea(e.target.value)} /></Campo><Boton disabled={ocupado} onClick={() => { void ejecutar(crearLinea); }}>Agregar línea</Boton></div>}
        {propia && linea && <div className="mt-4 space-y-3"><Boton variante="principal" disabled={ocupado || !conectorEncendido(linea) || disponible} onClick={() => { void ejecutar(async () => { await solicitarWA(linea.id, 'connect'); setAviso('Solicitud enviada al conector. El QR aparecerá aquí.'); }); }}><Smartphone size={16} />Conectar / renovar QR</Boton><Boton disabled={ocupado || !conectorEncendido(linea)} onClick={() => { if (window.confirm('¿Desvincular WhatsApp de este conector? Tendrás que escanear un QR de nuevo.')) void ejecutar(async () => { await solicitarWA(linea.id, 'disconnect'); }); }}>Desvincular</Boton>
          {qr && conectorEncendido(linea) && linea.state === 'connecting' && <div className="inline-block bg-white p-3 rounded-xl"><img src={qr} alt="QR para vincular tu WhatsApp" width={240} height={240} /></div>}
          {!conectorEncendido(linea) && <p className="text-sm text-muted">El botón se habilitará cuando abras el conector con el usuario que creó esta línea.</p>}</div>}
        {linea && !propia && <p className="mt-3 text-sm text-muted">Esta línea la vincula el agente que la creó. Puedes atender sus conversaciones con tu usuario activo.</p>}
      </Tarjeta></div>}

    {tab === 'Bandeja' && <><Tarjeta><div className="flex flex-wrap gap-2"><select aria-label="Contacto para nueva conversación" className={`${campo} flex-1 min-w-[200px]`} value={contactoId} onChange={e => setContactoId(e.target.value)}><option value="">Escribir a un contacto existente…</option>{contactos.map(c => <option key={c.id} value={c.id}>{c.first_name} {c.last_name} · {c.whatsapp || c.phone || 'sin teléfono'}</option>)}</select><Boton disabled={!lineaId || ocupado} onClick={() => { void ejecutar(abrirContacto); }}>Abrir conversación</Boton></div><p className="mt-2 text-xs text-muted">Se muestran hasta 1000 contactos. Los contactos y las propiedades siguen en sus módulos originales.</p></Tarjeta>
      <div className="grid gap-4 lg:grid-cols-[280px_1fr]"><Tarjeta><h2 className="font-bold mb-2">Conversaciones</h2><div className="max-h-[520px] overflow-y-auto space-y-1">{hilos.filter(h => h.device_id === lineaId).map(h => <button key={h.id} onClick={() => { setHiloId(h.id); setTexto(''); setProgramar(''); setAdjunto(null); }} className={`w-full rounded-md p-3 text-left text-sm ${h.id === hiloId ? 'bg-head border border-line' : 'hover:bg-head'}`}><strong className="block truncate">{h.display_name || h.jid.split('@')[0]}</strong><span className="block truncate text-muted">{h.last_message || 'Sin mensajes'}</span></button>)}{!hilos.some(h => h.device_id === lineaId) && <p className="text-sm text-muted">Las conversaciones nuevas aparecerán aquí al recibir un mensaje.</p>}</div></Tarjeta>
        <Tarjeta>{hilo ? <div className="space-y-3"><div className="flex flex-wrap justify-between gap-2"><h2 className="font-bold">{hilo.display_name || hilo.jid.split('@')[0]}</h2>{hilo.contact_id && <Link className="text-sm underline" to={`/contactos?ficha=${hilo.contact_id}`}>Ver ficha inmobiliaria</Link>}</div>
          {!hilo.contact_id && <div className="flex flex-wrap gap-2 text-sm"><span className="text-muted">Número sin ficha vinculada.</span><Boton disabled={!contactoId || ocupado} onClick={() => { void ejecutar(async () => { const { error: fallo } = await supabase.from('crm_wa_threads').update({ contact_id: contactoId }).eq('id', hilo.id); if (fallo) throw fallo; }); }}>Vincular al contacto elegido arriba</Boton></div>}
          <div className="max-h-[450px] min-h-[200px] overflow-y-auto space-y-2 border-y border-line py-3" aria-live="polite">{mensajes.map(m => <div key={m.id} className={`rounded-lg p-3 text-sm max-w-[90%] ${m.direction === 'out' ? 'ml-auto bg-head' : 'border border-line'}`}><span className="text-xs font-bold text-muted">{m.direction === 'out' ? 'Tu equipo' : 'Contacto'} · {fecha(m.created_at)}</span><p className="whitespace-pre-wrap break-words">{m.body || `[${m.kind}]`}</p>{m.direction === 'out' && m.delivery && <p className={`text-xs mt-1 ${m.delivery === 'error' ? 'text-danger' : 'text-muted'}`}>{({ accepted: 'WhatsApp aceptó el envío', delivered: 'Entregado', read: 'Leído', error: 'WhatsApp rechazó la entrega' })[m.delivery] || m.delivery}</p>}{m.media_path && <button className="underline" onClick={() => { void verArchivo(m.media_path!); }}>Abrir archivo recibido</button>}</div>)}{!mensajes.length && <p className="text-muted text-sm">Todavía no hay mensajes guardados.</p>}</div>
          <select aria-label="Insertar respuesta rápida" className={campo} value="" onChange={e => { const p = plantillas.find(p => p.id === e.target.value); if (p) setTexto(p.body); }}><option value="">Insertar respuesta rápida…</option>{plantillas.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}</select>
          <textarea className={area} aria-label="Mensaje de WhatsApp" maxLength={4000} value={texto} onChange={e => setTexto(e.target.value)} placeholder="Escribe tu mensaje…" />
          <Campo label="Adjuntar imagen, audio o PDF (máximo 10 MB)"><input type="file" accept="image/jpeg,image/png,image/webp,audio/ogg,audio/mpeg,audio/mp4,audio/wav,application/pdf" className="w-full text-sm" onChange={e => { setAdjunto(e.target.files?.[0] || null); e.target.value = ''; }} /></Campo>{adjunto && <p className="text-sm">{adjunto.name} <button className="underline" onClick={() => setAdjunto(null)}>Quitar adjunto</button></p>}<Campo label="Programar (opcional, hora de esta computadora)"><input type="datetime-local" className={campo} value={programar} onChange={e => setProgramar(e.target.value)} /></Campo>
          <Boton variante="principal" disabled={ocupado || (!texto.trim() && !adjunto) || (!programar && !disponible)} onClick={() => { void ejecutar(enviar); }}><Send size={15} />{programar ? 'Programar mensaje' : 'Enviar mensaje'}</Boton>
        </div> : <Vacio titulo="Selecciona una conversación" detalle="Puedes escribir a un contacto existente o esperar un mensaje nuevo con el conector encendido." />}</Tarjeta></div></>}

    {(tab === 'Respuestas rápidas' || tab === 'Reglas del bot') && <div className="grid gap-4 lg:grid-cols-2"><Tarjeta><h2 className="font-bold mb-3">{tab}</h2>{tab === 'Reglas del bot' && <p className="mb-3 text-sm text-muted">Responde a palabras clave mientras el conector esté encendido. Cada regla tiene una pausa de 24 horas por conversación para evitar repeticiones.</p>}
      {esAgente && (tab !== 'Reglas del bot' || propia) ? <div className="space-y-3"><Campo label="Título"><input className={campo} maxLength={80} value={titulo} onChange={e => setTitulo(e.target.value)} /></Campo>{tab === 'Reglas del bot' && <><Campo label="Palabra o frase que activa la regla"><input className={campo} maxLength={100} value={palabra} onChange={e => setPalabra(e.target.value)} /></Campo><Campo label="Coincidencia"><select className={campo} value={coincidencia} onChange={e => setCoincidencia(e.target.value)}><option value="exact">Mensaje completo</option><option value="contains">Contiene la frase</option></select></Campo></>}
        <Campo label={tab === 'Reglas del bot' ? 'Respuesta; para varios pasos, separa cada mensaje con una línea que contenga ---' : 'Texto de la respuesta'}><textarea className={area} maxLength={4000} value={contenido} onChange={e => setContenido(e.target.value)} /></Campo><Boton variante="principal" disabled={ocupado || !titulo.trim() || !contenido.trim() || (tab === 'Reglas del bot' && (!lineaId || !palabra.trim()))} onClick={() => { void ejecutar(guardarTexto); }}>Guardar</Boton></div> : <p className="text-sm text-muted">Un agente propietario de la línea administra sus reglas.</p>}</Tarjeta>
      <div className="space-y-3">{tab === 'Respuestas rápidas' ? plantillas.map(p => <Tarjeta key={p.id}><h3 className="font-bold">{p.title}</h3><p className="whitespace-pre-wrap text-sm mt-2">{p.body}</p></Tarjeta>) : reglas.filter(r => r.device_id === lineaId).map(r => <Tarjeta key={r.id}><h3 className="font-bold">{r.title}</h3><p className="text-sm text-muted">{r.match_mode === 'exact' ? 'Mensaje exacto' : 'Contiene'}: {r.keyword} · {r.replies.length} paso(s)</p><p className="whitespace-pre-wrap text-sm my-2">{r.replies.join('\n→ ')}</p><Etiqueta tono={r.enabled ? 'verde' : 'gris'}>{r.enabled ? 'Activa' : 'Desactivada'}</Etiqueta>{propia && <Boton className="ml-2" disabled={ocupado} onClick={() => { void ejecutar(async () => { const { error: fallo } = await supabase.from('crm_wa_rules').update({ enabled: !r.enabled }).eq('id', r.id); if (fallo) throw fallo; }); }}>{r.enabled ? 'Desactivar' : 'Activar'}</Boton>}</Tarjeta>)}</div></div>}

    {tab === 'Programados y envíos' && <Tarjeta><h2 className="font-bold mb-2">Solicitudes recientes de la línea</h2><p className="text-sm text-muted mb-3">«Procesado» significa que WhatsApp aceptó el envío; no confirma que el destinatario lo haya recibido o leído. Los vencidos no se envían automáticamente al encender el conector.</p><div className="space-y-2">{comandos.filter(c => c.device_id === lineaId).map(c => <div key={c.id} className="rounded-md border border-line p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><strong>{c.action === 'send' ? (c.payload.scheduled ? 'Mensaje programado' : 'Mensaje') : c.action === 'connect' ? 'Vinculación' : 'Desvinculación'}</strong><Etiqueta tono={c.state === 'done' ? 'verde' : c.state === 'failed' ? 'rojo' : 'ambar'}>{({ queued: 'En cola', processing: 'Procesando', done: 'Procesado', failed: 'Falló / venció', cancelled: 'Cancelado' })[c.state] || c.state}</Etiqueta></div><span className="text-muted">{fecha(c.scheduled_at)}</span><p className="whitespace-pre-wrap">{c.payload.body}</p>{c.result && <p className="text-muted">{c.result}</p>}{c.state === 'queued' && <Boton className="mt-2" disabled={ocupado} onClick={() => { void ejecutar(async () => { const { data, error: fallo } = await supabase.rpc('crm_wa_cancel', { p_command: c.id }); if (fallo) throw fallo; setAviso(data ? 'Solicitud cancelada antes de procesarse.' : 'Ya se está procesando o no tienes permiso para cancelarla.'); }); }}>Cancelar solicitud</Boton>}</div>)}</div></Tarjeta>}
  </div>;
}
