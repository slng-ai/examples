# SLNG STT Demo (Next.js)

A real-time speech-to-text debugging tool using the [SLNG Voice AI API](https://docs.slng.ai).

## Features

- **Model selection** — Pick from Deepgram Nova, Whisper, Sarvam, Soniox, and more
- **Bridge or Direct** — Connect through SLNG bridges or directly to provider endpoints
- **3 input sources** — Microphone (live), file upload, or audio URL
- **WebSocket & HTTP modes** — Stream in real-time or upload files for batch transcription
- **Live transcript** — See partial and final transcription results as they arrive
- **Proxy system** — Browser-compatible WebSocket proxy for auth header injection
- **Debug console** — Full message log for inspecting the WebSocket protocol

## Getting started

```bash
npm install
```

### 1. Start the WebSocket proxy

The proxy adds the `Authorization` header that browsers can't set on WebSocket connections.

```bash
npm run proxy
```

### 2. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste your SLNG API key, and start transcribing.

### Project ID (optional)

SLNG API keys belong to your organization. The **Project ID** field picks the project that requests are billed and limited under: the demo sends it as the `X-SLNG-Project-Id` header (through the proxy for WebSocket mode). Copy the project UUID from the project's Settings page in the [dashboard](https://app.slng.ai). To prefill the field, copy `.env.example` to `.env.local` and set `SLNG_PROJECT_ID`. Leave it empty to use the key's default project.

## Architecture

```
Browser ──ws──▸ Proxy (ws://localhost:8787) ──wss──▸ SLNG API (wss://api.slng.ai/v1/stt/...)
                (adds Authorization and X-SLNG-Project-Id headers)
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_WS_PROXY_URL` | `ws://localhost:8787` | WebSocket proxy URL |
| `PORT` | `8787` | Proxy server port |
| `SLNG_PROJECT_ID` | empty | Prefills the Project ID field (see `.env.example`) |
