import { Conversation } from '@elevenlabs/client';

const AGENT_ID = 'agent_1401m5h48y1yf47vfts6vvfzcbea';
const $ = (id) => document.getElementById(id);
let conversation = null;
let state = 'idle';
let muted = false;
let accepted = false;
let startAfterDialog = false;
let sessionEpoch = 0;
let startedAt = 0;
let timer = null;
let animationFrame = null;
let endedDuringStart = false;
let sessionError = '';
let audioMode = 'listening';
const voiceBars = Array.from($('voice-bars').children);
const barLevels = voiceBars.map(() => 4);

function setState(next) {
  state = next;
  updateVoiceMode();
  const active = next === 'connected';
  document.body.dataset.connected = String(active);
  $('orb-scene').dataset.state = active ? (muted ? 'muted' : 'listening') : next;
  $('video-call-button').disabled = next !== 'idle';
  $('call-button').disabled = next === 'connecting' || next === 'ending';
  $('call-label').textContent = active ? 'End conversation' : next === 'connecting' ? 'Connecting…' : next === 'ending' ? 'Ending…' : 'Let’s talk';
  $('button-arrow').textContent = active ? '×' : '↗';
  $('call-icon').style.display = active ? 'none' : '';
  $('mute-button').disabled = !active;
  $('message-input').disabled = !active;
  $('send-button').disabled = !active;
  $('duration').hidden = !active;
  $('status').textContent = active ? 'Listening to you' : next === 'connecting' ? 'Finding your connection' : next === 'ending' ? 'Finishing our conversation' : 'Ready when you are';
  $('call-hint').textContent = active ? 'Speak naturally. You can interrupt anytime.' : 'Just unmute your world. We’ll take it from here.';
}

function showError(message) {
  $('error-message').textContent = message;
  $('error-message').hidden = !message;
}

function resetSession() {
  clearInterval(timer);
  cancelAnimationFrame(animationFrame);
  timer = null;
  animationFrame = null;
  conversation = null;
  muted = false;
  audioMode = 'listening';
  resetVoiceBars();
  $('mute-button').setAttribute('aria-pressed', 'false');
  $('mute-button').setAttribute('aria-label', 'Mute microphone');
  $('orb-scene').style.setProperty('--level', '0');
  setState('idle');
}

function renderMessage(event) {
  if (!event.message?.trim()) return;
  $('empty-state')?.remove();
  const role = event.source === 'user' || event.role === 'user' ? 'user' : 'agent';
  const item = document.createElement('div');
  item.className = 'message';
  item.dataset.role = role;
  const label = document.createElement('small');
  label.textContent = role === 'user' ? 'YOU' : 'HER';
  const body = document.createElement('p');
  body.textContent = event.message;
  item.append(label, body);
  $('messages').append(item);
  while ($('messages').children.length > 150) $('messages').firstElementChild.remove();
  $('messages').scrollTop = $('messages').scrollHeight;
}

function friendlyError(error) {
  const name = error?.name || '';
  const raw = String(error?.message || error || '').toLowerCase();
  if (name === 'NotAllowedError' || /permission|denied|notallowed/.test(raw)) return 'মাইক্রোফোনের অনুমতি পাওয়া যায়নি। ব্রাউজারের সেটিংসে অনুমতি দিয়ে আবার চেষ্টা করো।';
  if (name === 'NotFoundError' || /notfound|microphone.*found|device.*found/.test(raw)) return 'মাইক্রোফোন পাওয়া যায়নি। একটি মাইক্রোফোন যুক্ত করে আবার চেষ্টা করো।';
  if (/quota|credit|limit|payment/.test(raw)) return 'ElevenLabs-এর ক্রেডিট বা কলের সীমা শেষ হয়েছে। অ্যাকাউন্টের ব্যালান্স চেক করো।';
  return 'সংযোগ করা যায়নি। ইন্টারনেট ও মাইক্রোফোনের অনুমতি চেক করে আবার চেষ্টা করো।';
}

function upgradeToHttps() {
  if (window.location?.protocol !== 'http:') return false;
  const secureUrl = new URL(window.location.href);
  secureUrl.protocol = 'https:';
  window.location.replace(secureUrl.href);
  return true;
}

function closeVideo() {
  $('avatar-frame').setAttribute('src', 'about:blank');
  $('avatar-stage').hidden = true;
  $('orb-scene').hidden = false;
  $('close-video-button').hidden = true;
}

