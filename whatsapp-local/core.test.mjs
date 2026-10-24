import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizarTelefono, jidIndividual, limpiarJid, textoMensaje, reglaCoincide, validarPasos, validarEnvio, demoraReconexion } from './core.mjs';

test('normaliza números de Bolivia y conserva números internacionales', () => {
  assert.equal(normalizarTelefono('7712 3456'), '59177123456');
  assert.equal(normalizarTelefono('+54 9 11 1234 5678'), '5491112345678');
  assert.equal(normalizarTelefono('abc'), null);
});
test('excluye grupos, estados y difusión de las automatizaciones', () => {
  assert.equal(jidIndividual('59177123456@s.whatsapp.net'), true);
  assert.equal(jidIndividual('123456789@lid'), true);
  for (const jid of ['status@broadcast', '123@g.us', '123@newsletter']) assert.equal(jidIndividual(jid), false);
  assert.equal(limpiarJid('59177123456:3@s.whatsapp.net'), '59177123456@s.whatsapp.net');
});
test('extrae texto y respeta archivos de visualización única', () => {
  assert.equal(textoMensaje({ ephemeralMessage: { message: { conversation: 'Hola' } } }).body, 'Hola');
  assert.equal(textoMensaje({ protocolMessage: {} }), null);
  assert.equal(textoMensaje({ viewOnceMessageV2: { message: { imageMessage: {} } } }), null);
});
test('reglas exactas y parciales: desactivadas nunca responden', () => {
  const rule = { enabled: true, keyword: ' Alquiler ', match_mode: 'exact' };
  assert.equal(reglaCoincide(rule, 'ALQUILER'), true);
  assert.equal(reglaCoincide(rule, 'Busco alquiler'), false);
  assert.equal(reglaCoincide({ ...rule, match_mode: 'contains' }, 'Busco alquiler'), true);
  assert.equal(reglaCoincide({ ...rule, enabled: false }, 'alquiler'), false);
  assert.throws(() => validarPasos(Array(11).fill('hola')));
});
test('rechaza mensajes vencidos o malformados sin enviarlos', () => {
  const c = { action: 'send', payload: { thread_id: '00000000-0000-4000-8000-000000000001', body: ' Hola ' }, expires_at: new Date(Date.now() + 60_000).toISOString() };
  assert.equal(validarEnvio(c), 'Hola');
  assert.throws(() => validarEnvio({ ...c, expires_at: '2000-01-01' }));
  assert.throws(() => validarEnvio({ ...c, payload: { ...c.payload, body: '' } }));
  assert.equal(demoraReconexion(20), 60_000);
});

test('los adjuntos deben pertenecer a quien solicitó el envío', () => {
  const user = '00000000-0000-4000-8000-000000000002';
  const c = { action: 'send', requested_by: user, payload: { thread_id: '00000000-0000-4000-8000-000000000001', body: '', media: { path: `outgoing/${user}/00000000-0000-4000-8000-000000000003`, kind: 'document', mime: 'application/pdf' } }, expires_at: new Date(Date.now() + 60_000).toISOString() };
  assert.equal(validarEnvio(c), '');
  assert.throws(() => validarEnvio({ ...c, requested_by: 'otro-usuario' }));
  assert.throws(() => validarEnvio({ ...c, payload: { ...c.payload, media: { ...c.payload.media, path: 'outgoing/../../archivo' } } }));
});
