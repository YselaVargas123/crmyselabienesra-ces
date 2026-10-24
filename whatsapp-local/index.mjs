import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import readline from 'node:readline/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';
import makeWASocket, { DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage, WAMessageStatus } from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import pino from 'pino';
import dotenv from 'dotenv';
import { useAuthStateSeguro } from './auth-state.mjs';
import { PROJECT_URL, normalizarTelefono, jidIndividual, limpiarJid, textoMensaje, reglaCoincide, validarPasos, validarEnvio, demoraReconexion } from './core.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local') });
const privateDir = path.join(root, '.whatsapp-local');
const sessions = new Map();
const log = pino({ level: 'silent' });
let db, worker, userId, stopped = false;
const locks = new Map();
const dbResult = async query => { const { data, error } = await query; if (error) throw new Error(error.message); return data; };
const report = (label, error) => console.error(label + ': ' + (error?.message || 'Error de conexión'));

function sessionPath(id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Identificador de línea inválido.');
  const target = path.resolve(privateDir, id);
  if (!target.startsWith(path.resolve(privateDir) + path.sep)) throw new Error('Carpeta de sesión inválida.');
  return target;
}

function serial(id, action) {
  const previous = locks.get(id) || Promise.resolve();
  const current = previous.then(action, action);
  const done = current.catch(error => report('Operación de WhatsApp', error));
  locks.set(id, done);
  void done.then(() => { if (locks.get(id) === done) locks.delete(id); });
  return current;
}
async function passwordPrompt() {
  if (!process.stdin.isTTY) throw new Error('Abre el conector en una ventana interactiva para ingresar tu contraseña.');
  process.stdout.write('Contraseña del CRM (no se muestra ni se guarda): ');
  return new Promise((resolve, reject) => {
    let password = '';
    const input = process.stdin;
    input.setRawMode(true); input.setEncoding('utf8'); input.resume();
    const finish = () => { input.off('data', receive); input.setRawMode(false); input.pause(); process.stdout.write('\n'); };
    const receive = chunk => {
      for (const char of chunk) {
        if (char === '\u0003') { finish(); reject(new Error('Inicio cancelado')); return; }
        if (char === '\r' || char === '\n') { finish(); resolve(password); return; }
        if (char === '\u007f' || char === '\b') password = password.slice(0, -1);
        else if (char >= ' ') password += char;
      }
    };
    input.on('data', receive);
  });
}
async function configure() {
  console.log('\nCRM Ysela · Conector local de WhatsApp\nCierra esta ventana para detener WhatsApp. Tu CRM en Netlify seguirá disponible.\n');
  await fs.mkdir(privateDir, { recursive: true, mode: 0o700 });
  // Cada ejecución tiene un id distinto, incluso en la misma computadora.
  worker = randomUUID();
  let url = process.env.VITE_SUPABASE_URL;
  let key = process.env.VITE_SUPABASE_ANON_KEY;
  // La clave pública se obtiene del CRM publicado; nunca se solicita service_role.
  if (!url || !key) {
    const base = 'https://crmyselabienesraices.netlify.app/';
    const html = await (await fetch(base)).text();
    const asset = html.match(/src="([^"]+\.js)"/)?.[1];
    if (!asset) throw new Error('No se pudo leer la configuración pública del CRM. Revisa .env.local.');
    const source = await (await fetch(new URL(asset, base))).text();
    const candidateUrls = [...new Set(source.match(/https:\/\/[a-z0-9]+\.supabase\.co/g) || [])];
    const candidateKeys = [...new Set(source.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|sb_publishable_[A-Za-z0-9_-]+/g) || [])];
    url = candidateUrls.find(value => value === PROJECT_URL);
    key = candidateKeys.find(value => {
      if (value.startsWith('sb_publishable_')) return true;
      try { const claims = JSON.parse(Buffer.from(value.split('.')[1], 'base64url')); return claims.role === 'anon' && claims.ref === new URL(PROJECT_URL).hostname.split('.')[0]; } catch { return false; }
    });
  }
  if (url !== PROJECT_URL || !key || key.startsWith('sb_secret_')) throw new Error('La configuración no corresponde al CRM inmobiliario o no es una clave pública.');
  db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: true, detectSessionInUrl: false },
    global: { fetch: (input, options) => fetch(input, { ...options, signal: AbortSignal.timeout(15_000) }) },
  });
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  const email = (await input.question('Correo del CRM inmobiliario: ')).trim(); input.close();
  const password = await passwordPrompt();
  const { data, error } = await db.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error('No se pudo ingresar. Revisa tu usuario y contraseña del CRM inmobiliario.');
  userId = data.user.id;
  const profile = await dbResult(db.from('profiles').select('active,role').eq('id', userId).single());
  if (!profile.active || profile.role !== 'agente') throw new Error('Para vincular una línea debes usar un agente activo del CRM.');
  await dbResult(db.from('crm_wa_devices').select('id').limit(1));
  console.log('Conector listo. Abre WhatsApp → Conexiones en tu CRM y crea o conecta tu línea.');
}

