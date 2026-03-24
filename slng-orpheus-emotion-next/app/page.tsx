"use client";

import { useRef, useState } from "react";

type TtsPayload = {
  prompt: string;
  voice?: string;
  emotion?: string;
  speed?: number;
};

const emotions = [
  { value: "", label: "Auto (from text)", emoji: "✨" },
  { value: "neutral", label: "Neutral", emoji: "😐" },
  { value: "happy", label: "Happy", emoji: "😊" },
  { value: "sad", label: "Sad", emoji: "😢" },
  { value: "angry", label: "Angry", emoji: "😠" },
  { value: "surprised", label: "Surprised", emoji: "😲" },
];

const voices = [
  { value: "tara", label: "Tara (default)" },
  { value: "leah", label: "Leah" },
  { value: "jess", label: "Jess" },
  { value: "leo", label: "Leo" },
  { value: "dan", label: "Dan" },
  { value: "mia", label: "Mia" },
  { value: "zac", label: "Zac" },
  { value: "zoe", label: "Zoe" },
];

const promptSuggestions = [
  {
    label: "Exciting news",
    prompt: "I just got the job! I can't believe it, this is the best day ever!",
    emotion: "happy",
  },
  {
    label: "Bad day",
    prompt: "I lost my keys again, and now I'm stuck outside in the rain.",
    emotion: "sad",
  },
  {
    label: "Big surprise",
    prompt: "Wait, you're telling me I won the lottery? Are you serious right now?",
    emotion: "surprised",
  },
  {
    label: "Frustration",
    prompt: "This is the third time the server has crashed today. Unbelievable!",
    emotion: "angry",
  },
];

const emotiveTags = [
  { tag: "<laugh>", label: "Laugh" },
  { tag: "<chuckle>", label: "Chuckle" },
  { tag: "<sigh>", label: "Sigh" },
  { tag: "<gasp>", label: "Gasp" },
  { tag: "<yawn>", label: "Yawn" },
  { tag: "<groan>", label: "Groan" },
  { tag: "<cough>", label: "Cough" },
  { tag: "<sniffle>", label: "Sniffle" },
];

