"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type TtsPayload = {
  model: string;
  text: string;
  language?: string;
};

const promptSuggestions = [
  {
    label: "Welcome onboard",
    prompt:
      "Welcome aboard, everyone. Please take your seats and enjoy a smooth, on-time departure.",
  },
  {
    label: "Ahoy pirate",
    prompt:
      "Ahoy matey, hoist the colors and mind the tide; adventure waits beyond the fog.",
  },
  {
    label: "Hablas espanol",
    prompt:
      "Una pregunta para un amigo: ¿tu paella lleva pollo, camaron o ambos?",
    model: "slng/deepgram/aura:2-es",
    voice: "aura-2-nestor-es",
  },
];

const modelOptions = [
  { value: "slng/deepgram/aura:2", label: "slng/deepgram/aura:2 (default)" },
  { value: "slng/deepgram/aura:2-es", label: "slng/deepgram/aura:2-es" },
  { value: "deepgram/aura:2", label: "deepgram/aura:2" },
];

export default function Home() {
  const [text, setText] = useState("Hello my friend, this is just a test.");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.slng.ai");
  const [model, setModel] = useState("slng/deepgram/aura:2");
  const [voice, setVoice] = useState("aura-2-thalia-en");
  const [language, setLanguage] = useState("");
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
      model,
      text: trimmedText,
    };

    if (voice.trim()) {
      payloadData.model = voice.trim();
    }
    if (language.trim()) {
      payloadData.language = language.trim();
    }

    return payloadData;
  }, [text, model, voice, language]);

  const inspectEndpoint = useMemo(() => {
    const inspectBase = normalizedBaseUrl || "https://api.slng.ai";
    const inspectModel = model || "{model}";
    return `${inspectBase}/v1/tts/${inspectModel}`;
  }, [normalizedBaseUrl, model]);

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
    if (!model.trim()) {
      setStatusMessage("Select a model.", true);
      return;
    }

    setStatusMessage("");
    setIsBusy(true);

    try {
      const endpoint = `${normalizedBaseUrl}/v1/tts/${model}`;
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
            <span className="brand-subtitle">TTS Demo</span>
          </div>
        </div>
      </header>

      <div className={`card ${isPlaying ? "is-playing" : ""}`}>
        <h1>SLNG TTS Demo</h1>
        <p>Type something and hear it instantly.</p>

        <textarea
          ref={textAreaRef}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Try: Welcome to SLNG."
        />
        <div className="prompt-chips">
          {promptSuggestions.map((suggestion) => (
            <button
              key={suggestion.prompt}
              className="chip"
              type="button"
              onClick={() => {
                setText(suggestion.prompt);
                if (suggestion.model) {
                  setModel(suggestion.model);
                }
                if (suggestion.voice) {
                  setVoice(suggestion.voice);
                }
                textAreaRef.current?.focus();
              }}
            >
              {suggestion.label}
            </button>
          ))}
        </div>

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
          href="https://slng.ai?utm_source=slng-demo&utm_medium=example&utm_campaign=tts"
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

          <label htmlFor="modelSelect">Model</label>
          <select
            id="modelSelect"
            value={model}
            onChange={(event) => setModel(event.target.value)}
          >
            {modelOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <div className="row">
            <div>
              <label htmlFor="voiceInput">Voice</label>
              <input
                id="voiceInput"
                type="text"
                placeholder="e.g. aura-2-thalia-en"
                value={voice}
                onChange={(event) => setVoice(event.target.value)}
              />
            </div>
            <div>
              <label htmlFor="languageInput">Language</label>
              <input
                id="languageInput"
                type="text"
                placeholder="e.g. es"
                value={language}
                onChange={(event) => setLanguage(event.target.value)}
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
          href="https://slng.ai?utm_source=slng-demo&utm_medium=example&utm_campaign=tts"
        >
          Create your API Key
        </a>
      </footer>
    </div>
  );
}