async function beginConversation() {
  closeVideo();
  if (state !== 'idle' || upgradeToHttps()) return;
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    showError('কথা বলতে HTTPS-এ সাইটটি Safari বা Chrome-এ খোলো।');
    return;
  }
  const epoch = ++sessionEpoch;
  endedDuringStart = false;
  sessionError = '';
  showError('');
  setState('connecting');
  try {
    // Request permission on this user action. Release the probe; the SDK owns the call's stream.
    const probe = await navigator.mediaDevices.getUserMedia({ audio: true });
    probe.getTracks().forEach((track) => track.stop());
    if (epoch !== sessionEpoch) return;
    const current = await Conversation.startSession({
      agentId: AGENT_ID,
      connectionType: 'webrtc',
      onMessage: (event) => { if (epoch === sessionEpoch) renderMessage(event); },
      onModeChange: ({ mode }) => {
        if (epoch !== sessionEpoch || state !== 'connected') return;
        audioMode = mode;
        updateVoiceMode();
        $('orb-scene').dataset.state = muted ? 'muted' : mode;
        $('status').textContent = mode === 'speaking' ? 'Her is speaking' : muted ? 'Your microphone is muted' : 'Listening to you';
      },
      onDisconnect: () => {
        if (epoch !== sessionEpoch) return;
        endedDuringStart = true;
        const hadError = sessionError;
        resetSession();
        if (hadError) showError(hadError);
      },
      onError: (message) => {
        if (epoch !== sessionEpoch) return;
        sessionError = friendlyError(message);
        showError(sessionError);
        if (conversation) void endConversation();
      },
    });
    if (epoch !== sessionEpoch || endedDuringStart || sessionError) {
      await current.endSession();
      if (epoch === sessionEpoch) { resetSession(); showError(sessionError || 'সংযোগটি বন্ধ হয়ে গেছে। আবার চেষ্টা করো।'); }
      return;
    }
    conversation = current;
    setState('connected');
    startedAt = Date.now();
    $('duration').textContent = '00:00';
    timer = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedAt) / 1000);
      $('duration').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    }, 1000);
    animateOrb();
  } catch (error) {
    if (epoch !== sessionEpoch) return;
    resetSession();
    showError(friendlyError(error));
  }
}

async function endConversation() {
  if (!conversation) return;
  const current = conversation;
  setState('ending');
  try { await current.endSession(); }
  catch { showError('কলটি বন্ধ হয়েছে। নতুন করে কথা শুরু করতে পারো।'); }
  finally { resetSession(); }
}

function updateVoiceMode() {
  const mode = state !== 'connected' ? state : audioMode === 'speaking' ? 'speaking' : muted ? 'muted' : 'listening';
  $('voice-monitor').dataset.mode = mode;
  $('voice-source').textContent = mode === 'speaking' ? 'SADIA IS SPEAKING' : mode === 'listening' ? 'YOUR MICROPHONE' : mode === 'muted' ? 'MICROPHONE MUTED' : 'SADIA ↔ YOU';
  $('voice-caption').textContent = mode === 'speaking' ? 'Sadia বলছে…' : mode === 'listening' ? 'বলো, আমি শুনছি…' : mode === 'muted' ? 'তোমার মাইক বন্ধ আছে' : mode === 'connecting' ? 'সংযোগ হচ্ছে…' : mode === 'ending' ? 'কথোপকথন শেষ হচ্ছে…' : 'কথা শুরু করলেই কণ্ঠের সঙ্গে নড়বে';
}

function resetVoiceBars() {
  voiceBars.forEach((bar, i) => {
    barLevels[i] = 4;
    bar.setAttribute('height', '4');
    bar.setAttribute('y', '28');
  });
}

function paintVoiceBars(input, output, inputVolume, outputVolume) {
  voiceBars.forEach((bar, i) => {
    // Log-spaced bins emphasize speech frequencies. Both sides can animate;
    // muting removes only microphone energy, never the agent's playback.
    const energy = (data) => {
      if (!data?.length) return 0;
      const start = Math.min(data.length - 1, Math.floor(Math.pow(i / voiceBars.length, 2) * data.length * .38));
      const end = Math.min(data.length, Math.max(start + 1, Math.ceil(Math.pow((i + 1) / voiceBars.length, 2) * data.length * .38)));
      let sum = 0;
      for (let bin = start; bin < end; bin++) sum += data[bin];
      return sum / (end - start) / 255;
    };
    const micEnergy = muted ? 0 : input?.length ? energy(input) : inputVolume;
    const agentEnergy = output?.length ? energy(output) : outputVolume;
    const level = Math.min(1, Math.max(0, micEnergy, agentEnergy));
    const target = 4 + Math.pow(level, .8) * 48;
    barLevels[i] += (target - barLevels[i]) * (target > barLevels[i] ? .42 : .16);
    bar.setAttribute('height', barLevels[i].toFixed(2));
    bar.setAttribute('y', ((60 - barLevels[i]) / 2).toFixed(2));
  });
}

