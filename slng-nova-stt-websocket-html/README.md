# SLNG Nova STT WebSocket Demo

![SLNG TTS Demo](public/demo.gif)

[![Test it live](https://img.shields.io/badge/Test%20it%20live-Launch%20demo-0a0a0a?style=for-the-badge)](https://example-tts-aura.vercel.app/)

A minimal HTML + JavaScript app that streams microphone or file audio to the
SLNG STT WebSocket endpoint and renders live transcripts.

## Prerequisites

- Node.js 18+ (recommended)
- npm, yarn, pnpm, or bun
- An SLNG API key [get one](https://app.slng.ai)

## Getting Started

Clone only this example using sparse checkout:

```bash
git clone --filter=blob:none --no-checkout https://github.com/slng-ai/examples slng-examples
cd slng-examples

git sparse-checkout init --cone
git sparse-checkout set slng-nova-stt-websocket-html

git checkout main
```

Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:8787 to use the demo.

## Proxy (Recommended)

Browsers cannot set custom headers on WebSocket connections. The included Node
proxy adds the `Authorization: Bearer <key>` header when connecting upstream.

In the UI:

1. Keep "Use proxy" checked.
2. Set the target WebSocket URL to the SLNG endpoint.
3. Use `ws://localhost:8787` for the proxy URL (or update if you change ports).

If you run in an environment that supports custom WS headers, you can uncheck
"Use proxy" and connect directly.

## API Call (What the App Sends)

The app connects to:

```
wss://api.slng.ai/v1/stt/slng/deepgram/nova:3-en
```

Example JSON init payload:

```json
{
  "type": "init",
  "config": {
    "encoding": "linear16",
    "sample_rate": 16000,
    "channels": 1
  }
}
```

The browser streams raw PCM16 audio chunks over the same WebSocket connection.

See full [API Reference](https://docs.slng.ai/api/stt) for more details.

## Contributing

Have an idea for an improvement? Please open an issue or a PR in the main examples repo:
- https://github.com/slng-ai/examples/issues

---

<div align="center">
  <img src="https://docs.slng.ai/images/logo.svg" alt="SLNG" width="120" />
</div>
