# SLNG Orpheus Emotion TTS Demo

A Next.js demo showcasing emotion-controlled text-to-speech using the SLNG Orpheus model.

![Orpheus Emotion TTS Demo](https://docs.slng.ai/images/logo.svg)

## Features

- **5 Emotions**: Neutral, Happy, Sad, Angry, Surprised
- **8 Voices**: Tara, Leah, Jess, Leo, Dan, Mia, Zac, Zoe
- **Emotive Tags**: Add laughs, sighs, gasps, and more with special tags
- **Speed Control**: Adjust speech rate from 0.5x to 2.0x
- **Request Inspector**: See the API payload and cURL command

## Quick Start

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

4. Paste your [SLNG API key](https://slng.ai) and start experimenting with emotions!

## How It Works

This demo uses the SLNG Orpheus TTS API to generate speech with emotional expression:

```bash
curl "https://api.slng.ai/v1/tts/slng/canopylabs/orpheus:en" \
  -H "Authorization: Bearer $SLNG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "I am so excited to meet you!",
    "voice": "tara",
    "emotion": "happy"
  }'
```

### Available Emotions

| Emotion | Description |
|---------|-------------|
| `neutral` | Calm, balanced tone |
| `happy` | Upbeat, cheerful expression |
| `sad` | Melancholic, subdued tone |
| `angry` | Intense, frustrated expression |
| `surprised` | Startled, amazed reaction |

### Emotive Tags

Add special sounds to your text with these tags:

- `<laugh>` - Laughter
- `<chuckle>` - Light chuckle
- `<sigh>` - Sighing sound
- `<gasp>` - Surprised gasp
- `<yawn>` - Yawning
- `<groan>` - Groaning
- `<cough>` - Coughing
- `<sniffle>` - Sniffling

Example: `"That's hilarious! <laugh> I can't believe you said that."`

## Tech Stack

- [Next.js](https://nextjs.org/) 16
- [React](https://react.dev/) 19
- [TypeScript](https://www.typescriptlang.org/)
- [SLNG Orpheus API](https://docs.slng.ai)

## Learn More

- [SLNG Documentation](https://docs.slng.ai)
- [Orpheus Model Details](https://docs.slng.ai/api/tts/orpheus-english)
- [Get an API Key](https://slng.ai)
