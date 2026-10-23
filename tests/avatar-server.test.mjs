import { test } from 'node:test';
import assert from 'node:assert/strict';
import worker from '../server/avatar-worker.js';
const request = (origin = 'https://itsmesadia.com', method = 'POST') => new Request('https://avatar.example/session', { method, headers: { Origin: origin } });
test('token endpoint rejects untrusted origins before provider access', async () => {
  assert.equal((await worker.fetch(request('https://evil.example'), { ALLOWED_ORIGINS: 'https://itsmesadia.com' })).status, 403);
});
test('unconfigured service fails closed without minting a paid session', async () => {
  assert.equal((await worker.fetch(request(), { ALLOWED_ORIGINS: 'https://itsmesadia.com' })).status, 503);
});
test('preflight permits only the configured origin and does not need secrets', async () => {
  const response = await worker.fetch(request(undefined, 'OPTIONS'), { ALLOWED_ORIGINS: 'https://itsmesadia.com' });
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://itsmesadia.com');
});
test('rate limiting prevents provider calls', async () => {
  const env = { ALLOWED_ORIGINS: 'https://itsmesadia.com', SIMLI_API_KEY: 'not-a-real-key', SIMLI_FACE_ID: 'test', SESSION_LIMITER: { async limit() { return { success: false }; } } };
  assert.equal((await worker.fetch(request(), env)).status, 429);
});
