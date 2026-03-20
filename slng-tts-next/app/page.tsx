"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ModeToggle } from "./components/ModeToggle";
import { StatusBar } from "./components/StatusBar";
import { WaveformCanvas } from "./components/WaveformCanvas";
import { LogConsole } from "./components/LogConsole";
import { CodeBlock } from "./components/CodeBlock";
import { useSessionLog } from "./hooks/useSessionLog";
import { useAudioBuffer } from "./hooks/useAudioBuffer";
import { useWebAudio } from "./hooks/useWebAudio";
import { useWebSocket } from "./hooks/useWebSocket";
import {
  modelGroups,
  promptSuggestions,
  getVoicesForModel,
  getDefaultVoiceForModel,
  BRIDGES_BASE_URL,
  REST_BASE_URL,
  DEFAULT_MODEL,
  DEFAULT_VOICE,
} from "./lib/models";
import {
  type AudioFormat,
  getAudioMimeType,
  base64ToBytes,
  pcmToWav,
} from "./lib/audio-utils";

export default function Home() {
  // ── Mode ──
  const [currentMode, setCurrentMode] = useState<"rest" | "websocket">("rest");

  // ── Shared state ──
  const [text, setText] = useState(
    "The octopus has three hearts, nine brains, and blue blood. Two of its hearts pump blood to the gills, while the third pumps it to the rest of the body. When an octopus swims, the heart that delivers blood to the body actually stops beating, which is why these creatures prefer crawling to swimming — it's less exhausting."
  );
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [voice, setVoice] = useState(DEFAULT_VOICE);
  const [status, setStatus] = useState("Enter your API key and press Say it.");
  const [statusIsError, setStatusIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [waveformActive, setWaveformActive] = useState(false);

  // ── Dynamic voice groups based on model ──
  const { groups: voiceGroups, docsUrl: voiceDocsUrl } = useMemo(
    () => getVoicesForModel(model),
    [model]
  );

  // Auto-switch voice when model changes to a different provider
  useEffect(() => {
    const allVoiceValues = voiceGroups.flatMap((g) =>
      g.options.map((o) => o.value)
    );
    if (!allVoiceValues.includes(voice)) {
      setVoice(getDefaultVoiceForModel(model));
    }
  }, [model, voiceGroups, voice]);

  // ── WebSocket settings ──
  const [wsUrl, setWsUrl] = useState(BRIDGES_BASE_URL + DEFAULT_MODEL);
  const [proxyUrl, setProxyUrl] = useState("ws://localhost:8787");
  const [useProxy, setUseProxy] = useState(true);
  const [audioFormat, setAudioFormat] = useState<AudioFormat>("linear16");
  const [sampleRate, setSampleRate] = useState("24000");
  const [payloadMode, setPayloadMode] = useState<"text" | "custom">("text");
  const [customPayload, setCustomPayload] = useState(
    '{\n  "type": "text",\n  "text": "Hello from WebSocket!"\n}'
  );
  const [useCustomInit, setUseCustomInit] = useState(false);
  const [customInitPayload, setCustomInitPayload] = useState(
    `{\n  "type": "init",\n  "model": "${DEFAULT_MODEL}",\n  "voice": "${DEFAULT_VOICE}",\n  "config": {\n    "sample_rate": 24000,\n    "encoding": "linear16"\n  }\n}`
  );

  // ── Refs ──
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const restAbortControllerRef = useRef<AbortController | null>(null);

  // ── Hooks ──
  const { entries, appendLog } = useSessionLog();
  const parsedSampleRate = useMemo(() => {
    const v = parseInt(sampleRate, 10);
    return Number.isFinite(v) && v > 0 ? v : 24000;
  }, [sampleRate]);
  const { playPcmChunk, closeAudio, resetPlayTime, analyserNodeRef, ensureAudioContext } =
    useWebAudio(parsedSampleRate);
  const { appendChunk, reset: resetAudioBuffer, scheduleFlush, markAudioEnd } =
    useAudioBuffer();

  // ── Audio chunk base64 accumulator (for JSON-based audio) ──
  const audioChunksBase64Ref = useRef("");

  // ── Status helpers ──
  const setStatusMessage = useCallback((message: string, isError = false) => {
    setStatus(message);
    setStatusIsError(isError);
  }, []);

  // ── Audio helpers ──
  const setAudioSource = useCallback(
    (url: string, isObjectUrl = false) => {
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
    },
    [setStatusMessage]
  );

  const setAudioFromBytes = useCallback(
    (bytes: Uint8Array, format: AudioFormat = "mp3") => {
      const mimeType = getAudioMimeType(format);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: mimeType });
      const objectUrl = URL.createObjectURL(blob);
      setAudioSource(objectUrl, true);
    },
    [setAudioSource]
  );

  // ── Flush handler for buffered audio ──
  const handleBufferFlush = useCallback(
    (combined: Uint8Array) => {
      if (audioFormat === "linear16") {
        const wav = pcmToWav(combined, parsedSampleRate, 1);
        setAudioFromBytes(wav, "wav");
      } else {
        setAudioFromBytes(combined, audioFormat);
      }
    },
    [audioFormat, parsedSampleRate, setAudioFromBytes]
  );

  // ── WebSocket callbacks ──
  const handleJsonMessage = useCallback(
    (payload: Record<string, unknown>) => {
      if (
        payload.type === "audio_end" ||
        (payload.type as string)?.toLowerCase() === "flushed"
      ) {
        if (audioFormat === "linear16") {
          appendLog("Stream flushed (streaming via Web Audio API).");
          setWaveformActive(false);
        } else {
          markAudioEnd();
          scheduleFlush(handleBufferFlush);
        }
      }

      if (payload.message) {
        setStatusMessage(payload.message as string);
      }

      if (payload.audio_url) {
        setAudioSource(payload.audio_url as string);
      }

      if (payload.audio_base64 || payload.audio) {
        audioChunksBase64Ref.current +=
          (payload.audio_base64 as string) || (payload.audio as string) || "";
      }

      if (payload.is_final && audioChunksBase64Ref.current) {
        const bytes = base64ToBytes(audioChunksBase64Ref.current);
        setAudioFromBytes(bytes, audioFormat);
        audioChunksBase64Ref.current = "";
      }

      if (
        (payload.type === "chunk" || payload.type === "audio_chunk") &&
        payload.data
      ) {
        const bytes = base64ToBytes(payload.data as string);
        appendChunk(bytes);
        scheduleFlush(handleBufferFlush, true);
      }
    },
    [
      audioFormat,
      appendLog,
      setStatusMessage,
      setAudioSource,
      setAudioFromBytes,
      markAudioEnd,
      scheduleFlush,
      handleBufferFlush,
      appendChunk,
    ]
  );

  const handleBinaryMessage = useCallback(
    (data: ArrayBuffer) => {
      const bytes = new Uint8Array(data);
      if (audioFormat === "linear16") {
        playPcmChunk(bytes);
        setWaveformActive(true);
        return;
      }
      appendChunk(bytes);
      scheduleFlush(handleBufferFlush);
    },
    [audioFormat, playPcmChunk, appendChunk, scheduleFlush, handleBufferFlush]
  );

  const {
    connect,
    disconnect,
    sendPayload,
    isConnected,
    isReady,
  } = useWebSocket({
    onJsonMessage: handleJsonMessage,
    onBinaryMessage: handleBinaryMessage,
    onLog: appendLog,
    onStatusChange: setStatusMessage,
  });

  // ── Audio player events ──
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
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

  // ── Cleanup URL on unmount ──
  useEffect(() => {
    return () => {
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
      }
    };
  }, []);

  // ── Update WS URL when model changes ──
  useEffect(() => {
    setWsUrl(BRIDGES_BASE_URL + model);
  }, [model]);

  // ── Mode switching ──
  const handleModeChange = useCallback(
    (mode: "rest" | "websocket") => {
      if (mode === "rest" && isConnected) {
        disconnect();
        closeAudio();
      }
      setCurrentMode(mode);
      setWaveformActive(false);
      if (mode === "rest") {
        setStatusMessage("Enter your API key and press Say it.");
      } else {
        setStatusMessage("Enter your API key and connect.");
      }
    },
    [isConnected, disconnect, closeAudio, setStatusMessage]
  );

  // ── Connect / Disconnect ──
  const handleConnect = useCallback(() => {
    if (isConnected) {
      disconnect();
      closeAudio();
      setWaveformActive(false);
      return;
    }

    if (!apiKey.trim()) {
      setStatusMessage("Enter your SLNG API key.", true);
      return;
    }
    if (!wsUrl.trim()) {
      setStatusMessage("Enter a WebSocket URL.", true);
      return;
    }
    if (useProxy && !proxyUrl.trim()) {
      setStatusMessage("Enter the proxy WebSocket URL.", true);
      return;
    }

    ensureAudioContext();
    audioChunksBase64Ref.current = "";
    resetAudioBuffer();
    resetPlayTime();

    const initMessage = useCustomInit
      ? customInitPayload.trim()
      : JSON.stringify({
          type: "init",
          model,
          voice,
          config: { sample_rate: parsedSampleRate, encoding: audioFormat },
        });

    connect({
      wsUrl: wsUrl.trim(),
      apiKey: apiKey.trim(),
      useProxy,
      proxyUrl: proxyUrl.trim(),
      initMessage,
    });
  }, [
    isConnected,
    disconnect,
    closeAudio,
    apiKey,
    wsUrl,
    useProxy,
    proxyUrl,
    ensureAudioContext,
    resetAudioBuffer,
    resetPlayTime,
    useCustomInit,
    customInitPayload,
    model,
    voice,
    parsedSampleRate,
    audioFormat,
    connect,
    setStatusMessage,
  ]);

  // ── Send WS payload ──
  const handleWsSend = useCallback(() => {
    if (!isReady) {
      setStatusMessage("Waiting for ready signal.", true);
      return;
    }

    const trimmedText = text.trim();
    const payload =
      payloadMode === "custom"
        ? customPayload.trim()
        : JSON.stringify({ type: "text", text: trimmedText });

    if (payloadMode !== "custom" && !trimmedText) {
      setStatusMessage("Enter some text to synthesize.", true);
      return;
    }

    if (payloadMode === "custom") {
      if (!payload) {
        setStatusMessage("Enter custom JSON payload.", true);
        return;
      }
      try {
        JSON.parse(payload);
      } catch (e) {
        setStatusMessage(
          `Invalid payload JSON: ${(e as Error).message}`,
          true
        );
        return;
      }
    }

    appendLog(`Sending payload: ${payload}`);
    resetAudioBuffer();
    resetPlayTime();
    setWaveformActive(false);
    sendPayload(payload, JSON.stringify({ type: "flush" }));
    setStatusMessage("Payload sent. Waiting for audio...");
  }, [
    isReady,
    text,
    payloadMode,
    customPayload,
    appendLog,
    resetAudioBuffer,
    resetPlayTime,
    sendPayload,
    setStatusMessage,
  ]);

  // ── REST request ──
  const generateAudio = useCallback(async () => {
    if (!apiKey.trim()) {
      setStatusMessage("Enter your SLNG API key.", true);
      return;
    }
    if (!text.trim()) {
      setStatusMessage("Enter some text to synthesize.", true);
      return;
    }
    if (!model.trim()) {
      setStatusMessage("Select a model.", true);
      return;
    }

    if (restAbortControllerRef.current) restAbortControllerRef.current.abort();
    restAbortControllerRef.current = new AbortController();

    setStatusMessage("");
    setIsBusy(true);

    const url = REST_BASE_URL + model;
    const body: Record<string, string> = { model, text: text.trim() };
    if (voice) body.voice = voice;

    appendLog(`REST POST ${url}`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: restAbortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        setStatusMessage(`Error ${response.status}: ${errorText}`, true);
        appendLog(`REST error: ${response.status} ${errorText}`);
        return;
      }

      const contentType = response.headers.get("content-type") || "";
      appendLog(`Response content-type: ${contentType}`);

      const blob = await response.blob();
      if (currentAudioUrlRef.current) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
      }
      currentAudioUrlRef.current = URL.createObjectURL(blob);
      if (audioRef.current) {
        audioRef.current.src = currentAudioUrlRef.current;
        audioRef.current.play().catch(() => {
          setStatusMessage("Audio ready. Press play to listen.");
        });
      }

      setStatusMessage("Audio received.");
      appendLog(`Audio received: ${(blob.size / 1024).toFixed(1)} KB`);
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setStatusMessage(
        `Request failed: ${(error as Error).message}`,
        true
      );
      appendLog(`REST error: ${(error as Error).message}`);
    } finally {
      setIsBusy(false);
      restAbortControllerRef.current = null;
    }
  }, [apiKey, text, model, voice, appendLog, setStatusMessage]);

  // ── Send button handler ──
  const handleSend = useCallback(() => {
    if (currentMode === "rest") {
      generateAudio();
    } else {
      handleWsSend();
    }
  }, [currentMode, generateAudio, handleWsSend]);

  // ── Chip click ──
  const handleChipClick = useCallback(
    (suggestion: (typeof promptSuggestions)[number]) => {
      setText(suggestion.prompt);
      if (suggestion.model) setModel(suggestion.model);
      if (suggestion.voice) setVoice(suggestion.voice);
      textAreaRef.current?.focus();
    },
    []
  );

  // ── Computed ──
  const isWs = currentMode === "websocket";
  const isMissingApiKey = apiKey.trim().length === 0;
  const isSendDisabled = isWs
    ? !isReady
    : isBusy || isMissingApiKey;

  const restPayload = useMemo(() => {
    const p: Record<string, string> = { model, text: text.trim() };
    if (voice) p.voice = voice;
    return p;
  }, [model, text, voice]);

  const curlPreview = useMemo(() => {
    const url = REST_BASE_URL + model;
    return `curl "${url}" \\\n  -H "Authorization: Bearer $SLNG_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(restPayload)}' \\\n  --output speech.wav`;
  }, [model, restPayload]);

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

        <ModeToggle currentMode={currentMode} onModeChange={handleModeChange} />

        <label htmlFor="textInput">Text to synthesize</label>
        <textarea
          id="textInput"
          ref={textAreaRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Try: Welcome to SLNG."
        />

        <div className="prompt-chips">
          {promptSuggestions.map((suggestion) => (
            <button
              key={suggestion.label}
              className="chip"
              type="button"
              onClick={() => handleChipClick(suggestion)}
            >
              {suggestion.label}
            </button>
          ))}
        </div>

        {/* Model / Voice selectors */}
        <div className="model-row">
          <div className="field">
            <label htmlFor="modelSelect">
              Model
              <a
                className="model-link"
                href="https://docs.slng.ai/models"
                target="_blank"
                rel="noopener"
              >
                Discover models &rarr;
              </a>
            </label>
            <select
              id="modelSelect"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              {modelGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="voiceSelect">
              Voice
              <a
                className="model-link"
                href={voiceDocsUrl}
                target="_blank"
                rel="noopener"
              >
                Discover voices &rarr;
              </a>
            </label>
            <select
              id="voiceSelect"
              value={voice}
              onChange={(e) => setVoice(e.target.value)}
            >
              {voiceGroups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        </div>

        {/* Connect row */}
        <div className="connect-row">
          <div className="api-field">
            <label htmlFor="apiKeyInput">
              API Key
              <a
                className="model-link"
                href="https://app.slng.ai"
                target="_blank"
                rel="noopener"
              >
                Get API key &rarr;
              </a>
            </label>
            <input
              id="apiKeyInput"
              type="password"
              placeholder="Paste your SLNG API key"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="btn-group">
            {isWs && (
              <button
                type="button"
                className={`secondary ${isConnected ? "" : ""}`}
                onClick={handleConnect}
              >
                {isConnected ? "Disconnect" : "Connect"}
              </button>
            )}
            <button
              type="button"
              className={`hero-button ${isBusy ? "is-loading" : ""} ${
                isSendDisabled ? "is-disabled" : ""
              }`}
              onClick={handleSend}
              disabled={isSendDisabled}
            >
              <span className="pulse" aria-hidden="true"></span>
              {isBusy ? "Generating..." : "Say it"}
            </button>
          </div>
        </div>

        {/* Status bar */}
        <StatusBar
          status={status}
          isError={statusIsError}
          isConnected={isConnected}
          isReady={isReady}
        />

        {/* REST: audio player */}
        {!isWs && (
          <div className="audio-wrap">
            <audio ref={audioRef} controls />
          </div>
        )}

        {/* WebSocket: waveform canvas */}
        {isWs && (
          <WaveformCanvas
            analyserNode={analyserNodeRef.current}
            isActive={waveformActive}
          />
        )}

        {/* Log console */}
        <LogConsole entries={entries} />

        {/* How to implement — mode-aware */}
        <details>
          <summary>How to implement</summary>
          <div className="code-samples">
            {!isWs && (
              <>
                <CodeBlock
                  title="Request payload"
                  language="json"
                  code={JSON.stringify(restPayload, null, 2)}
                />
                <CodeBlock
                  title="cURL"
                  language="bash"
                  code={curlPreview}
                />
                <CodeBlock
                  title="JavaScript"
                  language="javascript"
                  wide
                  code={`const MODEL = "${model}";
const VOICE = "${voice}";
const API_KEY = "YOUR_API_KEY";

const res = await fetch(
  "${REST_BASE_URL}" + MODEL,
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: VOICE,
      text: "Hello world",
    }),
  }
);

// Get audio blob and play it
const blob = await res.blob();
const audio = new Audio(URL.createObjectURL(blob));
audio.play();`}
                />
              </>
            )}
            {isWs && (
              <CodeBlock
                title="WebSocket — Streaming"
                language="javascript"
                wide
                code={`const MODEL = "${model}";
const VOICE = "${voice}";
const SAMPLE_RATE = ${parsedSampleRate};
const ENCODING = "${audioFormat}";

// Set up Web Audio API for gapless PCM playback
const audioCtx = new AudioContext({ sampleRate: SAMPLE_RATE });
let nextPlayTime = 0;

function playPcmChunk(pcmBytes) {
  // Convert Int16 PCM to Float32 for Web Audio API
  const int16 = new Int16Array(pcmBytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / 32768;
  }

  const buffer = audioCtx.createBuffer(1, float32.length, SAMPLE_RATE);
  buffer.getChannelData(0).set(float32);

  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);

  // Schedule gapless playback
  const now = audioCtx.currentTime;
  if (nextPlayTime < now) nextPlayTime = now + 0.05;
  source.start(nextPlayTime);
  nextPlayTime += float32.length / SAMPLE_RATE;
}

// Connect to WebSocket
const ws = new WebSocket("${BRIDGES_BASE_URL}" + MODEL);
ws.binaryType = "arraybuffer";

ws.onopen = () => {
  // 1. Initialize the session
  ws.send(JSON.stringify({
    type: "init",
    model: MODEL,
    voice: VOICE,
    config: { sample_rate: SAMPLE_RATE, encoding: ENCODING },
  }));
};

ws.onmessage = (event) => {
  if (event.data instanceof ArrayBuffer) {
    // 3. Receive binary PCM chunks and play them
    playPcmChunk(new Uint8Array(event.data));
  } else {
    const msg = JSON.parse(event.data);
    if (msg.type === "ready") {
      // 2. Send text once session is ready
      ws.send(JSON.stringify({ type: "text", text: "Hello world" }));
      ws.send(JSON.stringify({ type: "flush" }));
    }
  }
};`}
              />
            )}
          </div>
        </details>

        {/* Advanced settings (WS only) */}
        {isWs && (
          <details>
            <summary>Advanced settings</summary>
            <label htmlFor="wsUrlInput" style={{ marginTop: 12 }}>
              WebSocket URL
            </label>
            <input
              id="wsUrlInput"
              type="text"
              value={wsUrl}
              onChange={(e) => setWsUrl(e.target.value)}
            />

            <div className="row">
              <div>
                <label htmlFor="proxyUrlInput">Proxy WebSocket URL</label>
                <input
                  id="proxyUrlInput"
                  type="text"
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                />
              </div>
              <div style={{ flex: "0 0 180px", alignSelf: "flex-end" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={useProxy}
                    onChange={(e) => setUseProxy(e.target.checked)}
                  />
                  Use proxy
                </label>
              </div>
            </div>

            <div className="row">
              <div>
                <label htmlFor="payloadMode">Payload mode</label>
                <select
                  id="payloadMode"
                  value={payloadMode}
                  onChange={(e) =>
                    setPayloadMode(e.target.value as "text" | "custom")
                  }
                >
                  <option value="text">{`{"text":"..."}`}</option>
                  <option value="custom">Raw JSON (below)</option>
                </select>
              </div>
              <div>
                <label htmlFor="audioFormat">Audio format</label>
                <select
                  id="audioFormat"
                  value={audioFormat}
                  onChange={(e) =>
                    setAudioFormat(e.target.value as AudioFormat)
                  }
                >
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV</option>
                  <option value="linear16">Linear16 (PCM)</option>
                </select>
              </div>
              <div>
                <label htmlFor="sampleRateInput">Sample rate (PCM)</label>
                <input
                  id="sampleRateInput"
                  type="text"
                  value={sampleRate}
                  inputMode="numeric"
                  onChange={(e) => setSampleRate(e.target.value)}
                />
              </div>
            </div>

            <label htmlFor="customPayload" style={{ marginTop: 12 }}>
              Custom JSON payload
            </label>
            <textarea
              id="customPayload"
              rows={4}
              spellCheck={false}
              value={customPayload}
              onChange={(e) => setCustomPayload(e.target.value)}
            />

            <div className="row">
              <div style={{ flex: "0 0 180px", alignSelf: "flex-end" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={useCustomInit}
                    onChange={(e) => setUseCustomInit(e.target.checked)}
                  />
                  Use custom init
                </label>
              </div>
            </div>

            <label htmlFor="customInitPayload" style={{ marginTop: 12 }}>
              Custom init JSON
            </label>
            <textarea
              id="customInitPayload"
              rows={4}
              spellCheck={false}
              value={customInitPayload}
              onChange={(e) => setCustomInitPayload(e.target.value)}
            />
          </details>
        )}

      </div>

      <footer className="page-footer">
        <div className="footer-stack">
          <p className="h100-saans-bold">Unmuted.</p>
          <a href="https://slng.ai" target="_blank" rel="noopener">
            <img
              alt="SLNG"
              loading="lazy"
              width={149}
              height={49}
              decoding="async"
              style={{ color: "transparent" }}
              src="https://www.datocms-assets.com/182222/1763142213-logo-lg.svg"
            />
          </a>
        </div>
        <a
          className="footer-link"
          href="https://app.slng.ai"
          target="_blank"
          rel="noopener"
        >
          Create your API Key
        </a>
      </footer>
    </div>
  );
}
