<div align="center">
  <a href="https://codespaces.new/slng-ai/examples">
    <img src="https://github.com/codespaces/badge.svg" alt="Open in GitHub Codespaces" />
  </a>
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
- `slng-tts-next` - Next.js text-to-speech starter.

## Open in GitHub Codespaces
Open this repo directly in Codespaces:

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/slng-ai/examples)

## Developer resources
- Docs: https://docs.slng.ai

## Contributing and suggestions
Have an idea for a new example or an improvement? Please [open an issue](https://github.com/slng-ai/examples/issues/new) with the use case, tech stack, and expected output. Pull requests are welcome when an example is ready to share.
