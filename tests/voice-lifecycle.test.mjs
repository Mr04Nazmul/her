import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replace("import { Conversation } from '@elevenlabs/client';", '');
function setup({ deny = false, disconnectOnStart = false } = {}) {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', hidden: false, disabled: false, dataset: {}, style: { setProperty() {} }, attrs: {}, addEventListener() {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() {}, children: [], append(...items) { this.children.push(...items); }, remove() {}, value: '' });
    return elements.get(id);
  };
  let options, stopped = 0, ended = 0, muted = null, starts = 0;
  const session = { async endSession() { ended++; options.onDisconnect(); }, setMicMuted(value) { muted = value; }, getOutputVolume() { return 0; }, getInputVolume() { return 0; } };
  const context = vm.createContext({
    Conversation: { async startSession(opts) { starts++; options = opts; if (disconnectOnStart) opts.onDisconnect(); return session; } },
    document: { getElementById: get, body: { dataset: {} }, addEventListener() {}, createElement: () => get(`generated-${elements.size}`) },
    window: { isSecureContext: true, addEventListener() {} },
    navigator: { mediaDevices: { async getUserMedia() { if (deny) throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); return { getTracks: () => [{ stop() { stopped++; } }] }; } } },
    setInterval: () => 1, clearInterval() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, console,
  });
  vm.runInContext(source + '\nglobalThis.app = { beginConversation, endConversation, getState: () => state };', context);
  return { app: context.app, get, stats: () => ({ stopped, ended, muted, starts }) };
}

test('successful call releases permission probe, enables controls and cleans up on hangup', async () => {
  const fixture = setup();
  await fixture.app.beginConversation();
  assert.equal(fixture.app.getState(), 'connected');
  assert.equal(fixture.get('mute-button').disabled, false);
  assert.equal(fixture.stats().stopped, 1);
  await fixture.app.endConversation();
  assert.equal(fixture.app.getState(), 'idle');
  assert.equal(fixture.get('mute-button').disabled, true);
  assert.equal(fixture.stats().ended, 1);
});
test('denied microphone never starts a paid session and permits retry', async () => {
  const fixture = setup({ deny: true });
  await fixture.app.beginConversation();
  assert.equal(fixture.app.getState(), 'idle');
  assert.equal(fixture.stats().starts, 0);
  assert.match(fixture.get('error-message').textContent, /অনুমতি/);
  assert.equal(fixture.get('call-button').disabled, false);
});
test('disconnect during connection cannot leave a false connected state', async () => {
  const fixture = setup({ disconnectOnStart: true });
  await fixture.app.beginConversation();
  assert.equal(fixture.app.getState(), 'idle');
  assert.equal(fixture.stats().ended, 1);
  assert.equal(fixture.get('call-button').disabled, false);
});
