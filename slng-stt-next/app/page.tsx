"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StatusBar } from "./components/StatusBar";
import { WaveformCanvas } from "./components/WaveformCanvas";
import { LogConsole } from "./components/LogConsole";
import { CodeBlock } from "./components/CodeBlock";
import { TranscriptDisplay } from "./components/TranscriptDisplay";
import { useSessionLog } from "./hooks/useSessionLog";
import { useWebSocket } from "./hooks/useWebSocket";
import { useWebAudio } from "./hooks/useWebAudio";
import { useMicrophone } from "./hooks/useMicrophone";
import {
  modelGroups,
  languageOptions,
  getLanguageOptions,
  getWsUrl,
  getDefaultInitPayload,
  BRIDGES_BASE_URL,
  DIRECT_WS_BASE_URL,
  HTTP_BASE_URL,
  DEFAULT_MODEL,
} from "./lib/models";
import { floatTo16BitPCM, decodeAudioFile } from "./lib/audio-utils";
import { getProtocol } from "./lib/protocols";

type InputSource = "microphone" | "file" | "url";
type ConnectionMode = "websocket" | "http";

export default function Home() {
  // -- Mode --
  const [connectionMode, setConnectionMode] = useState<ConnectionMode>("websocket");
  const [inputSource, setInputSource] = useState<InputSource>("microphone");

  // -- Shared state --
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [language, setLanguage] = useState("en");
  const [status, setStatus] = useState("Enter your API key and connect.");
  const [statusIsError, setStatusIsError] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  // -- Transcript --
  const [finalText, setFinalText] = useState("");
  const [partialText, setPartialText] = useState("");

  // -- File / URL inputs --
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [audioUrl, setAudioUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // -- WebSocket settings --
  const [wsUrl, setWsUrl] = useState(BRIDGES_BASE_URL + DEFAULT_MODEL);
  const [proxyUrl, setProxyUrl] = useState(
    process.env.NEXT_PUBLIC_WS_PROXY_URL || "ws://localhost:8787"
  );
  const [useProxy, setUseProxy] = useState(true);
  const [encoding, setEncoding] = useState("linear16");
  const [sampleRate, setSampleRate] = useState("16000");
  const [useDirectUrl, setUseDirectUrl] = useState(false);
  const [useCustomInit, setUseCustomInit] = useState(false);
  const [customInitPayload, setCustomInitPayload] = useState(
    getDefaultInitPayload(
      DEFAULT_MODEL,
      { sampleRate: 16000, language: "en", encoding: "linear16", enablePartials: true },
      getProtocol(DEFAULT_MODEL, false)
    )
  );
  const [enablePartials, setEnablePartials] = useState(true);
  const [isStreamingPlayback, setIsStreamingPlayback] = useState(false);

  // -- Refs --
  const restAbortControllerRef = useRef<AbortController | null>(null);
  const fileStreamingRef = useRef(false);

  // -- Hooks --
  const { entries, appendLog, clearLog } = useSessionLog();
  const parsedSampleRate = useMemo(() => {
    const v = parseInt(sampleRate, 10);
    return Number.isFinite(v) && v > 0 ? v : 16000;
  }, [sampleRate]);
  const {
    playPcmChunk,
    closeAudio,
    resetPlayTime,
    analyserNodeRef: playbackAnalyserRef,
    ensureAudioContext,
  } = useWebAudio(parsedSampleRate);
  const protocol = useMemo(
    () => getProtocol(model, useDirectUrl),
    [model, useDirectUrl]
  );

  // -- Status helpers --
  const setStatusMessage = useCallback((message: string, isError = false) => {
    setStatus(message);
    setStatusIsError(isError);
  }, []);

  // -- Transcript helpers --
  const clearTranscript = useCallback(() => {
    setFinalText("");
    setPartialText("");
  }, []);

  const extractTranscript = useCallback((payload: Record<string, unknown>): string | null => {
    // Try various response formats
    if (typeof payload.transcript === "string") return payload.transcript;
    if (typeof payload.text === "string") return payload.text;
    // Sarvam: { type: "data", data: { transcript: "…" } }
    const data = payload.data as Record<string, unknown> | undefined;
    if (data && typeof data.transcript === "string") return data.transcript;
    // Deepgram nested format
    const channel = payload.channel as Record<string, unknown> | undefined;
    if (channel?.alternatives) {
      const alts = channel.alternatives as Array<Record<string, unknown>>;
      if (alts[0]?.transcript) return alts[0].transcript as string;
    }
    const results = payload.results as Array<Record<string, unknown>> | undefined;
    if (results?.[0]) {
      const alts = results[0].alternatives as Array<Record<string, unknown>> | undefined;
      if (alts?.[0]?.transcript) return alts[0].transcript as string;
    }
    // Soniox tokens[] format
    const tokens = payload.tokens as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(tokens)) {
      return tokens.map((t) => (typeof t.text === "string" ? t.text : "")).join("");
    }
    return null;
  }, []);

  const isFinalResult = useCallback((payload: Record<string, unknown>): boolean => {
    if (payload.is_final === true) return true;
    if (payload.final === true) return true;
    if (payload.speech_final === true) return true;
    const type = (payload.type as string)?.toLowerCase();
    if (type === "final_transcript") return true;
    // Sarvam emits final transcripts only, under type "data"
    if (type === "data") return true;
    // Soniox: every token in the array is final
    const tokens = payload.tokens as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(tokens) && tokens.length > 0) {
      return tokens.every((t) => t.is_final === true);
    }
    return false;
  }, []);

  // -- WebSocket callbacks --
  const handleJsonMessage = useCallback(
    (payload: Record<string, unknown>) => {
      // Skip metadata/ready messages — not transcript data
      const msgType = (payload.type as string)?.toLowerCase();
      if (msgType === "metadata" || msgType === "ready") return;

      // Sarvam: VAD events — just log them
      if (msgType === "events") {
        const data = payload.data as Record<string, unknown> | undefined;
        const signal = typeof data?.signal_type === "string" ? data.signal_type : "?";
        appendLog(`VAD: ${signal}`);
        return;
      }

      // Sarvam / gateway error frames
      if (msgType === "error") {
        const data = payload.data as Record<string, unknown> | undefined;
        const message = typeof data?.message === "string" ? data.message : "Unknown error";
        const code = typeof data?.code === "string" ? ` (${data.code})` : "";
        setStatusMessage(`Server error: ${message}${code}`, true);
        appendLog(`Server error: ${message}${code}`);
        return;
      }

      // Soniox tokens[]: per-token final/partial split
      const tokens = payload.tokens as Array<Record<string, unknown>> | undefined;
      if (Array.isArray(tokens)) {
        const finalChunk = tokens
          .filter((t) => t.is_final === true)
          .map((t) => (typeof t.text === "string" ? t.text : ""))
          .join("");
        const partialChunk = tokens
          .filter((t) => t.is_final !== true)
          .map((t) => (typeof t.text === "string" ? t.text : ""))
          .join("");
        if (finalChunk) {
          setFinalText((prev) => prev + finalChunk);
          appendLog(`Final tokens: "${finalChunk}"`);
        }
        setPartialText(partialChunk);
        if (partialChunk) appendLog(`Partial tokens: "${partialChunk}"`);
        return;
      }

      const transcript = extractTranscript(payload);
      if (transcript !== null && transcript.trim()) {
        if (isFinalResult(payload)) {
          setFinalText((prev) => (prev ? prev + " " + transcript : transcript));
          setPartialText("");
          appendLog(`Final: "${transcript}"`);
        } else {
          setPartialText(transcript);
          appendLog(`Partial: "${transcript}"`);
        }
      } else if (isFinalResult(payload) && transcript === "") {
        // Empty final — clear partial
        setPartialText("");
      }

      if (payload.message && typeof payload.message === "string") {
        setStatusMessage(payload.message);
      }
    },
    [extractTranscript, isFinalResult, appendLog, setStatusMessage]
  );

  const handleBinaryMessage = useCallback(
    (_data: ArrayBuffer) => {
      appendLog(`Received binary message (${_data.byteLength} bytes)`);
    },
    [appendLog]
  );

  const {
    connect,
    disconnect,
    sendBinary,
    sendJson,
    isConnected,
    isReady,
  } = useWebSocket({
    onJsonMessage: handleJsonMessage,
    onBinaryMessage: handleBinaryMessage,
    onLog: appendLog,
    onStatusChange: setStatusMessage,
  });

  // -- Audio sender. Some protocols (Sarvam) need each PCM chunk wrapped as JSON. --
  const sendAudio = useCallback(
    (pcmData: ArrayBuffer) => {
      if (protocol.wrapAudio) {
        const frame = protocol.wrapAudio(pcmData, {
          sampleRate: parsedSampleRate,
          language,
          encoding,
          enablePartials,
        });
        if (typeof frame === "string") {
          sendJson(frame);
        } else {
          sendBinary(frame);
        }
        return;
      }
      sendBinary(pcmData);
    },
    [protocol, parsedSampleRate, language, encoding, enablePartials, sendBinary, sendJson]
  );

  // -- Microphone --
  const handleMicAudioData = useCallback(
    (pcmData: ArrayBuffer) => {
      sendAudio(pcmData);
    },
    [sendAudio]
  );

  const {
    startRecording,
    stopRecording,
    isRecording,
    analyserRef,
  } = useMicrophone({
    onAudioData: handleMicAudioData,
    onLog: appendLog,
    onStatusChange: setStatusMessage,
  });

  // -- Update WS URL when model or URL mode changes --
  useEffect(() => {
    setWsUrl(getWsUrl(model, useDirectUrl));
  }, [model, useDirectUrl]);

  // -- Auto-select language from model suffix --
  useEffect(() => {
    // Sarvam uses BCP-47 codes; default to auto-detect when this model is picked.
    if (model.startsWith("sarvam/")) {
      setLanguage("unknown");
      return;
    }
    const match = model.match(/:[\w]+-(\w+)$/);
    if (match) {
      const suffix = match[1];
      const lang = languageOptions.find((o) => o.value === suffix);
      if (lang) setLanguage(suffix);
    }
  }, [model]);

  // -- Sarvam only exposes a direct-WS endpoint (no bridge channel). --
  useEffect(() => {
    if (model.startsWith("sarvam/") && !useDirectUrl) setUseDirectUrl(true);
  }, [model, useDirectUrl]);

  const isSarvam = model.startsWith("sarvam/");
  const currentLanguageOptions = useMemo(() => getLanguageOptions(model), [model]);

  // -- Update custom init when config changes --
  useEffect(() => {
    setCustomInitPayload(
      getDefaultInitPayload(
        model,
        { sampleRate: parsedSampleRate, encoding, language, enablePartials },
        protocol
      )
    );
  }, [model, parsedSampleRate, encoding, language, enablePartials, protocol]);

  // -- Mode switching --
  const handleModeChange = useCallback(
    (mode: ConnectionMode) => {
      if (mode === "http" && isConnected) {
        fileStreamingRef.current = false;
        setIsStreamingPlayback(false);
        closeAudio();
        disconnect();
        stopRecording();
      }
      setConnectionMode(mode);
      if (mode === "http") {
        setInputSource("file");
        setStatusMessage("Select a file and transcribe.");
      } else {
        setStatusMessage("Enter your API key and connect.");
      }
    },
    [isConnected, disconnect, stopRecording, closeAudio, setStatusMessage]
  );

  // -- Connect / Disconnect --
  const handleConnect = useCallback(() => {
    if (isConnected) {
      if (isRecording) stopRecording();
      fileStreamingRef.current = false;
      setIsStreamingPlayback(false);
      closeAudio();
      if (protocol.closeText !== undefined) {
        sendJson(protocol.closeText);
      }
      disconnect();
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

    const configInput = {
      sampleRate: parsedSampleRate,
      language,
      encoding,
      enablePartials,
    };

    const initObject = protocol.buildInitMessage(configInput);

    const initMessage = useCustomInit
      ? customInitPayload.trim()
      : initObject === null
        ? ""
        : JSON.stringify(initObject);

    const finalWsUrl = protocol.buildUrl
      ? protocol.buildUrl(wsUrl.trim(), configInput)
      : wsUrl.trim();

    const doConnect = () => {
      connect({
        wsUrl: finalWsUrl,
        apiKey: apiKey.trim(),
        useProxy,
        proxyUrl: proxyUrl.trim(),
        initMessage,
      });
    };

    // Wake up the proxy if it's on a cold-start platform
    if (useProxy && proxyUrl.trim()) {
      const httpUrl = proxyUrl
        .trim()
        .replace(/^wss:\/\//, "https://")
        .replace(/^ws:\/\//, "http://");
      setStatusMessage("Waking up proxy...");
      appendLog(`Pinging proxy at ${httpUrl}`);
      fetch(httpUrl, { mode: "no-cors" }).catch(() => {});
      setTimeout(doConnect, 2000);
    } else {
      doConnect();
    }
  }, [
    isConnected,
    isRecording,
    stopRecording,
    closeAudio,
    disconnect,
    apiKey,
    wsUrl,
    useProxy,
    proxyUrl,
    encoding,
    parsedSampleRate,
    language,
    enablePartials,
    useCustomInit,
    customInitPayload,
    connect,
    protocol,
    sendJson,
    setStatusMessage,
    appendLog,
  ]);

  // -- Start / Stop recording (microphone) --
  const handleToggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
      // Send finalize to tell the server we're done
      sendJson(protocol.finalizeText ?? JSON.stringify({ type: "finalize" }));
      setStatusMessage("Recording stopped. Waiting for final transcript...");
      appendLog("Sent finalize signal.");
    } else {
      if (!isReady) {
        setStatusMessage("Connect to WebSocket first.", true);
        return;
      }
      startRecording(parsedSampleRate);
    }
  }, [
    isRecording,
    isReady,
    stopRecording,
    startRecording,
    sendJson,
    parsedSampleRate,
    setStatusMessage,
    appendLog,
    protocol,
  ]);

  // -- Send file audio over WebSocket --
  const handleSendFile = useCallback(async () => {
    if (!selectedFile) {
      setStatusMessage("Select an audio file first.", true);
      return;
    }
    if (!isReady) {
      setStatusMessage("Connect to WebSocket first.", true);
      return;
    }

    setIsBusy(true);
    fileStreamingRef.current = true;
    setStatusMessage("Decoding and streaming file...");
    appendLog(`Streaming file: ${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)`);

    ensureAudioContext();
    resetPlayTime();
    setIsStreamingPlayback(true);

    try {
      const float32Data = await decodeAudioFile(selectedFile, parsedSampleRate);
      const chunkSize = parsedSampleRate; // 1 second of audio per chunk
      let offset = 0;

      while (offset < float32Data.length && fileStreamingRef.current) {
        const end = Math.min(offset + chunkSize, float32Data.length);
        const chunk = float32Data.slice(offset, end);
        const pcm = floatTo16BitPCM(chunk);
        sendAudio(pcm);
        playPcmChunk(new Uint8Array(pcm));
        offset = end;

        // Pace the sending to roughly real-time
        await new Promise((r) => setTimeout(r, 500));
      }

      sendJson(protocol.finalizeText ?? JSON.stringify({ type: "finalize" }));
      appendLog("File streaming complete. Sent finalize.");
      setStatusMessage("File sent. Waiting for transcript...");
    } catch (err) {
      setStatusMessage(`File error: ${(err as Error).message}`, true);
      appendLog(`File error: ${(err as Error).message}`);
    } finally {
      setIsBusy(false);
      fileStreamingRef.current = false;
      setIsStreamingPlayback(false);
    }
  }, [selectedFile, isReady, parsedSampleRate, sendAudio, sendJson, setStatusMessage, appendLog, ensureAudioContext, resetPlayTime, playPcmChunk, protocol]);

  // -- Send URL audio over WebSocket --
  const handleSendUrl = useCallback(async () => {
    if (!audioUrl.trim()) {
      setStatusMessage("Enter an audio URL first.", true);
      return;
    }
    if (!isReady) {
      setStatusMessage("Connect to WebSocket first.", true);
      return;
    }

    setIsBusy(true);
    setStatusMessage("Fetching audio from URL...");
    appendLog(`Fetching: ${audioUrl}`);

    ensureAudioContext();
    resetPlayTime();
    setIsStreamingPlayback(true);

    try {
      const response = await fetch(audioUrl.trim());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer]);
      const file = new File([blob], "url-audio", { type: response.headers.get("content-type") || "audio/wav" });

      const float32Data = await decodeAudioFile(file, parsedSampleRate);
      const chunkSize = parsedSampleRate;
      let offset = 0;

      appendLog(`Audio decoded: ${(float32Data.length / parsedSampleRate).toFixed(1)}s`);
      setStatusMessage("Streaming audio to STT...");

      while (offset < float32Data.length) {
        const end = Math.min(offset + chunkSize, float32Data.length);
        const chunk = float32Data.slice(offset, end);
        const pcm = floatTo16BitPCM(chunk);
        sendAudio(pcm);
        playPcmChunk(new Uint8Array(pcm));
        offset = end;
        await new Promise((r) => setTimeout(r, 500));
      }

      sendJson(protocol.finalizeText ?? JSON.stringify({ type: "finalize" }));
      appendLog("URL audio streaming complete. Sent finalize.");
      setStatusMessage("Audio sent. Waiting for transcript...");
    } catch (err) {
      setStatusMessage(`URL error: ${(err as Error).message}`, true);
      appendLog(`URL error: ${(err as Error).message}`);
    } finally {
      setIsBusy(false);
      setIsStreamingPlayback(false);
    }
  }, [audioUrl, isReady, parsedSampleRate, sendAudio, sendJson, setStatusMessage, appendLog, ensureAudioContext, resetPlayTime, playPcmChunk, protocol]);

  // -- HTTP file upload --
  const handleHttpTranscribe = useCallback(async () => {
    if (!selectedFile) {
      setStatusMessage("Select an audio file first.", true);
      return;
    }
    if (!apiKey.trim()) {
      setStatusMessage("Enter your SLNG API key.", true);
      return;
    }

    if (restAbortControllerRef.current) restAbortControllerRef.current.abort();
    restAbortControllerRef.current = new AbortController();

    setIsBusy(true);
    setStatusMessage("Uploading and transcribing...");

    const url = HTTP_BASE_URL + model;
    const formData = new FormData();
    formData.append("audio", selectedFile);

    appendLog(`HTTP POST ${url} (${(selectedFile.size / 1024).toFixed(1)} KB)`);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: formData,
        signal: restAbortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        setStatusMessage(`Error ${response.status}: ${errorText}`, true);
        appendLog(`HTTP error: ${response.status} ${errorText}`);
        return;
      }

      const result = await response.json();
      appendLog(`Response: ${JSON.stringify(result).slice(0, 500)}`);

      // Extract transcript from various response formats
      let transcript = "";
      if (result.transcript) {
        transcript = result.transcript;
      } else if (result.results?.channels?.[0]?.alternatives?.[0]?.transcript) {
        transcript = result.results.channels[0].alternatives[0].transcript;
      } else if (result.text) {
        transcript = result.text;
      }

      if (transcript) {
        setFinalText((prev) => (prev ? prev + " " + transcript : transcript));
        setStatusMessage("Transcription complete.");
      } else {
        setStatusMessage("No transcript in response. Check logs.");
        appendLog(`Full response: ${JSON.stringify(result)}`);
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setStatusMessage(`Request failed: ${(error as Error).message}`, true);
      appendLog(`HTTP error: ${(error as Error).message}`);
    } finally {
      setIsBusy(false);
      restAbortControllerRef.current = null;
    }
  }, [selectedFile, apiKey, model, appendLog, setStatusMessage]);

  // -- Action button handler --
  const handleAction = useCallback(() => {
    if (connectionMode === "http") {
      handleHttpTranscribe();
      return;
    }

    switch (inputSource) {
      case "microphone":
        handleToggleRecording();
        break;
      case "file":
        handleSendFile();
        break;
      case "url":
        handleSendUrl();
        break;
    }
  }, [connectionMode, inputSource, handleToggleRecording, handleSendFile, handleSendUrl, handleHttpTranscribe]);

  // -- Computed --
  const isWs = connectionMode === "websocket";
  const isMissingApiKey = apiKey.trim().length === 0;

  const isActionDisabled = (() => {
    if (connectionMode === "http") {
      return isBusy || isMissingApiKey || !selectedFile;
    }
    if (inputSource === "microphone") {
      return isRecording ? false : !isReady;
    }
    return !isReady || isBusy;
  })();

  const actionButtonLabel = (() => {
    if (connectionMode === "http") {
      return isBusy ? "Transcribing..." : "Transcribe";
    }
    if (inputSource === "microphone") {
      return isRecording ? "Stop recording" : "Start recording";
    }
    if (inputSource === "file") {
      return isBusy ? "Streaming..." : "Send file";
    }
    return isBusy ? "Streaming..." : "Send URL";
  })();

  const curlPreview = useMemo(() => {
    const url = HTTP_BASE_URL + model;
    return `curl "${url}" \\\n  -H "Authorization: Bearer $SLNG_API_KEY" \\\n  -F "audio=@recording.wav"`;
  }, [model]);

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
            <span className="brand-subtitle">STT Demo</span>
          </div>
        </div>
      </header>

      <div className={`card ${isRecording ? "is-recording" : ""}`}>
        <h1>SLNG STT Demo</h1>
        <p>Speak, upload a file, or paste a URL to transcribe.</p>

        {/* Connection mode toggle */}
        <div className="mode-toggle">
          <button
            type="button"
            className={connectionMode === "websocket" ? "active" : ""}
            onClick={() => handleModeChange("websocket")}
          >
            WebSocket
          </button>
          <button
            type="button"
            className={connectionMode === "http" ? "active" : ""}
            onClick={() => handleModeChange("http")}
          >
            HTTP
          </button>
        </div>

        {/* Input source toggle (WS only — HTTP is always file) */}
        {isWs && (
          <div className="input-source-toggle">
            <button
              type="button"
              className={inputSource === "microphone" ? "active" : ""}
              onClick={() => setInputSource("microphone")}
            >
              Microphone
            </button>
            <button
              type="button"
              className={inputSource === "file" ? "active" : ""}
              onClick={() => setInputSource("file")}
            >
              File
            </button>
            <button
              type="button"
              className={inputSource === "url" ? "active" : ""}
              onClick={() => setInputSource("url")}
            >
              URL
            </button>
          </div>
        )}

        {/* File input */}
        {(inputSource === "file" || connectionMode === "http") && (
          <div
            className={`file-input-area ${selectedFile ? "has-file" : ""}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0] || null;
                setSelectedFile(file);
                if (file) appendLog(`File selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
              }}
            />
            {selectedFile ? (
              <>
                <p>Selected file:</p>
                <p className="file-name">{selectedFile.name}</p>
              </>
            ) : (
              <p>Click to select an audio file (MP3, WAV, FLAC, OGG, WebM)</p>
            )}
          </div>
        )}

        {/* URL input */}
        {inputSource === "url" && isWs && (
          <div className="url-input-row">
            <label htmlFor="audioUrlInput">Audio URL</label>
            <input
              id="audioUrlInput"
              type="url"
              placeholder="https://example.com/audio.wav"
              value={audioUrl}
              onChange={(e) => setAudioUrl(e.target.value)}
            />
          </div>
        )}

        {/* Model / Language selectors */}
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
            <label htmlFor="languageSelect">Language</label>
            <select
              id="languageSelect"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {currentLanguageOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
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
                className="secondary"
                onClick={handleConnect}
              >
                {isConnected ? "Disconnect" : "Connect"}
              </button>
            )}
            <button
              type="button"
              className={`hero-button ${isBusy ? "is-loading" : ""} ${
                isRecording ? "is-recording" : ""
              } ${isActionDisabled ? "is-disabled" : ""}`}
              onClick={handleAction}
              disabled={isActionDisabled}
            >
              <span className="pulse" aria-hidden="true"></span>
              {actionButtonLabel}
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

        {/* Waveform (microphone mode) */}
        {isWs && inputSource === "microphone" && (
          <WaveformCanvas
            analyserNode={analyserRef.current}
            isActive={isRecording}
          />
        )}

        {/* Waveform (file/URL playback) */}
        {isWs && (inputSource === "file" || inputSource === "url") && (
          <WaveformCanvas
            analyserNode={playbackAnalyserRef.current}
            isActive={isStreamingPlayback}
          />
        )}

        {/* Transcript display */}
        <TranscriptDisplay
          finalText={finalText}
          partialText={partialText}
          onClear={clearTranscript}
        />

        {/* Log console */}
        <LogConsole entries={entries} onClear={clearLog} />

        {/* How to implement */}
        <details>
          <summary>How to implement</summary>
          <div className="code-samples">
            {!isWs && (
              <>
                <CodeBlock
                  title="cURL"
                  language="bash"
                  code={curlPreview}
                />
                <CodeBlock
                  title="JavaScript"
                  language="javascript"
                  code={`const MODEL = "${model}";
const API_KEY = "YOUR_API_KEY";

const formData = new FormData();
formData.append("audio", audioFile);

const res = await fetch(
  "${HTTP_BASE_URL}" + MODEL,
  {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + API_KEY,
    },
    body: formData,
  }
);

const result = await res.json();
console.log(result.transcript);`}
                />
              </>
            )}
            {isWs && protocol.name === "default" && (
              <CodeBlock
                title="WebSocket — Streaming STT"
                language="javascript"
                wide
                code={`const MODEL = "${model}";
const SAMPLE_RATE = ${parsedSampleRate};

// Connect to WebSocket
const ws = new WebSocket("${wsUrl}");
ws.binaryType = "arraybuffer";

ws.onopen = () => {
  // 1. Initialize the session
  ws.send(JSON.stringify({
    type: "init",
    config: {
      encoding: "${encoding}",
      sample_rate: SAMPLE_RATE,
      language: "${language}",
    },
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.type === "ready") {
    // 2. Session is ready — start sending audio
    startMicrophone(ws, SAMPLE_RATE);
  }

  if (msg.type === "partial_transcript") {
    console.log("Partial:", msg.transcript);
  }

  if (msg.type === "final_transcript") {
    console.log("Final:", msg.transcript);
  }
};

// Stream microphone audio as PCM16
async function startMicrophone(ws, sampleRate) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { sampleRate, channelCount: 1 },
  });

  const ctx = new AudioContext({ sampleRate });
  await ctx.audioWorklet.addModule("/audio-processor.js");

  const source = ctx.createMediaStreamSource(stream);
  const worklet = new AudioWorkletNode(ctx, "pcm-processor");

  worklet.port.onmessage = (e) => {
    const float32 = e.data;
    const pcm16 = new ArrayBuffer(float32.length * 2);
    const view = new DataView(pcm16);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    ws.send(pcm16);
  };

  source.connect(worklet);
  worklet.connect(ctx.destination);
}`}
              />
            )}
            {isWs && protocol.name === "soniox-direct" && (
              <CodeBlock
                title="WebSocket — Streaming STT (Soniox direct)"
                language="javascript"
                wide
                code={`const MODEL = "${model}";
const SAMPLE_RATE = ${parsedSampleRate};

const ws = new WebSocket("${wsUrl}");
ws.binaryType = "arraybuffer";

ws.onopen = () => {
  // 1. Initialize — Soniox expects a flat config object (no wrapper).
  // The SLNG gateway adds api_key for you.
  ws.send(JSON.stringify({
    model: "stt-rt-v4",
    audio_format: "pcm_s16le",
    sample_rate: SAMPLE_RATE,
    num_channels: 1,
    language_hints: ["${language}"],
    enable_endpoint_detection: true,
    max_endpoint_delay_ms: 500,
    enable_partial_results: true,
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  // Soniox sends { tokens: [{ text, is_final, ... }] }
  if (Array.isArray(msg.tokens)) {
    const finalText = msg.tokens.filter((t) => t.is_final).map((t) => t.text).join("");
    const partialText = msg.tokens.filter((t) => !t.is_final).map((t) => t.text).join("");
    if (finalText) console.log("Final:", finalText);
    if (partialText) console.log("Partial:", partialText);
  }
};

// Stream microphone audio as raw binary PCM16 frames (no JSON wrapping)
async function startMicrophone(ws, sampleRate) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { sampleRate, channelCount: 1 },
  });
  const ctx = new AudioContext({ sampleRate });
  await ctx.audioWorklet.addModule("/audio-processor.js");
  const source = ctx.createMediaStreamSource(stream);
  const worklet = new AudioWorkletNode(ctx, "pcm-processor");

  worklet.port.onmessage = (e) => {
    const float32 = e.data;
    const pcm16 = new ArrayBuffer(float32.length * 2);
    const view = new DataView(pcm16);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    ws.send(pcm16);
  };

  source.connect(worklet);
  worklet.connect(ctx.destination);
}

// End-of-stream: send an empty string text frame, then close.
function endStream(ws) {
  ws.send("");
  ws.close();
}`}
              />
            )}
            {isWs && protocol.name === "sarvam" && (
              <CodeBlock
                title="WebSocket — Streaming STT (Sarvam Saaras v3)"
                language="javascript"
                wide
                code={`const MODEL = "${model}";
const SAMPLE_RATE = ${parsedSampleRate};
const LANGUAGE = "${language}"; // BCP-47 (e.g. "hi-IN") or "unknown" for auto-detect

// 1. Session config goes in the URL query string — no init message.
const url = new URL("${wsUrl}");
url.searchParams.set("language-code", LANGUAGE);
url.searchParams.set("mode", "transcribe");
url.searchParams.set("sample_rate", String(SAMPLE_RATE));
url.searchParams.set("input_audio_codec", "linear16");
url.searchParams.set("vad_signals", "true");

const ws = new WebSocket(url);

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.type === "data")   console.log("Transcript:", msg.data.transcript);
  if (msg.type === "events") console.log("VAD:", msg.data.signal_type);
  if (msg.type === "error")  console.error("Error:", msg.data.message);
};

// 2. Audio frames are base64-encoded JSON — not raw binary.
async function startMicrophone(ws, sampleRate) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { sampleRate, channelCount: 1 },
  });
  const ctx = new AudioContext({ sampleRate });
  await ctx.audioWorklet.addModule("/audio-processor.js");
  const source = ctx.createMediaStreamSource(stream);
  const worklet = new AudioWorkletNode(ctx, "pcm-processor");

  worklet.port.onmessage = (e) => {
    const float32 = e.data;
    const pcm16 = new ArrayBuffer(float32.length * 2);
    const view = new DataView(pcm16);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    const bytes = new Uint8Array(pcm16);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    ws.send(JSON.stringify({
      audio: { data: btoa(bin), sample_rate: sampleRate, encoding: "linear16" },
    }));
  };

  source.connect(worklet);
  worklet.connect(ctx.destination);
}

// 3. Mid-stream finalize: ask the server to flush the current utterance.
function flush(ws) {
  ws.send(JSON.stringify({ type: "flush" }));
}`}
              />
            )}
          </div>
        </details>

        {/* Advanced settings (WS only) */}
        {isWs && (
          <details>
            <summary>Advanced settings</summary>
            <div className="row" style={{ marginTop: 12 }}>
              <div style={{ flex: 1 }}>
                <label htmlFor="wsUrlInput">WebSocket URL</label>
                <input
                  id="wsUrlInput"
                  type="text"
                  value={wsUrl}
                  onChange={(e) => setWsUrl(e.target.value)}
                />
              </div>
              <div style={{ flex: "0 0 200px", alignSelf: "flex-end" }}>
                <label htmlFor="urlPattern">URL pattern</label>
                <select
                  id="urlPattern"
                  value={useDirectUrl ? "direct" : "bridge"}
                  onChange={(e) => setUseDirectUrl(e.target.value === "direct")}
                  disabled={isSarvam}
                  title={isSarvam ? "Sarvam Saaras v3 only has a direct WebSocket channel." : undefined}
                >
                  <option value="bridge">Bridge (/v1/bridges/unmute/stt/)</option>
                  <option value="direct">Direct (/v1/stt/)</option>
                </select>
              </div>
            </div>

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
                <label htmlFor="encodingSelect">Encoding</label>
                <select
                  id="encodingSelect"
                  value={encoding}
                  onChange={(e) => setEncoding(e.target.value)}
                >
                  <option value="linear16">Linear16 (PCM)</option>
                  <option value="pcm_mulaw">PCM mu-law</option>
                </select>
              </div>
              <div>
                <label htmlFor="sampleRateInput">Sample rate</label>
                <input
                  id="sampleRateInput"
                  type="text"
                  value={sampleRate}
                  inputMode="numeric"
                  onChange={(e) => setSampleRate(e.target.value)}
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
                    checked={enablePartials}
                    onChange={(e) => setEnablePartials(e.target.checked)}
                  />
                  Partial transcripts
                </label>
              </div>
            </div>

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
              rows={6}
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