function animateOrb() {
  if (!conversation || state !== 'connected') return;
  let inputVolume = 0, outputVolume = 0, input, output;
  try {
    outputVolume = conversation.getOutputVolume() || 0;
    inputVolume = muted ? 0 : conversation.getInputVolume() || 0;
  } catch { /* A device may lack volume analysis. */ }
  try { if (!muted) input = conversation.getInputByteFrequencyData?.(); } catch { /* Fall back to microphone volume. */ }
  try { output = conversation.getOutputByteFrequencyData?.(); } catch { /* Fall back to playback volume. */ }
  $('orb-scene').style.setProperty('--level', String(Math.min(1, Math.max(inputVolume, outputVolume))));
  paintVoiceBars(input, output, inputVolume, outputVolume);
  animationFrame = requestAnimationFrame(animateOrb);
}

function openDialog(start = false) {
  startAfterDialog = start;
  $('dialog-action').firstElementChild.textContent = start ? 'Agree & start talking' : 'Got it';
  $('info-dialog').showModal();
}

$('video-call-button').addEventListener('click', () => {
  if (state !== 'idle' || upgradeToHttps()) return;
  $('avatar-frame').setAttribute('src', 'https://lab.anam.ai/frame/aa71016b-f700-5441-b565-69876ce7619f');
  $('avatar-stage').hidden = false;
  $('orb-scene').hidden = true;
  $('close-video-button').hidden = false;
});
$('close-video-button').addEventListener('click', closeVideo);

$('call-button').addEventListener('click', () => {
  if (state === 'connected') return void endConversation();
  if (upgradeToHttps()) return;
  if (!accepted) return openDialog(true);
  void beginConversation();
});
$('dialog-action').addEventListener('click', () => {
  const shouldStart = startAfterDialog;
  startAfterDialog = false;
  $('info-dialog').close();
  if (shouldStart) { accepted = true; void beginConversation(); }
});
$('dialog-close').addEventListener('click', () => $('info-dialog').close());
$('info-dialog').addEventListener('close', () => { startAfterDialog = false; });
$('about-button').addEventListener('click', () => openDialog());
$('privacy-button').addEventListener('click', () => openDialog());
$('mute-button').addEventListener('click', () => {
  if (!conversation || state !== 'connected') return;
  muted = !muted;
  conversation.setMicMuted(muted);
  updateVoiceMode();
  $('mute-button').setAttribute('aria-pressed', String(muted));
  $('mute-button').setAttribute('aria-label', muted ? 'Unmute microphone' : 'Mute microphone');
  $('status').textContent = muted ? 'Your microphone is muted' : 'Listening to you';
  $('orb-scene').dataset.state = muted ? 'muted' : 'listening';
});
function toggleTranscript(open) {
  $('transcript-panel').hidden = !open;
  $('transcript-button').setAttribute('aria-expanded', String(open));
  document.body.dataset.transcript = String(open);
  if (open && !$('message-input').disabled) $('message-input').focus();
  if (!open) $('transcript-button').focus();
}
$('transcript-button').addEventListener('click', () => toggleTranscript($('transcript-panel').hidden));
$('close-transcript').addEventListener('click', () => toggleTranscript(false));
document.addEventListener('keydown', (event) => { if (event.key === 'Escape' && !$('transcript-panel').hidden) toggleTranscript(false); });
$('message-input').addEventListener('input', () => { conversation?.sendUserActivity(); });
$('message-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const message = $('message-input').value.trim();
  if (!message || !conversation || state !== 'connected') return;
  try {
    conversation.sendUserMessage(message);
    renderMessage({ source: 'user', message });
    $('message-input').value = '';
  } catch { showError('মেসেজ পাঠানো যায়নি। আবার চেষ্টা করো।'); }
});
window.addEventListener('pagehide', () => {
  ++sessionEpoch;
  void conversation?.endSession();
  resetSession();
});
setState('idle');
