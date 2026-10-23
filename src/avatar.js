import { SimliClient, LogLevel } from 'simli-client';
import { AvatarAudio } from './avatar-audio.js';

export async function connectAvatar({ endpoint, video, audio, signal, onFailure }) {
  if (!endpoint) throw new Error('লাইভ ভিডিও এখনো চালু হয়নি। অ্যাভাটার সার্ভিস যুক্ত করতে হবে। Voice call ব্যবহার করতে পারো।');
  const response = await fetch(endpoint, { method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: '{}' });
  if (!response.ok) throw new Error('ভিডিও সংযোগ পাওয়া যায়নি। পরে চেষ্টা করো অথবা Voice call ব্যবহার করো।');
  const { session_token } = await response.json();
  if (!session_token || signal.aborted) throw new Error('Video session cancelled');
  const client = new SimliClient(session_token, video, audio, null, LogLevel.ERROR, 'livekit');
  const pcm = new AvatarAudio();
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    signal.removeEventListener('abort', close);
    void client.stop().catch(() => {});
    video.srcObject = null;
    audio.srcObject = null;
  };
  signal.addEventListener('abort', close, { once: true });
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => finish(new Error('ভিডিও সংযোগে সময় বেশি লাগছে। আবার চেষ্টা করো।')), 30000);
      const abort = () => finish(new Error('Video session cancelled'));
      function finish(error) {
        clearTimeout(timeout);
        signal.removeEventListener('abort', abort);
        error ? reject(error) : resolve();
      }
      signal.addEventListener('abort', abort, { once: true });
      client.on('start', () => finish());
      client.on('startup_error', () => finish(new Error('ভিডিও চালু করা যায়নি।')));
      client.on('error', () => { if (!closed) onFailure(); });
      client.on('stop', () => { if (!closed) onFailure(); });
      Promise.resolve(client.start()).catch(finish);
    });
    if (signal.aborted) throw new Error('Video session cancelled');
    client.sendAudioData(new Uint8Array(6000));
    return {
      close,
      setFormat: (format) => pcm.setFormat(format),
      send: (base64) => { if (!closed) client.sendAudioData(pcm.convert(base64)); },
      interrupt: () => { if (!closed) client.ClearBuffer(); },
    };
  } catch (error) { close(); throw error; }
}
