# Her

A single-page Bengali AI voice companion using the existing Sadia cloned voice on ElevenLabs. The existing voice-only mode keeps its CSS orb. An optional live Simli video mode uses the same ElevenLabs agent and cloned voice; no prerecorded talking loop is substituted for live media.

## Run

```sh
npm ci
npm run dev
```

Production: `npm run build` generates `dist/`, which can be hosted on any HTTPS static host. Microphone access requires HTTPS (or localhost). `node --test tests/*.test.mjs` checks call lifecycle, microphone denial, and disconnection during startup.

## Features

- Live WebRTC voice conversation, microphone mute, call timer and hangup.
- Live transcript drawer and typed messages during an active call.
- Bengali permission/error messages, keyboard-accessible controls and reduced-motion support.
- Clear AI identity and pre-call explanation of audio processing and credit usage.

The page connects to the separately created **Her — Sadia** ElevenLabs agent. The agent ID is in `src/main.js`; no API keys are stored in the site or repository. The agent uses Bengali by default, a friendly conversation prompt, and voice ID `bISZi5tdhHDYIpWcbFpd`.

The current client uses a public ElevenLabs agent ID. A private hosted page does not make that agent ID secret: someone with the ID can initiate sessions against its credits. Before sharing widely, configure an origin allowlist in ElevenLabs or implement a server-side signed-session endpoint. Never add an ElevenLabs API key to browser code.

This page does not persist transcripts. ElevenLabs processing and retention follow the agent/account settings. Existing Sadia agents were not modified.

## Validation

Production build and automated lifecycle checks are run before deployment. Browser visual QA and a real microphone conversation were unavailable in the build environment; check audio on the target phone/browser.

SDK reference: https://elevenlabs.io/docs/eleven-agents/libraries/java-script


## Live video call (integration pending provider activation)

The Video call button requests a short-lived Simli token from a separate backend,
connects a real WebRTC avatar stream in the orb area, then starts the existing
ElevenLabs agent over WebSocket. Actual response PCM is downsampled to 16 kHz and
sent to Simli; synchronized sound comes from Simli alone. Interruptions clear its
queued speech. Hangup, disconnection and failed startup release both services.
The visitor's camera is never requested. This is an AI avatar, not a live human.

**Not activated:** no Simli account credential or Sadia face ID was available.
The uploaded video-call screenshot is a design reference, not a trained avatar.
No Sadia avatar has been created or tested on a paid provider. Until configured,
the button explains that video is unavailable and does not start a paid voice call.

Activation:

1. Create Sadia's custom avatar in your Simli account from an authorized clean
   portrait/video; copy its face ID. A screenshot containing call controls is not
   suitable as the final training asset.
2. From `server/`, run `npx wrangler secret put SIMLI_API_KEY` and
   `npx wrangler secret put SIMLI_FACE_ID`, then `npx wrangler deploy`.
   The worker restricts allowed site origins and uses a per-IP rate limit.
   Origin checks alone are not visitor authentication; add account-level access
   controls and usage limits before opening a paid service widely.
3. Set GitHub Actions repository variable `AVATAR_SESSION_URL` to
   `https://<worker-host>/session`, then run the Pages deployment workflow.
   The build exposes only this URL, never the provider key.
4. Test on Safari/iPhone: speech lip sync, Bengali pronunciation, interruptions,
   mute, hangup, provider failure, reconnection, and provider usage accounting.
   End-to-end video and browser QA have not been performed without credentials.

Only a configured provider can produce the live face. This integration does not
promise exact body motion or that a person is indistinguishable from reality.

Provider references:
- https://github.com/simliai/simli-client
- https://github.com/simliai/create-simli-app-elevenlabs
