"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ModeToggle } from "./components/ModeToggle";
import { StatusBar } from "./components/StatusBar";
import { WaveformCanvas } from "./components/WaveformCanvas";
import { LogConsole } from "./components/LogConsole";
import { CodeBlock } from "./components/CodeBlock";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Textarea } from "./components/ui/textarea";
import { cn } from "./components/ui/lib/utils";
import { useSessionLog } from "./hooks/useSessionLog";
import { useAudioBuffer } from "./hooks/useAudioBuffer";
import { useWebAudio } from "./hooks/useWebAudio";
import { useWebSocket } from "./hooks/useWebSocket";
import {
  modelGroups,
  promptSuggestions,
  getVoicesForModel,
  getDefaultVoiceForModel,
  getWsUrl,
  isWsOnlyModel,
  getDefaultInitPayload,
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

// Native <select> styled to match the design system's Select trigger. Native is
// kept (rather than the Radix Select) so the demo stays copy-paste simple and
// supports <optgroup> for the grouped model/voice lists.
const selectClass =
  "flex h-10 w-full appearance-none items-center rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const detailsClass = "mt-4 border-t border-border pt-4";
const summaryClass =
  "cursor-pointer text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";

function SelectShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-50" />
    </div>
  );
}

function FieldLabel({
  htmlFor,
  children,
  linkHref,
  linkText,
}: {
  htmlFor: string;
  children: React.ReactNode;
  linkHref: string;
  linkText: string;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <Label htmlFor={htmlFor}>{children}</Label>
      <a
        className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        href={linkHref}
        target="_blank"
        rel="noopener"
      >
        {linkText}
      </a>
    </div>
  );
}

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
  const [proxyUrl, setProxyUrl] = useState(
    process.env.NEXT_PUBLIC_WS_PROXY_URL || "ws://localhost:8787"
  );
  const [useProxy, setUseProxy] = useState(true);
  const [audioFormat, setAudioFormat] = useState<AudioFormat>("linear16");
  const [sampleRate, setSampleRate] = useState("24000");
  const [payloadMode, setPayloadMode] = useState<"text" | "custom">("text");
  const [customPayload, setCustomPayload] = useState(
    '{\n  "type": "text",\n  "text": "Hello from WebSocket!"\n}'
  );
  const [useDirectUrl, setUseDirectUrl] = useState(false);
  const [useCustomInit, setUseCustomInit] = useState(false);
  const [customInitPayload, setCustomInitPayload] = useState(
    getDefaultInitPayload(DEFAULT_MODEL, DEFAULT_VOICE)
  );

  // ── Refs ──
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const restAbortControllerRef = useRef<AbortController | null>(null);

  // ── Hooks ──
  const { entries, appendLog, clearLog } = useSessionLog();
  const parsedSampleRate = useMemo(() => {
    const v = parseInt(sampleRate, 10);
    return Number.isFinite(v) && v > 0 ? v : 24000;
  }, [sampleRate]);
  const { playPcmChunk, closeAudio, resetPlayTime, getPlaybackRemainingMs, analyserNodeRef, ensureAudioContext } =
    useWebAudio(parsedSampleRate);
  const { appendChunk, reset: resetAudioBuffer, scheduleFlush, markAudioEnd } =
    useAudioBuffer();

  // ── Audio chunk base64 accumulator (for JSON-based audio) ──
  const audioChunksBase64Ref = useRef("");

  // Timer that keeps the waveform animating until scheduled playback ends.
  const waveformStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearWaveformStopTimer = useCallback(() => {
    if (waveformStopTimerRef.current) {
      clearTimeout(waveformStopTimerRef.current);
      waveformStopTimerRef.current = null;
    }
  }, []);

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
        (payload.type as string)?.toLowerCase() === "flushed" ||
        (payload.chunk_complete && payload.is_final)
      ) {
        if (audioFormat === "linear16") {
          appendLog("Stream complete (streaming via Web Audio API).");
          // Audio is scheduled ahead of real time, so keep the waveform
          // animating until the buffered playback actually finishes.
          clearWaveformStopTimer();
          waveformStopTimerRef.current = setTimeout(() => {
            setWaveformActive(false);
            waveformStopTimerRef.current = null;
          }, getPlaybackRemainingMs() + 250);
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

      // Handle audio chunks in various formats:
      // - Bridge: {"type":"audio_chunk","data":"<base64>"}
      // - Kugel direct: {"audio":"<base64>"}
      // - Legacy: {"audio_base64":"<base64>"}
      const audioB64 =
        (payload.data as string) ||
        (payload.audio as string) ||
        (payload.audio_base64 as string);

      const isAudioChunk =
        audioB64 &&
        (payload.type === "chunk" ||
          payload.type === "audio_chunk" ||
          payload.audio ||
          payload.audio_base64);

      if (isAudioChunk) {
        const bytes = base64ToBytes(audioB64);

        if (audioFormat === "linear16") {
          // Stream PCM directly via Web Audio API for gapless playback
          playPcmChunk(bytes);
          setWaveformActive(true);
        } else {
          // Buffer non-PCM formats and flush as a single blob
          appendChunk(bytes);
          scheduleFlush(handleBufferFlush, true);
        }
      }

      if (payload.is_final && audioChunksBase64Ref.current) {
        const bytes = base64ToBytes(audioChunksBase64Ref.current);
        setAudioFromBytes(bytes, audioFormat);
        audioChunksBase64Ref.current = "";
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
      playPcmChunk,
      clearWaveformStopTimer,
      getPlaybackRemainingMs,
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

  // ── Update WS URL when model or URL mode changes ──
  useEffect(() => {
    setWsUrl(getWsUrl(model, useDirectUrl));
  }, [model, useDirectUrl]);

  // ── Auto-switch to WebSocket for WS-only models ──
  useEffect(() => {
    if (isWsOnlyModel(model) && currentMode === "rest") {
      handleModeChange("websocket");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model]);

  // ── Update custom init payload when model/voice changes ──
  useEffect(() => {
    setCustomInitPayload(getDefaultInitPayload(model, voice));
  }, [model, voice]);

  // ── Mode switching ──
  const handleModeChange = useCallback(
    (mode: "rest" | "websocket") => {
      if (mode === "rest" && isConnected) {
        disconnect();
        closeAudio();
      }
      setCurrentMode(mode);
      clearWaveformStopTimer();
      setWaveformActive(false);
      if (mode === "rest") {
        setStatusMessage("Enter your API key and press Say it.");
      } else {
        setStatusMessage("Enter your API key and connect.");
      }
    },
    [isConnected, disconnect, closeAudio, setStatusMessage, clearWaveformStopTimer]
  );

  // ── Connect / Disconnect ──
  const handleConnect = useCallback(() => {
    if (isConnected) {
      disconnect();
      closeAudio();
      clearWaveformStopTimer();
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

    const doConnect = () => {
      connect({
        wsUrl: wsUrl.trim(),
        apiKey: apiKey.trim(),
        useProxy,
        proxyUrl: proxyUrl.trim(),
        initMessage,
      });
    };

    // Wake up the proxy if it's on a cold-start platform (e.g. Render free tier)
    if (useProxy && proxyUrl.trim()) {
      const httpUrl = proxyUrl.trim().replace(/^wss:\/\//, "https://").replace(/^ws:\/\//, "http://");
      setStatusMessage("Waking up proxy...");
      appendLog(`Pinging proxy at ${httpUrl}`);
      fetch(httpUrl, { mode: "no-cors" }).catch(() => {});
      // Give the proxy a moment to spin up, then connect
      setTimeout(doConnect, 2000);
    } else {
      doConnect();
    }
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
    appendLog,
    clearWaveformStopTimer,
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
    clearWaveformStopTimer();
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
    clearWaveformStopTimer,
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
    : isBusy || isMissingApiKey || isWsOnlyModel(model);

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
    <div className="mx-auto grid max-w-[920px] gap-5 px-4 py-9">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-yellow">
            <img
              src="https://www.datocms-assets.com/182222/1763142110-logo.svg"
              alt="SLNG"
              className="h-7 w-7"
            />
          </div>
          <div>
            <p className="m-0 text-lg font-semibold uppercase tracking-wider">SLNG</p>
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              TTS Demo
            </span>
          </div>
        </div>
      </header>

      <Card
        className={cn(
          "p-6 transition-shadow",
          isPlaying && "ring-1 ring-brand-yellow/60"
        )}
      >
        <h1 className="m-0 text-2xl font-semibold tracking-tight">SLNG TTS Demo</h1>
        <p className="mb-5 mt-1 text-sm text-muted-foreground">
          Type something and hear it instantly.
        </p>

        <ModeToggle currentMode={currentMode} onModeChange={handleModeChange} disableRest={isWsOnlyModel(model)} />

        <Label htmlFor="textInput" className="mb-2 mt-5 block">
          Text to synthesize
        </Label>
        <Textarea
          id="textInput"
          ref={textAreaRef}
          className="min-h-[120px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Try: Welcome to SLNG."
        />

        <div className="mt-3 flex flex-wrap gap-2">
          {promptSuggestions.map((suggestion) => (
            <Button
              key={suggestion.label}
              variant="outline"
              size="sm"
              className="rounded-full"
              type="button"
              onClick={() => handleChipClick(suggestion)}
            >
              {suggestion.label}
            </Button>
          ))}
        </div>

        {/* Model / Voice selectors */}
        <div className="mt-5 flex flex-wrap gap-3">
          <div className="flex-1 basis-[280px]">
            <FieldLabel
              htmlFor="modelSelect"
              linkHref="https://docs.slng.ai/models"
              linkText="Discover models →"
            >
              Model
            </FieldLabel>
            <SelectShell>
              <select
                id="modelSelect"
                className={selectClass}
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
            </SelectShell>
          </div>
          <div className="flex-1 basis-[280px]">
            <FieldLabel
              htmlFor="voiceSelect"
              linkHref={voiceDocsUrl}
              linkText="Discover voices →"
            >
              Voice
            </FieldLabel>
            <SelectShell>
              <select
                id="voiceSelect"
                className={selectClass}
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
            </SelectShell>
          </div>
        </div>

        {/* Connect row */}
        <div className="mt-5 flex flex-wrap items-end gap-3">
          <div className="flex-1 basis-[280px]">
            <FieldLabel
              htmlFor="apiKeyInput"
              linkHref="https://app.slng.ai"
              linkText="Get API key →"
            >
              API Key
            </FieldLabel>
            <Input
              id="apiKeyInput"
              type="password"
              placeholder="Paste your SLNG API key"
              autoComplete="off"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <div className="flex shrink-0 gap-2">
            {isWs && (
              <Button type="button" variant="secondary" onClick={handleConnect}>
                {isConnected ? "Disconnect" : "Connect"}
              </Button>
            )}
            <Button type="button" onClick={handleSend} disabled={isSendDisabled}>
              {!isSendDisabled && (
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-full bg-brand-yellow animate-slng-pulse"
                />
              )}
              {isBusy ? "Generating..." : "Say it"}
            </Button>
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
          <div className="mt-4">
            <audio ref={audioRef} controls className="w-full" />
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
        <LogConsole entries={entries} onClear={clearLog} />

        {/* How to implement — mode-aware */}
        <details className={detailsClass}>
          <summary className={summaryClass}>How to implement</summary>
          <div className="mt-3 grid grid-cols-1 gap-3.5 md:grid-cols-2">
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
const ws = new WebSocket("${wsUrl}");
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
          <details className={detailsClass}>
            <summary className={summaryClass}>Advanced settings</summary>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="flex-1 basis-[280px]">
                <Label htmlFor="wsUrlInput" className="mb-2 block">
                  WebSocket URL
                </Label>
                <Input
                  id="wsUrlInput"
                  type="text"
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                />
              </div>
              <div className="basis-[200px]">
                <Label htmlFor="urlPattern" className="mb-2 block">
                  URL pattern
                </Label>
                <SelectShell>
                  <select
                    id="urlPattern"
                    className={selectClass}
                    value={useDirectUrl ? "direct" : "bridge"}
                    onChange={(e) => setUseDirectUrl(e.target.value === "direct")}
                  >
                    <option value="bridge">Bridge (/v1/bridges/unmute/tts/)</option>
                    <option value="direct">Direct (/v1/tts/)</option>
                  </select>
                </SelectShell>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-end gap-3">
              <div className="flex-1 basis-[280px]">
                <Label htmlFor="proxyUrlInput" className="mb-2 block">
                  Proxy WebSocket URL
                </Label>
                <Input
                  id="proxyUrlInput"
                  type="text"
                  value={proxyUrl}
                  onChange={(e) => setProxyUrl(e.target.value)}
                />
              </div>
              <label className="flex h-10 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-primary"
                  checked={useProxy}
                  onChange={(e) => setUseProxy(e.target.checked)}
                />
                Use proxy
              </label>
            </div>

            <div className="mt-3 flex flex-wrap gap-3">
              <div className="flex-1 basis-[180px]">
                <Label htmlFor="payloadMode" className="mb-2 block">
                  Payload mode
                </Label>
                <SelectShell>
                  <select
                    id="payloadMode"
                    className={selectClass}
                    value={payloadMode}
                    onChange={(e) =>
                      setPayloadMode(e.target.value as "text" | "custom")
                    }
                  >
                    <option value="text">{`{"text":"..."}`}</option>
                    <option value="custom">Raw JSON (below)</option>
                  </select>
                </SelectShell>
              </div>
              <div className="flex-1 basis-[180px]">
                <Label htmlFor="audioFormat" className="mb-2 block">
                  Audio format
                </Label>
                <SelectShell>
                  <select
                    id="audioFormat"
                    className={selectClass}
                    value={audioFormat}
                    onChange={(e) =>
                      setAudioFormat(e.target.value as AudioFormat)
                    }
                  >
                    <option value="mp3">MP3</option>
                    <option value="wav">WAV</option>
                    <option value="linear16">Linear16 (PCM)</option>
                  </select>
                </SelectShell>
              </div>
              <div className="flex-1 basis-[180px]">
                <Label htmlFor="sampleRateInput" className="mb-2 block">
                  Sample rate (PCM)
                </Label>
                <Input
                  id="sampleRateInput"
                  type="text"
                  value={sampleRate}
                  inputMode="numeric"
                  onChange={(e) => setSampleRate(e.target.value)}
                />
              </div>
            </div>

            <Label htmlFor="customPayload" className="mb-2 mt-3 block">
              Custom JSON payload
            </Label>
            <Textarea
              id="customPayload"
              className="font-mono"
              rows={4}
              spellCheck={false}
              value={customPayload}
              onChange={(e) => setCustomPayload(e.target.value)}
            />

            <label className="mt-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={useCustomInit}
                onChange={(e) => setUseCustomInit(e.target.checked)}
              />
              Use custom init
            </label>

            <Label htmlFor="customInitPayload" className="mb-2 mt-3 block">
              Custom init JSON
            </Label>
            <Textarea
              id="customInitPayload"
              className="font-mono"
              rows={4}
              spellCheck={false}
              value={customInitPayload}
              onChange={(e) => setCustomInitPayload(e.target.value)}
            />
          </details>
        )}
      </Card>

      <footer className="flex flex-col items-center gap-4 border-t border-border pt-6 text-center text-sm text-muted-foreground">
        <div className="flex flex-col items-center gap-4">
          <p className="m-0 text-5xl font-extrabold tracking-tight text-foreground md:text-6xl">
            Unmuted.
          </p>
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
          className="font-semibold text-foreground hover:underline"
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