export default function Home() {
  const [text, setText] = useState("Hello! I'm so excited to meet you. This is going to be amazing!");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.slng.ai");
  const [emotion, setEmotion] = useState("");
  const [voice, setVoice] = useState("tara");
  const [speed, setSpeed] = useState("1.0");
  const [status, setStatus] = useState("");
  const [statusIsError, setStatusIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [hasAudio, setHasAudio] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  const setStatusMessage = (message: string, isError = false) => {
    setStatus(message);
    setStatusIsError(isError);
  };

  // The Orpheus API returns raw PCM audio data. Browsers need a WAV header
  // to play it, so we prepend a standard 44-byte RIFF/WAVE header.
  const wrapPcmInWav = (pcmData: Uint8Array, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Uint8Array => {
    const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
    const blockAlign = numChannels * (bitsPerSample / 8);
    const dataSize = pcmData.byteLength;
    const headerSize = 44;
    const wav = new Uint8Array(headerSize + dataSize);
    const view = new DataView(wav.buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, "RIFF");
    view.setUint32(4, 36 + dataSize, true);
    writeString(8, "WAVE");
    writeString(12, "fmt ");
    view.setUint32(16, 16, true);            // PCM format
    view.setUint16(20, 1, true);             // Audio format: 1 = PCM
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, "data");
    view.setUint32(40, dataSize, true);
    wav.set(pcmData, headerSize);

    return wav;
  };

  // Play audio bytes in the browser. Wraps PCM in WAV if needed.
  const playAudio = (bytes: Uint8Array, contentType?: string) => {
    const isPcm = !contentType || contentType.includes("pcm");
    const audioData = isPcm ? wrapPcmInWav(bytes) : bytes;
    const mimeType = isPcm ? "audio/wav" : contentType;
    const blob = new Blob([audioData.buffer as ArrayBuffer], { type: mimeType });
    const url = URL.createObjectURL(blob);

    if (audioRef.current) {
      audioRef.current.src = url;
      setHasAudio(true);
      audioRef.current.play().catch(() => {
        setStatusMessage("Audio ready. Press play to listen.");
      });
    }
  };

  // Handle Server-Sent Events (SSE) streaming responses.
  // The API streams status updates as JSON events, then delivers audio.
  const handleSseResponse = async (response: Response) => {
    if (!response.body) {
      throw new Error("Streaming response body is not available.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let audioBase64 = "";
    let gotAudio = false;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by double newlines
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        // Extract "data:" lines from each SSE event
        const data = chunk
          .split("\n")
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart())
          .join("\n")
          .trim();

        if (!data) continue;
        if (data === "[DONE]" || data === "[done]") return gotAudio;

        try {
          const event = JSON.parse(data) as {
            message?: string;
            audio_url?: string;
            audio_base64?: string;
            audio?: string;
            is_final?: boolean;
          };
          if (event.message) setStatusMessage(event.message);
          if (event.audio_url) {
            if (audioRef.current) {
              audioRef.current.src = event.audio_url;
              setHasAudio(true);
            }
            gotAudio = true;
          }
          if (event.audio_base64 || event.audio) {
            audioBase64 += event.audio_base64 || event.audio || "";
            gotAudio = true;
          }
          if (event.is_final) break;
        } catch {
          setStatusMessage(data);
        }
      }
    }

    // Decode accumulated base64 audio and play it
    if (audioBase64) {
      const binary = atob(audioBase64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      playAudio(bytes);
      gotAudio = true;
    }

    return gotAudio;
  };

  // ── Main API call ──────────────────────────────────────────────────
  // POST to the Orpheus TTS endpoint with text, voice, emotion, and speed.
  // The response is either a binary audio stream or SSE events.
  const generateAudio = async () => {
    if (!apiKey.trim()) {
      setStatusMessage("Enter your SLNG API key.", true);
      return;
    }
    if (!text.trim()) {
      setStatusMessage("Enter some text to synthesize.", true);
      return;
    }

    setStatusMessage("");
    setIsBusy(true);

    try {
      // Build the request payload — only include optional fields when set
      const body: TtsPayload = { prompt: text.trim() };
      if (voice) body.voice = voice;
      if (emotion) body.emotion = emotion;
      const speedValue = parseFloat(speed);
      if (!isNaN(speedValue) && speedValue !== 1.0) body.speed = speedValue;

      const base = baseUrl.trim().replace(/\/+$/, "") || "https://api.slng.ai";
      const endpoint = `${base}/v1/tts/slng/canopylabs/orpheus:en`;

      // Make the API request
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,  // Your SLNG API key
          Accept: "text/event-stream",                // Request SSE streaming
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API error ${response.status}: ${errorBody}`);
      }

      // Handle the response based on content type
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("text/event-stream")) {
        // SSE: API streams status updates, then delivers audio
        setStatusMessage("Streaming audio...");
        const gotAudio = await handleSseResponse(response);
        if (!gotAudio) {
          setStatusMessage("Stream ended without audio.", true);
        }
      } else {
        // Binary: API returns audio bytes directly (typically audio/pcm)
        const bytes = new Uint8Array(await response.arrayBuffer());
        playAudio(bytes, contentType);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate audio.";
      setStatusMessage(message, true);
    } finally {
      setIsBusy(false);
    }
  };

  const insertEmotiveTag = (tag: string) => {
    const textarea = textAreaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setText(text.slice(0, start) + tag + text.slice(end));

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + tag.length;
    }, 0);
  };

  const isMissingApiKey = apiKey.trim().length === 0;
  const isSpeakDisabled = isBusy || isMissingApiKey;

  // Compute these inline for the "Show how this works" panel
  const base = baseUrl.trim().replace(/\/+$/, "") || "https://api.slng.ai";
  const inspectEndpoint = `${base}/v1/tts/slng/canopylabs/orpheus:en`;
  const inspectPayload: TtsPayload = { prompt: text.trim() };
  if (voice) inspectPayload.voice = voice;
  if (emotion) inspectPayload.emotion = emotion;
  const speedVal = parseFloat(speed);
  if (!isNaN(speedVal) && speedVal !== 1.0) inspectPayload.speed = speedVal;
  const curlPreview = `curl "${inspectEndpoint}" \\\n  -H "Authorization: Bearer $SLNG_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(inspectPayload)}' \\\n  -o output_audio.wav`;

  return (
    <div className="page">
      <header className="page-header">
        <div className="brand">
          <div className="logo">
            <img
              src="https://www.datocms-assets.com/182222/1763142110-logo.svg"
              alt="SLNG"
            />
          </div>
          <div>
            <p className="brand-title">SLNG</p>
            <span className="brand-subtitle">Orpheus Emotion Demo</span>
          </div>
        </div>
      </header>

      <div className="card">
        <h1>Emotion-Controlled TTS</h1>
        <p>Choose an emotion and hear the difference in voice expression.</p>

        <label htmlFor="textInput">Text to speak</label>
        <div className="text-editor">
          <div className="emotive-toolbar">
            <span className="toolbar-label">Insert tag:</span>
            {emotiveTags.map((t) => (
              <button
                key={t.tag}
                className="toolbar-btn"
                type="button"
                onClick={() => insertEmotiveTag(t.tag)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            id="textInput"
            ref={textAreaRef}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Type something expressive..."
          />
        </div>

        <div className="prompt-chips">
          <span className="toolbar-label">Examples &mdash; prefills text + emotion</span>
          {promptSuggestions.map((suggestion) => (
            <button
              key={suggestion.prompt}
              className="chip"
              type="button"
              onClick={() => {
                setText(suggestion.prompt);
                setEmotion(suggestion.emotion);
                textAreaRef.current?.focus();
              }}
            >
              {suggestion.label}
            </button>
          ))}
        </div>

        <div className="output-settings">
          <label id="emotionLabel">Emotion</label>
          <div className="emotion-selector" role="group" aria-labelledby="emotionLabel">
            {emotions.map((e) => (
              <button
                key={e.value}
                type="button"
                className={`emotion-chip ${emotion === e.value ? "selected" : ""}`}
                aria-pressed={emotion === e.value}
                onClick={() => setEmotion(emotion === e.value ? "" : e.value)}
              >
                <span className="emoji">{e.emoji}</span>
                {e.label}
              </button>
            ))}
          </div>

          <div className="row">
            <div>
              <div className="label-row">
                <label htmlFor="voiceSelect">Voice</label>
                <a
                  className="label-link"
                  href="https://docs.slng.ai/voices/orpheus?utm_source=slng-demo&utm_medium=example&utm_campaign=orpheus-emotion"
                  target="_blank"
                  rel="noopener"
                >
                  Discover voices &rarr;
                </a>
              </div>
              <select
                id="voiceSelect"
                value={voice}
                onChange={(event) => setVoice(event.target.value)}
              >
                {voices.map((v) => (
                  <option key={v.value} value={v.value}>
                    {v.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="label-row">
                <label htmlFor="apiKeyInput">API Key</label>
                <a
                  className="label-link"
                  href="https://slng.ai?utm_source=slng-demo&utm_medium=example&utm_campaign=orpheus-emotion"
                  target="_blank"
                  rel="noopener"
                >
                  Get API key &rarr;
                </a>
              </div>
              <input
                id="apiKeyInput"
                type="password"
                placeholder="Paste your SLNG API key"
                autoComplete="off"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
            </div>
          </div>

          <div className="action-row">
            <button
              className={`hero-button ${isBusy ? "is-loading" : ""} ${
                isMissingApiKey ? "is-disabled" : ""
              }`}
              onClick={generateAudio}
              disabled={isSpeakDisabled}
            >
              <span className="pulse" aria-hidden="true"></span>
              {isBusy ? "Generating..." : "Say it"}
            </button>
          </div>

          <audio ref={audioRef} controls className={hasAudio ? "" : "hidden"}></audio>
          <div className={`status ${statusIsError ? "error" : ""}`}>
            {status}
          </div>
        </div>

        <details>
          <summary>Settings</summary>
          <label htmlFor="baseUrl">Base URL</label>
          <input
            id="baseUrl"
            type="text"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />

          <label htmlFor="speedInput">Speed (0.5 - 2.0)</label>
          <input
            id="speedInput"
            type="number"
            min="0.5"
            max="2.0"
            step="0.1"
            placeholder="1.0"
            value={speed}
            onChange={(event) => setSpeed(event.target.value)}
          />
        </details>

        <details className="inspect">
          <summary>Show how this works</summary>
          <div className="inspect-grid">
            <div className="inspect-card">
              <h3>Request payload</h3>
              <pre>{JSON.stringify(inspectPayload, null, 2)}</pre>
            </div>
            <div className="inspect-card">
              <h3>cURL</h3>
              <pre>{curlPreview}</pre>
            </div>
          </div>
        </details>
      </div>

      <footer className="page-footer">
        <div className="footer-stack">
          <p className="h100-saans-bold">Unmuted.</p>
          <img
            alt="Logo"
            loading="lazy"
            width={149}
            height={49}
            decoding="async"
            style={{ color: "transparent" }}
            src="https://www.datocms-assets.com/182222/1763142213-logo-lg.svg"
          />
        </div>
        <a
          className="footer-link"
          href="https://slng.ai?utm_source=slng-demo&utm_medium=example&utm_campaign=orpheus-emotion"
        >
          Create your API Key
        </a>
      </footer>
    </div>
  );
}
