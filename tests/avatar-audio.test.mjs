import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AvatarAudio } from '../src/avatar-audio.js';
const encode = (values) => { const bytes = Buffer.alloc(values.length * 2); values.forEach((n, i) => bytes.writeInt16LE(n, i * 2)); return bytes.toString('base64'); };
test('PCM16 is unchanged at 16 kHz, including signed extremes', () => {
  const input = encode([-32768, -8, 0, 42, 32767]);
  assert.equal(Buffer.from(new AvatarAudio().convert(input)).toString('base64'), input);
});
test('24 kHz resampling preserves duration and results across chunk boundaries', () => {
  const values = Array.from({ length: 240 }, (_, i) => i * 100 - 12000);
  const one = new AvatarAudio(24000).convert(encode(values));
  const stream = new AvatarAudio(24000);
  const split = Buffer.concat([stream.convert(encode(values.slice(0, 79))), stream.convert(encode(values.slice(79)))]);
  assert.equal(one.length, 320);
  assert.deepEqual(Buffer.from(one), split);
});
test('rejects unsupported encoding rather than sending corrupt speech', () => {
  assert.throws(() => new AvatarAudio().setFormat('ulaw_8000'));
});
