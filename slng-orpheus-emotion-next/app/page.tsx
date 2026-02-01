"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TtsPayload = {
  prompt: string;
  voice?: string;
  emotion?: string;
  speed?: number;
};

const emotions = [
  { value: "neutral", label: "Neutral", emoji: "" },
  { value: "happy", label: "Happy", emoji: "" },
  { value: "sad", label: "Sad", emoji: "" },
  { value: "angry", label: "Angry", emoji: "" },
  { value: "surprised", label: "Surprised", emoji: "" },
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
  const [emotion, setEmotion] = useState("happy");
  const [voice, setVoice] = useState("tara");
  const [speed, setSpeed] = useState("1.0");
  const [status, setStatus] = useState("");
  const [statusIsError, setStatusIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);

  const normalizedBaseUrl = useMemo(() => {
    const value = baseUrl.trim();
    return value ? value.replace(/\/+$/, "") : "";
  }, [baseUrl]);

  const payload = useMemo<TtsPayload>(() => {
    const trimmedText = text.trim();
    const payloadData: TtsPayload = {
      prompt: trimmedText,
    };

    if (voice.trim()) {
      payloadData.voice = voice.trim();
    }
    if (emotion.trim()) {
      payloadData.emotion = emotion.trim();
    }
    const speedValue = parseFloat(speed);
    if (!isNaN(speedValue) && speedValue !== 1.0) {
      payloadData.speed = speedValue;
    }

    return payloadData;
  }, [text, voice, emotion, speed]);

  const inspectEndpoint = useMemo(() => {
    const inspectBase = normalizedBaseUrl || "https://api.slng.ai";
    return `${inspectBase}/v1/tts/slng/canopylabs/orpheus:en`;
  }, [normalizedBaseUrl]);

  const curlPreview = useMemo(() => {
    return `curl "${inspectEndpoint}" \\\n  -H "Authorization: Bearer $SLNG_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(payload)}' \\\n  -o output_audio.wav`;
  }, [inspectEndpoint, payload]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnd = () => setIsPlaying(false);

    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    audio.addEventListener("ended", handleEnd);

    return () => {
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
      audio.removeEventListener("ended", handleEnd);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
      }
    };
  }, []);

  const setStatusMessage = (message: string, isError = false) => {
    setStatus(message);
    setStatusIsError(isError);
  };

  const setAudioSource = (url: string, isObjectUrl = false) => {
    if (currentAudioUrlRef.current) {
      URL.revokeObjectURL(currentAudioUrlRef.current);
    }
    currentAudioUrlRef.current = isObjectUrl ? url : null;

    if (audioRef.current) {
      audioRef.current.src = url;
      audioRef.current.play().catch(() => {
        setStatusMessage("Audio ready. Press play to listen.");
      });
    }
  };

  const setAudioFromBytes = (bytes: Uint8Array) => {
    const audioBuffer = new Uint8Array(bytes).buffer;
    const audioBlob = new Blob([audioBuffer]);
    const objectUrl = URL.createObjectURL(audioBlob);
    setAudioSource(objectUrl, true);
  };

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
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        const lines = chunk.split("\n");
        const dataLines = lines
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trimStart());

        if (dataLines.length === 0) {
          continue;
        }

        const data = dataLines.join("\n").trim();
        if (!data) {
          continue;
        }
        if (data === "[DONE]" || data === "[done]") {
          return gotAudio;
        }

        try {
          const payload = JSON.parse(data) as {
            message?: string;
            audio_url?: string;
            audio_base64?: string;
            audio?: string;
            is_final?: boolean;
          };
          if (payload.message) {
            setStatusMessage(payload.message);
          }
          if (payload.audio_url) {
            setAudioSource(payload.audio_url);
            gotAudio = true;
          }
          if (payload.audio_base64 || payload.audio) {
            audioBase64 += payload.audio_base64 || payload.audio || "";
            gotAudio = true;
          }
          if (payload.is_final) {
            break;
          }
        } catch {
          setStatusMessage(data);
        }
      }
    }

    if (audioBase64) {
      const binary = atob(audioBase64);
      const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      setAudioFromBytes(bytes);
      gotAudio = true;
    }

    return gotAudio;
  };

  const generateAudio = async () => {
    if (!apiKey.trim()) {
      setStatusMessage("Enter your SLNG API key.", true);
      return;
    }
    if (!text.trim()) {
      setStatusMessage("Enter some text to synthesize.", true);
      return;
    }
    if (!normalizedBaseUrl) {
      setStatusMessage("Enter a base URL.", true);
      return;
    }

    setStatusMessage("");
    setIsBusy(true);

    try {
      const endpoint = `${normalizedBaseUrl}/v1/tts/slng/canopylabs/orpheus:en`;
      setStatusMessage(`Calling ${endpoint}`);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          Accept: "text/event-stream",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API error ${response.status}: ${errorBody}`);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("text/event-stream")) {
        setStatusMessage("Streaming audio...");
        const gotAudio = await handleSseResponse(response);
        if (!gotAudio) {
          setStatusMessage("Stream ended without audio.", true);
        }
      } else {
        const audioBlob = await response.blob();
        const objectUrl = URL.createObjectURL(audioBlob);
        setAudioSource(objectUrl, true);
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
    const newText = text.slice(0, start) + tag + text.slice(end);
    setText(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + tag.length;
    }, 0);
  };

  const isMissingApiKey = apiKey.trim().length === 0;
  const isSpeakDisabled = isBusy || isMissingApiKey;

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

      <div className={`card ${isPlaying ? "is-playing" : ""}`}>
        <h1>Emotion-Controlled TTS</h1>
        <p>Choose an emotion and hear the difference in voice expression.</p>

        <label>Select Emotion</label>
        <div className="emotion-selector">
          {emotions.map((e) => (
            <button
              key={e.value}
              type="button"
              className={`emotion-chip ${emotion === e.value ? "selected" : ""}`}
              onClick={() => setEmotion(e.value)}
            >
              <span className="emoji">{e.emoji}</span>
              {e.label}
            </button>
          ))}
        </div>

        <label htmlFor="textInput">Text to speak</label>
        <textarea
          id="textInput"
          ref={textAreaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Type something expressive..."
        />

        <div className="prompt-chips">
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

        <details>
          <summary>Add emotive tags</summary>
          <p style={{ marginTop: "12px", fontSize: "0.9rem" }}>
            Insert special tags to add sounds like laughs, sighs, or gasps.
          </p>
          <div className="prompt-chips" style={{ marginTop: "8px" }}>
            {emotiveTags.map((t) => (
              <button
                key={t.tag}
                className="chip"
                type="button"
                onClick={() => insertEmotiveTag(t.tag)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </details>

        <div className="row">
          <input
            type="password"
            placeholder="Paste your SLNG API key"
            autoComplete="off"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
          />
          <button
            className={`hero-button ${isBusy ? "is-loading" : ""} ${
              isMissingApiKey ? "is-disabled" : ""
            }`}
            onClick={generateAudio}
            disabled={isSpeakDisabled}
            data-default-text="Speak"
            data-loading-text="Generating..."
          >
            <span className="pulse" aria-hidden="true"></span>
            {isBusy ? "Generating..." : "Speak"}
          </button>
        </div>
        <a
          className="cta-link"
          href="https://slng.ai?utm_source=slng-demo&utm_medium=example&utm_campaign=orpheus-emotion"
        >
          Get API key
        </a>

        <details>
          <summary>Advanced settings</summary>
          <label htmlFor="baseUrl">Base URL</label>
          <input
            id="baseUrl"
            type="text"
            value={baseUrl}
            onChange={(event) => setBaseUrl(event.target.value)}
          />

          <div className="row">
            <div>
              <label htmlFor="voiceSelect">Voice</label>
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
              <label htmlFor="speedInput">Speed (0.5 - 2.0)</label>
              <input
                id="speedInput"
                type="text"
                placeholder="1.0"
                value={speed}
                onChange={(event) => setSpeed(event.target.value)}
              />
            </div>
          </div>
        </details>

        <audio ref={audioRef} controls></audio>
        <div className={`status ${statusIsError ? "error" : ""}`}>
          {status}
        </div>

        <details className="inspect">
          <summary>Show how this works</summary>
          <div className="inspect-grid">
            <div className="inspect-card">
              <h3>Request payload</h3>
              <pre>{JSON.stringify(payload, null, 2)}</pre>
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