async function deviceState(id, patch) {
  await dbResult(db.from('crm_wa_devices').update(patch).eq('id', id).eq('owner_id', userId).eq('worker_id', worker));
}
async function pairing(id, qr) { await dbResult(db.from('crm_wa_pairings').upsert({ device_id: id, qr, updated_at: new Date().toISOString() })); }
function endSocket(entry) {
  if (!entry) return;
  clearTimeout(entry.retry);
  entry.sock?.ev.removeAllListeners();
  try { entry.sock?.end(undefined); } catch { /* ya desconectado */ }
}
async function connect(device, attempt = 0) {
  const id = device.id;
  endSocket(sessions.get(id));
  const { state, saveCreds } = await useAuthStateSeguro(sessionPath(id));
  const version = await fetchLatestBaileysVersion().then(r => r.version).catch(() => undefined);
  const sock = makeWASocket({ auth: state, logger: log, ...(version ? { version } : {}), syncFullHistory: false, shouldSyncHistoryMessage: () => false });
  const entry = { sock, state: 'connecting', retry: null };
  let retries = attempt;
  sessions.set(id, entry);
  await deviceState(id, { state: 'connecting', last_error: null });
  sock.ev.on('creds.update', () => { void saveCreds().catch(error => report('Guardado de sesión', error)); });
  sock.ev.on('connection.update', update => {
    void serial(id, async () => {
      if (stopped || sessions.get(id) !== entry) return;
      if (update.qr) await pairing(id, await QRCode.toDataURL(update.qr));
      if (update.connection === 'open') {
        retries = 0;
        entry.state = 'connected';
        await pairing(id, null);
        await deviceState(id, { state: 'connected', phone: sock.user?.id?.split(':')[0]?.split('@')[0] || null, last_error: null });
        console.log('WhatsApp conectado: ' + device.name);
      }
      if (update.connection === 'close') {
        entry.state = 'offline';
        const code = update.lastDisconnect?.error?.output?.statusCode;
        await pairing(id, null);
        await deviceState(id, { state: 'offline' });
        if (code === DisconnectReason.loggedOut) {
          endSocket(entry); sessions.delete(id);
          await fs.rm(sessionPath(id), { recursive: true, force: true });
          return;
        }
        if (!state.creds.me || retries >= 5) {
          endSocket(entry); sessions.delete(id);
          await deviceState(id, { state: 'error', last_error: 'No se pudo vincular. Pulsa Conectar para generar un QR nuevo.' });
          return;
        }
        entry.retry = setTimeout(() => {
          if (!stopped && sessions.get(id) === entry) void serial(id, () => connect(device, retries + 1)).catch(error => report('Reconexión', error));
        }, demoraReconexion(retries + 1));
      }
    }).catch(error => report('Estado de la línea', error));
  });
  sock.ev.on('messages.upsert', ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const message of messages) void serial(id, () => receiveMessage(device, entry, message)).catch(error => report('Recepción de mensaje', error));
  });
  sock.ev.on('messages.update', updates => {
    void serial(id, async () => {
      if (sessions.get(id) !== entry) return;
      for (const { key, update } of updates) {
        if (!key.fromMe || !key.id || !jidIndividual(key.remoteJid)) continue;
        const delivery = update.status === WAMessageStatus.ERROR ? 'error' : update.status >= WAMessageStatus.READ ? 'read' : update.status >= WAMessageStatus.DELIVERY_ACK ? 'delivered' : null;
        if (!delivery) continue;
        const thread = await dbResult(db.from('crm_wa_threads').select('id').eq('device_id', id).eq('jid', limpiarJid(key.remoteJid)).maybeSingle());
        if (thread) await dbResult(db.from('crm_wa_messages').update({ delivery }).eq('thread_id', thread.id).eq('remote_id', key.id));
      }
    }).catch(error => report('Estado de entrega', error));
  });
}

