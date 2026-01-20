# SLNG TTS Next Demo

![SLNG TTS Demo](public/demo.gif)

[![Test it live](https://img.shields.io/badge/Test%20it%20live-Launch%20demo-0a0a0a?style=for-the-badge)](https://example-tts-aura.vercel.app/)

A simple Next.js app that calls the SLNG Text-to-Speech API and plays the audio response. Just type a text and get the corresponding audio, perfect to test the API, and get request payload and cURL command used.

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
git sparse-checkout set slng-tts-next

git checkout main
```

Install and run:

```bash
npm install
npm run dev
```

Open http://localhost:3000 to use the demo.

## Models Supported

The UI currently ships with these presets (you can also type any model id):

- `slng/deepgram/aura:2` (default)
- `slng/deepgram/aura:2-es`
- `deepgram/aura:2`

## API Call (What the App Sends)

The app calls:

```
POST https://api.slng.ai/v1/tts/{model}
```

Example cURL:

```bash
curl "https://api.slng.ai/v1/tts/slng/deepgram/aura:2" \
  -H "Authorization: Bearer $SLNG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "aura-2-thalia-en",
    "text": "Hello my friend, this is just a test."
  }' \
  -o output_audio.wav
```

Notes:
- The `model` field in the JSON payload is used for the voice id (for example, `aura-2-thalia-en`).
- The app expects standard audio binary responses (not `text/event-stream`).

See full [API Reference](https://docs.slng.ai/api/tts/aura-2-slng) for more details.

## Read More About SLNG Models

- Model docs: https://docs.slng.ai

## Contributing

Have an idea for an improvement? Please open an issue or a PR in the main examples repo:
- https://github.com/slng-ai/examples/issues

---

<div align="center">
  <img src="https://docs.slng.ai/images/logo.svg" alt="SLNG" width="120" />
</div>
