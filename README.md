<div align="center">
  <img src="https://docs.slng.ai/logo/dark.svg" alt="SLNG" width="120" />
  <h1>SLNG Examples</h1>
</div>

## What is SLNG?
[SLNG](https://slng.ai) is a developer platform for real-time voice and speech experiences. Use it to build text-to-speech, streaming audio, and voice interfaces with simple APIs and SDKs.

## About
These examples show how to build with [SLNG APIs](https://docs.slng.ai) and tooling. Each folder is a standalone, runnable project you can clone, study, and adapt.

## Check out a specific example
If you only want one example, use sparse checkout:

```bash
git clone --filter=blob:none --no-checkout https://github.com/slng-ai/examples slng-examples
cd slng-examples

git sparse-checkout init --cone
# Replace with the example folder you want to check out
git sparse-checkout set slng-tts-next

git checkout main
```

Replace the URL with your fork if needed.

## Current examples
- [`slng-tts-next`](./slng-tts-next) - Next.js text-to-speech demo with REST and WebSocket streaming across multiple voice providers. [Live demo](https://examples-gbcy.onrender.com)
- [`slng-stt-next`](./slng-stt-next) - Next.js speech-to-text demo with real-time WebSocket and HTTP transcription across multiple providers. [Live demo](https://slng-stt-demo.onrender.com)

## Open in GitHub Codespaces
Open this repo directly in Codespaces:

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/slng-ai/examples)

## Developer resources
- Docs: https://docs.slng.ai

## Contributing and suggestions
Have an idea for a new example or an improvement? Please [open an issue](https://github.com/slng-ai/examples/issues/new) with the use case, tech stack, and expected output. Pull requests are welcome when an example is ready to share.