async function findThread(device, message) {
  const jid = limpiarJid(message.key.remoteJid);
  let thread = await dbResult(db.from('crm_wa_threads').select('*').eq('device_id', device.id).eq('jid', jid).maybeSingle());
  if (thread) return thread;
  let contactId = null;
  let displayName = message.key.fromMe ? jid.split('@')[0] : message.pushName || jid.split('@')[0];
  const phoneJid = jid.endsWith('@s.whatsapp.net') ? jid : message.key.remoteJidAlt?.endsWith('@s.whatsapp.net') ? message.key.remoteJidAlt : null;
  const phone = phoneJid ? normalizarTelefono(phoneJid.split('@')[0].split(':')[0]) : null;
  if (phone) {
    const contacts = await dbResult(db.from('contacts').select('id,first_name,last_name,whatsapp,phone').eq('archived', false).limit(5000));
    const matches = contacts.filter(c => normalizarTelefono(c.whatsapp || c.phone) === phone);
    if (matches.length === 1) { contactId = matches[0].id; displayName = `${matches[0].first_name} ${matches[0].last_name}`.trim(); }
  }
  thread = await dbResult(db.from('crm_wa_threads').upsert({ device_id: device.id, jid, contact_id: contactId, display_name: displayName }, { onConflict: 'device_id,jid' }).select('*').single());
  return thread;
}
async function persistMessage(thread, message, content, mediaPath = null) {
  // El índice único evita duplicados por reentregas de WhatsApp.
  const { error } = await db.from('crm_wa_messages').insert({ thread_id: thread.id, remote_id: message.key.id, direction: message.key.fromMe ? 'out' : 'in', body: content.body, kind: content.kind, media_path: mediaPath, delivery: message.key.fromMe ? 'accepted' : null, created_at: new Date(Number(message.messageTimestamp || Date.now() / 1000) * 1000).toISOString() });
  if (error?.code === '23505') return false;
  if (error) throw new Error(error.message);
  await dbResult(db.from('crm_wa_threads').update({ last_message: content.body, last_at: new Date().toISOString() }).eq('id', thread.id));
  return true;
}
async function receiveMessage(device, entry, message) {
  if (stopped || sessions.get(device.id) !== entry || !message.key.id || !jidIndividual(message.key.remoteJid)) return;
  const content = textoMensaje(message.message);
  if (!content) return;
  const thread = await findThread(device, message);
  const existing = await dbResult(db.from('crm_wa_messages').select('id').eq('thread_id', thread.id).eq('remote_id', message.key.id).maybeSingle());
  if (existing) return;
  let mediaPath = null;
  if (content.content && Number(content.content.fileLength || 0) <= 10 * 1024 * 1024) {
    try {
      const stream = await downloadMediaMessage(message, 'stream', {}, { logger: log, reuploadRequest: entry.sock.updateMediaMessage });
      const parts = []; let total = 0;
      for await (const part of stream) {
        total += part.length;
        if (total > 10 * 1024 * 1024) { stream.destroy(); throw new Error('El archivo supera 10 MB'); }
        parts.push(part);
      }
      const buffer = Buffer.concat(parts);
      const name = `${device.id}/${randomUUID()}`;
      const { error } = await db.storage.from('crm-wa-media').upload(name, buffer, { contentType: content.content.mimetype || 'application/octet-stream', upsert: false });
      if (error) throw error;
      mediaPath = name;
    } catch { content.body += ' (archivo no guardado: descarga desde WhatsApp)'; }
  }
  const inserted = await persistMessage(thread, message, content, mediaPath);
  if (!inserted || message.key.fromMe || content.kind !== 'text') return;
  // No responder a mensajes retrasados más de cinco minutos al reconectar.
  if (Date.now() - Number(message.messageTimestamp || 0) * 1000 > 5 * 60_000) return;
  const rules = await dbResult(db.from('crm_wa_rules').select('*').eq('device_id', device.id).eq('enabled', true).order('created_at'));
  for (const rule of rules) {
    if (!reglaCoincide(rule, content.body)) continue;
    const previous = await dbResult(db.from('crm_wa_rule_runs').select('last_at').eq('rule_id', rule.id).eq('thread_id', thread.id).maybeSingle());
    if (previous && Date.now() - Date.parse(previous.last_at) < rule.cooldown_minutes * 60_000) continue;
    const replies = validarPasos(rule.replies);
    await dbResult(db.from('crm_wa_rule_runs').upsert({ rule_id: rule.id, thread_id: thread.id, last_at: new Date().toISOString() }));
    for (const body of replies) {
      if (stopped || sessions.get(device.id) !== entry || entry.state !== 'connected') break;
      await sendText(device, thread, body);
      await sleep(1000);
    }
    break; // Una sola regla responde por mensaje.
  }
}
async function sendText(device, thread, body, media = null) {
  if (stopped) throw new Error('El conector está cerrándose.');
  const lease = await dbResult(db.rpc('crm_wa_lease', { p_device: device.id, p_worker: worker }));
  if (!lease) throw new Error('Otra computadora controla esta línea. No se envió el mensaje.');
  const entry = sessions.get(device.id);
  if (entry?.state !== 'connected' || !jidIndividual(thread.jid)) throw new Error('WhatsApp no está conectado o el destino es inválido.');
  let outgoing = { text: body };
  if (media) {
    const blob = await dbResult(db.storage.from('crm-wa-media').download(media.path));
    if (blob.size > 10 * 1024 * 1024) throw new Error('El adjunto supera 10 MB.');
    const buffer = Buffer.from(await blob.arrayBuffer());
    outgoing = media.kind === 'image' ? { image: buffer, caption: body, mimetype: media.mime }
      : media.kind === 'audio' ? { audio: buffer, mimetype: media.mime, ptt: false }
      : { document: buffer, mimetype: media.mime, fileName: String(media.name || 'Documento.pdf').slice(0,120), caption: body };
  }
  const message = await entry.sock.sendMessage(thread.jid, outgoing);
  if (!message?.key.id) throw new Error('WhatsApp no confirmó la aceptación del mensaje.');
  await persistMessage(thread, { ...message, key: { ...message.key, fromMe: true } }, { kind: media?.kind || 'text', body: body || `[${media?.kind || 'texto'}]` }, media?.path || null);
}
async function processCommand(device, command) {
  try {
    const requesterActive = await dbResult(db.rpc('crm_wa_requester_active', { p_command: command.id }));
    if (!requesterActive) throw new Error('El usuario que solicitó la acción ya no está activo.');
    if (command.action === 'connect') await connect(device);
    else if (command.action === 'disconnect') {
      const entry = sessions.get(device.id);
      // Desactivar primero los listeners para no iniciar una reconexión.
      entry?.sock.ev.removeAllListeners(); clearTimeout(entry?.retry);
      try { await entry?.sock.logout(); } catch { /* la sesión ya puede estar cerrada */ }
      endSocket(entry); sessions.delete(device.id);
      await fs.rm(sessionPath(device.id), { recursive: true, force: true });
      await pairing(device.id, null); await deviceState(device.id, { state: 'offline', phone: null });
    } else if (command.action === 'send') {
      const body = validarEnvio(command);
      const thread = await dbResult(db.from('crm_wa_threads').select('*').eq('id', command.payload.thread_id).eq('device_id', device.id).single());
      if (command.payload.media?.kind === 'audio' && body) throw new Error('Envía el audio y su texto en mensajes separados.');
      await sendText(device, thread, body, command.payload.media || null);
    } else throw new Error('Acción no reconocida.');
    await dbResult(db.from('crm_wa_commands').update({ state: 'done', result: command.action === 'send' ? 'WhatsApp aceptó el mensaje. Consulta su estado en la conversación.' : 'Solicitud procesada.' }).eq('id', command.id));
  } catch (error) {
    await dbResult(db.from('crm_wa_commands').update({ state: 'failed', result: error.message + (command.action === 'send' ? ' Si se interrumpió después de enviar, comprueba WhatsApp antes de repetir.' : '') }).eq('id', command.id));
  }
}
async function tick() {
  const devices = await dbResult(db.from('crm_wa_devices').select('*').eq('owner_id', userId));
  for (const device of devices) {
    const lease = await dbResult(db.rpc('crm_wa_lease', { p_device: device.id, p_worker: worker }));
    if (!lease) { endSocket(sessions.get(device.id)); sessions.delete(device.id); continue; }
    if (!sessions.has(device.id) && device.state !== 'error') {
      const hasCredentials = await fs.access(path.join(sessionPath(device.id), 'creds.json')).then(() => true).catch(() => false);
      if (hasCredentials) await serial(device.id, () => connect(device));
      else if (device.state !== 'offline') await deviceState(device.id, { state: 'offline' });
    }
    const commands = await dbResult(db.rpc('crm_wa_claim', { p_device: device.id, p_worker: worker }));
    for (const command of commands || []) await serial(device.id, () => processCommand(device, command));
  }
}
async function shutdown() {
  stopped = true;
  for (const [id, entry] of sessions) {
    endSocket(entry);
    await deviceState(id, { state: 'offline', heartbeat_at: null, worker_id: null }).catch(() => {});
    await pairing(id, null).catch(() => {});
  }
  await Promise.allSettled([...locks.values()]);
  db?.auth.stopAutoRefresh();
}
process.on('SIGINT', () => { stopped = true; });
process.on('SIGTERM', () => { stopped = true; });
try {
  await configure();
  while (!stopped) {
    try { await tick(); }
    catch (error) {
      report('El conector no pudo comunicarse con el CRM', error);
      // Sin renovar el arrendamiento no se envían mensajes ni respuestas automáticas.
      for (const entry of sessions.values()) endSocket(entry);
      sessions.clear();
    }
    await sleep(2000);
  }
} catch (error) {
  report('No se pudo iniciar el conector', error);
  console.error('Consulta docs/WHATSAPP-LOCAL.md. No compartas contraseñas ni la carpeta .whatsapp-local.');
  process.exitCode = 1;
} finally { await shutdown(); }
