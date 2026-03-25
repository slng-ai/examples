# SLNG TTS Next Demo

![SLNG TTS Demo](public/demo.gif)

[![Test it live](https://img.shields.io/badge/Test%20it%20live-Launch%20demo-0a0a0a?style=for-the-badge)](https://examples-gbcy.onrender.com/)

A Next.js app that demonstrates the SLNG Text-to-Speech API with both **REST** and **WebSocket streaming** modes. Type text, pick a model and voice, and hear it instantly — with real-time waveform visualization for WebSocket streaming.

## Prerequisites

- Node.js 18+ (recommended)
- npm, yarn, pnpm, or bun
- An SLNG API key — [get one](https://app.slng.ai)

## Getting Started

Clone only this example using sparse checkout:

```bash
git clone --filter=blob:none --no-checkout https://github.com/slng-ai/examples slng-examples
cd slng-examples

git sparse-checkout init --cone
git sparse-checkout set slng-tts-next

git checkout main
```

Install and run:

```bash
cd slng-tts-next
npm install
npm run dev
```

Open http://localhost:3000 to use the demo.

### WebSocket Mode (optional)

WebSocket streaming requires a proxy because browsers cannot set `Authorization` headers on WebSocket connections. To use WebSocket mode locally, start the proxy in a separate terminal:

```bash
npm run proxy
```

This starts a WebSocket proxy on `ws://localhost:8787`. The proxy forwards connections to the SLNG API with your API key attached as an auth header.

> **Hosted demo**: The live demo at [examples-gbcy.onrender.com](https://examples-gbcy.onrender.com/) uses a proxy hosted at [tts-next-proxy.onrender.com](https://tts-next-proxy.onrender.com). On Render's free tier, the proxy may take ~30 seconds to wake up on first use — the app handles this automatically.

## Models Supported

The UI ships with presets for multiple providers:

| Provider | Models |
|----------|--------|
| **Deepgram** | `deepgram/aura:2` |
| **Sarvam** | `sarvam/bulbul:v3` |
| **SLNG / Deepgram** | `slng/deepgram/aura:2`, `aura:2-en`, `aura:2-es` |
| **SLNG / Rime** | `slng/rime/arcana:3-en`, `:3-es`, `:3-fr`, `:3-hi`, `:ar`, `:de`, `:en`, `:es`, `:fr` |
| **Canopy Labs** | `slng/canopylabs/orpheus:en` |

## API Endpoints

### REST

```
POST https://api.slng.ai/v1/bridges/unmute/tts/{model}
```

```bash
curl "https://api.slng.ai/v1/bridges/unmute/tts/slng/deepgram/aura:2" \
  -H "Authorization: Bearer $SLNG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "aura-2-thalia-en", "text": "Hello world"}' \
  -o speech.wav
```

### WebSocket

```
wss://api.slng.ai/v1/bridges/unmute/tts/{model}
```

Connect, send an `init` message with model/voice/config, wait for `ready`, then send `text` + `flush` messages. Audio arrives as binary PCM chunks.

See full [API Reference](https://docs.slng.ai/api/tts/aura-2-slng) for more details.

## Read More

- Model docs: https://docs.slng.ai
- Voices: [Deepgram Aura](https://docs.slng.ai/voices/deepgram-aura) · [Rime Arcana](https://docs.slng.ai/voices/rime-arcana)

## Contributing

Have an idea for an improvement? Please open an issue or a PR in the main examples repo:
- https://github.com/slng-ai/examples/issues

---

<div align="center">
  <img src="https://docs.slng.ai/images/logo.svg" alt="SLNG" width="120" />
</div>
