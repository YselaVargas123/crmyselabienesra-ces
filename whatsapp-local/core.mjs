export const PROJECT_URL = 'https://qzfnncblpsfefhsvldul.supabase.co';
export function normalizarTelefono(value) {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.length === 8) digits = '591' + digits;
  return /^\d{10,15}$/.test(digits) ? digits : null;
}
export function jidIndividual(jid) {
  return typeof jid === 'string' && /^\d{5,20}(?::\d+)?@(s\.whatsapp\.net|lid)$/.test(jid);
}
export function limpiarJid(jid) { return jid.replace(/:\d+@/, '@'); }
export function textoMensaje(message) {
  let m = message || {};
  // Desenvuelve mensajes efímeros, sin importar mensajes de protocolo/historial.
  for (let i = 0; i < 5; i++) {
    const inner = m.ephemeralMessage?.message || m.viewOnceMessageV2?.message || m.viewOnceMessage?.message || m.documentWithCaptionMessage?.message;
    if (!inner) break;
    // No se descargan archivos de visualización única.
    if (m.viewOnceMessageV2 || m.viewOnceMessage) return null;
    m = inner;
  }
  if (m.conversation || m.extendedTextMessage?.text) return { kind: 'text', body: m.conversation || m.extendedTextMessage.text, content: null };
  if (m.imageMessage) return { kind: 'image', body: m.imageMessage.caption || '[Imagen]', content: m.imageMessage };
  if (m.audioMessage) return { kind: 'audio', body: '[Audio]', content: m.audioMessage };
  if (m.documentMessage) return { kind: 'document', body: m.documentMessage.fileName || '[Documento]', content: m.documentMessage };
  return null;
}
export function reglaCoincide(rule, text) {
  const normalized = s => String(s || '').normalize('NFKC').trim().toLocaleLowerCase('es');
  const key = normalized(rule.keyword), body = normalized(text);
  return !!key && rule.enabled && (rule.match_mode === 'contains' ? body.includes(key) : body === key);
}
export function validarPasos(replies) {
  if (!Array.isArray(replies) || replies.length < 1 || replies.length > 10 || replies.some(r => typeof r !== 'string' || !r.trim() || r.length > 4000)) throw new Error('Regla inválida: de 1 a 10 respuestas de hasta 4000 caracteres.');
  return replies.map(r => r.trim());
}
export function validarEnvio(command) {
  if (command.action !== 'send' || !/^[0-9a-f-]{36}$/i.test(command.payload?.thread_id || '') || typeof command.payload?.body !== 'string' || (!command.payload.body.trim() && !command.payload.media) || command.payload.body.length > 4000) throw new Error('Solicitud de mensaje inválida.');
  if (command.payload.media) {
    const media = command.payload.media;
    if (!['image','audio','document'].includes(media.kind) || !media.path?.startsWith(`outgoing/${command.requested_by}/`) || !/^outgoing\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/i.test(media.path)) throw new Error('Archivo adjunto inválido.');
    const allowed = { image: ['image/jpeg','image/png','image/webp'], audio: ['audio/ogg','audio/mpeg','audio/mp4','audio/wav'], document: ['application/pdf'] };
    if (!allowed[media.kind].includes(media.mime)) throw new Error('Formato de adjunto no permitido.');
  }
  if (Date.parse(command.expires_at) < Date.now()) throw new Error('El mensaje venció sin enviarse.');
  return command.payload.body.trim();
}
export function demoraReconexion(attempt) { return Math.min(60_000, 3000 * 2 ** Math.max(0, attempt - 1)); }
