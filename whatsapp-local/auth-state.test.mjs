import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { useAuthStateSeguro } from './auth-state.mjs';

test('guarda en paralelo sin truncar las credenciales y recupera el respaldo', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'crm-wa-test-'));
  try {
    const initial = await useAuthStateSeguro(dir);
    await Promise.all(Array.from({ length: 12 }, () => initial.saveCreds()));
    const credsPath = path.join(dir, 'creds.json');
    assert.ok(JSON.parse(await fs.readFile(credsPath, 'utf8')).registrationId);
    const reopened = await useAuthStateSeguro(dir);
    assert.equal(reopened.state.creds.registrationId, initial.state.creds.registrationId);
    await fs.writeFile(credsPath, '');
    const restored = await useAuthStateSeguro(dir);
    assert.equal(restored.state.creds.registrationId, initial.state.creds.registrationId);
  } finally {
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep));
    assert.ok(path.basename(dir).startsWith('crm-wa-test-'));
    await fs.rm(dir, { recursive: true, force: true });
  }
});
