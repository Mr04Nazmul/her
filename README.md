# Her

A single-page Bengali AI voice companion using the existing Sadia cloned voice on ElevenLabs. No photographs or image assets: the animated orb is CSS.

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
