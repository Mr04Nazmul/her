import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8').replace("import { Conversation } from '@elevenlabs/client';", '');
function setup({ deny = false, disconnectOnStart = false, inputData, outputData, url = 'https://itsmesadia.com/' } = {}) {
  const elements = new Map();
  const get = (id) => {
    if (!elements.has(id)) elements.set(id, { textContent: '', hidden: false, disabled: false, dataset: {}, style: { setProperty() {} }, attrs: {}, handlers: {}, addEventListener(name, fn) { this.handlers[name] = fn; }, setAttribute(k, v) { this.attrs[k] = v; }, focus() {}, children: [], append(...items) { this.children.push(...items); }, remove() {}, value: '' });
    return elements.get(id);
  };
  get('voice-bars').children = Array.from({ length: 40 }, (_, i) => get(`bar-${i}`));
  let redirected;
  const location = new URL(url);
  location.replace = (value) => { redirected = value; };
  let options, stopped = 0, ended = 0, muted = null, starts = 0;
  const session = { async endSession() { ended++; options.onDisconnect(); }, setMicMuted(value) { muted = value; }, getOutputVolume() { return 0; }, getInputVolume() { return 0; }, getInputByteFrequencyData() { return inputData; }, getOutputByteFrequencyData() { return outputData; } };
  const context = vm.createContext({
    Conversation: { async startSession(opts) { starts++; options = opts; if (disconnectOnStart) opts.onDisconnect(); return session; } },
    document: { getElementById: get, body: { dataset: {} }, addEventListener() {}, createElement: () => get(`generated-${elements.size}`) },
    URL,
    window: { location, isSecureContext: location.protocol === 'https:', addEventListener() {} },
    navigator: { mediaDevices: { async getUserMedia() { if (deny) throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); return { getTracks: () => [{ stop() { stopped++; } }] }; } } },
    setInterval: () => 1, clearInterval() {}, requestAnimationFrame: () => 1, cancelAnimationFrame() {}, console,
  });
  vm.runInContext(source + '\nglobalThis.app = { beginConversation, endConversation, renderAudio: animateOrb, getState: () => state };', context);
  return { app: context.app, get, stats: () => ({ stopped, ended, muted, starts, redirected }) };
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

test('waveform follows real input and playback; mute suppresses only input and hangup resets all bars', async () => {
  const inputData = new Uint8Array(128).fill(255);
  const outputData = new Uint8Array(128);
  const fixture = setup({ inputData, outputData });
  await fixture.app.beginConversation();
  const bar = fixture.get('bar-10');
  assert.ok(Number(bar.attrs.height) > 4, 'microphone energy raises bars');
  fixture.get('mute-button').handlers.click();
  for (let i = 0; i < 80; i++) fixture.app.renderAudio();
  assert.ok(Number(bar.attrs.height) <= 4.01, 'muted input decays to silence');
  outputData.fill(220);
  fixture.app.renderAudio();
  assert.ok(Number(bar.attrs.height) > 4, 'Sadia playback still animates while mic is muted');
  assert.equal(fixture.stats().stopped, 1, 'visualizer never requests another microphone stream');
  await fixture.app.endConversation();
  for (const element of fixture.get('voice-bars').children) {
    assert.equal(element.attrs.height, '4');
    assert.equal(element.attrs.y, '28');
  }
  assert.equal(fixture.get('voice-monitor').dataset.mode, 'idle');
});

test('HTTP call button upgrades the same address before consent, microphone or session', async () => {
  const fixture = setup({ url: 'http://itsmesadia.com/?from=phone#voice' });
  fixture.get('call-button').handlers.click();
  assert.equal(fixture.stats().redirected, 'https://itsmesadia.com/?from=phone#voice');
  assert.equal(fixture.stats().starts, 0);
  assert.equal(fixture.stats().stopped, 0);
  assert.equal(fixture.app.getState(), 'idle');
  await fixture.app.beginConversation();
  assert.equal(fixture.stats().starts, 0);
});

test('switching to voice unloads the embedded video session', async () => {
  const fixture = setup();
  await fixture.app.beginConversation();
  assert.equal(fixture.get('avatar-frame').attrs.src, 'about:blank');
  assert.equal(fixture.get('avatar-stage').hidden, true);
  assert.equal(fixture.get('video-call-button').disabled, true);
  await fixture.app.endConversation();
  assert.equal(fixture.get('video-call-button').disabled, false);
});

test('video controls reopen the published persona and close by unloading it', () => {
  const fixture = setup();
  fixture.get('video-call-button').handlers.click();
  assert.equal(fixture.get('avatar-frame').attrs.src, 'https://lab.anam.ai/frame/aa71016b-f700-5441-b565-69876ce7619f');
  assert.equal(fixture.get('avatar-stage').hidden, false);
  assert.equal(fixture.stats().starts, 0);
  fixture.get('close-video-button').handlers.click();
  assert.equal(fixture.get('avatar-frame').attrs.src, 'about:blank');
  assert.equal(fixture.get('avatar-stage').hidden, true);
});
