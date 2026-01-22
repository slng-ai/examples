const connectBtn = document.getElementById("connectBtn");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const apiKeyInput = document.getElementById("apiKeyInput");
const wsUrlInput = document.getElementById("wsUrlInput");
const proxyModeInput = document.getElementById("proxyMode");
const proxyUrlInput = document.getElementById("proxyUrlInput");
const inputDeviceSelect = document.getElementById("inputDeviceSelect");
const refreshDevicesBtn = document.getElementById("refreshDevicesBtn");
const audioSourceSelect = document.getElementById("audioSourceSelect");
const audioFileInput = document.getElementById("audioFileInput");
const fileGroup = document.getElementById("fileGroup");
const deviceGroup = document.getElementById("deviceGroup");
const sampleRateInput = document.getElementById("sampleRateInput");
const channelsInput = document.getElementById("channelsInput");
const customInitModeInput = document.getElementById("customInitMode");
const customInitPayload = document.getElementById("customInitPayload");
const customStopModeInput = document.getElementById("customStopMode");
const customStopPayload = document.getElementById("customStopPayload");
const statusEl = document.getElementById("status");
const logEl = document.getElementById("log");
const interimTranscriptEl = document.getElementById("interimTranscript");
const finalTranscriptEl = document.getElementById("finalTranscript");

let socket = null;
let isConnected = false;
let isRecording = false;
let mediaStream = null;
let audioContext = null;
let sourceNode = null;
let processorNode = null;
let workletNode = null;
let workletGain = null;
let deviceListReady = false;
let micPermissionGranted = false;
let fileStreamTimer = null;
let fileStreamOffset = 0;
let fileStreamSamples = null;
let fileStreamSampleRate = 16000;
let finalTranscriptText = "";
let latestInterimText = "";
let pendingAutoStart = null;

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

function appendLog(message) {
  const timestamp = new Date().toLocaleTimeString();
  logEl.textContent = `${timestamp} ${message}\n${logEl.textContent}`;
}

function updateButtons() {
  const source = getAudioSource();
  const hasFile = hasSelectedFile();
  connectBtn.textContent = isConnected ? "Disconnect" : "Connect";
  connectBtn.disabled = false;
  connectBtn.classList.toggle("secondary", !isConnected);
  startBtn.textContent =
    source === "file" ? "Start file stream" : "Start recording";
  startBtn.disabled =
    isRecording || (source === "file" && !hasFile);
  stopBtn.disabled = !isConnected || !isRecording;
}

function setDeviceOptions(devices) {
  const previous = inputDeviceSelect.value;
  inputDeviceSelect.innerHTML =
    '<option value="">Default microphone</option>';
  devices.forEach((device) => {
    const option = document.createElement("option");
    option.value = device.deviceId;
    option.textContent = device.label || `Microphone ${device.deviceId}`;
    inputDeviceSelect.appendChild(option);
  });
  if (previous) {
    inputDeviceSelect.value = previous;
  }
}

async function loadAudioDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    setStatus("Audio device selection not supported.", true);
    return;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const inputs = devices.filter((device) => device.kind === "audioinput");
    setDeviceOptions(inputs);
    deviceListReady = true;
  } catch (error) {
    setStatus(`Unable to list devices: ${error.message}`, true);
  }
}

async function requestMicPermission() {
  if (micPermissionGranted) {
    return true;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("Microphone access is not supported in this browser.", true);
    return false;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    micPermissionGranted = true;
    return true;
  } catch (error) {
    setStatus(`Microphone permission error: ${error.message}`, true);
    return false;
  }
}

function getSelectedDeviceId() {
  const value = inputDeviceSelect.value;
  return value ? value : null;
}

function buildWsUrl() {
  return wsUrlInput.value.trim();
}

function buildProxyUrl() {
  return proxyUrlInput.value.trim();
}

function getSampleRate() {
  const value = Number.parseInt(sampleRateInput.value, 10);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return 16000;
}

function getChannels() {
  const value = Number.parseInt(channelsInput.value, 10);
  if (Number.isFinite(value) && value > 0) {
    return value;
  }
  return 1;
}

function getAudioSource() {
  return audioSourceSelect?.value || "microphone";
}

function hasSelectedFile() {
  return Boolean(audioFileInput?.files && audioFileInput.files.length > 0);
}

function updateSourceUI() {
  const source = getAudioSource();
  const isFile = source === "file";
  const isMic = source === "microphone";
  if (fileGroup) {
    fileGroup.hidden = !isFile;
  }
  if (deviceGroup) {
    deviceGroup.hidden = !isMic;
  }
}

function buildInitMessage() {
  if (customInitModeInput?.checked) {
    return customInitPayload.value.trim();
  }

  const config = {
    encoding: "linear16",
    sample_rate: getSampleRate(),
    channels: getChannels(),
  };
  return JSON.stringify({ type: "init", config });
}

function buildStopMessage() {
  if (customStopModeInput?.checked) {
    return customStopPayload.value.trim();
  }
  return JSON.stringify({ type: "stop" });
}

function resetTranscript() {
  finalTranscriptText = "";
  latestInterimText = "";
  renderTranscript();
}

function renderTranscript() {
  const combined = latestInterimText
    ? finalTranscriptText
      ? `${finalTranscriptText}\n${latestInterimText}`
      : latestInterimText
    : finalTranscriptText;
  finalTranscriptEl.textContent = combined;
  interimTranscriptEl.textContent = "";
}

function appendFinal(text) {
  if (!text) {
    return;
  }
  finalTranscriptText = finalTranscriptText
    ? `${finalTranscriptText}\n${text}`
    : text;
  latestInterimText = "";
  renderTranscript();
}

function setInterim(text) {
  latestInterimText = text || "";
  renderTranscript();
}

function extractTranscript(payload) {
  if (typeof payload.transcript === "string") {
    return payload.transcript;
  }
  if (typeof payload.text === "string") {
    return payload.text;
  }
  if (payload.channel?.alternatives?.length) {
    return payload.channel.alternatives[0]?.transcript || "";
  }
  if (payload.results?.length) {
    return payload.results[0]?.alternatives?.[0]?.transcript || "";
  }
  return "";
}

function isFinalResult(payload) {
  return Boolean(
    payload.is_final ||
      payload.final ||
      payload.type === "final_transcript" ||
      payload.channel?.is_final ||
      payload.speech_final ||
      payload.result?.final
  );
}

function handleJsonMessage(payload) {
  if (payload.type === "ready") {
    setStatus("Connected. Ready to record.");
  }

  if (payload.message) {
    setStatus(payload.message);
  }

  const transcript = extractTranscript(payload);
  if (transcript) {
    if (isFinalResult(payload)) {
      appendFinal(transcript);
      setInterim("");
    } else {
      setInterim(transcript);
    }
  }
}

function createWebSocket(url, apiKey) {
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : null;
  if (!headers) {
    return new WebSocket(url);
  }

  try {
    return new WebSocket(url, [], { headers });
  } catch {
    return new WebSocket(url);
  }
}

function closeSocket() {
  if (socket) {
    socket.close();
    socket = null;
  }
  isConnected = false;
  updateButtons();
}

function floatTo16BitPCM(float32Array) {
  const output = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i += 1) {
    let s = float32Array[i];
    if (s > 1) s = 1;
    if (s < -1) s = -1;
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

async function setupAudioProcessing() {
  if (!audioContext || !sourceNode) {
    return false;
  }

  if (audioContext.audioWorklet?.addModule) {
    try {
      await audioContext.audioWorklet.addModule("audio-processor.js");
      workletNode = new AudioWorkletNode(audioContext, "pcm-processor");
      workletNode.port.onmessage = (event) => {
        if (!isRecording || !socket || socket.readyState !== WebSocket.OPEN) {
          return;
        }
        const input = event.data;
        const pcm16 = floatTo16BitPCM(input);
        socket.send(pcm16.buffer);
      };
      workletGain = audioContext.createGain();
      workletGain.gain.value = 0;
      sourceNode.connect(workletNode);
      workletNode.connect(workletGain);
      workletGain.connect(audioContext.destination);
      return true;
    } catch (error) {
      appendLog(`AudioWorklet unavailable, falling back: ${error.message}`);
    }
  }

  processorNode = audioContext.createScriptProcessor(1024, 1, 1);
  processorNode.onaudioprocess = (event) => {
    if (!isRecording || !socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const input = event.inputBuffer.getChannelData(0);
    const pcm16 = floatTo16BitPCM(input);
    socket.send(pcm16.buffer);
  };
  sourceNode.connect(processorNode);
  processorNode.connect(audioContext.destination);
  return false;
}

function clearFileStreamingState() {
  if (fileStreamTimer) {
    clearTimeout(fileStreamTimer);
    fileStreamTimer = null;
  }
  fileStreamOffset = 0;
  fileStreamSamples = null;
  fileStreamSampleRate = getSampleRate();
}

async function startFileStreaming() {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    setStatus("Connect first.", true);
    return;
  }
  if (!hasSelectedFile()) {
    setStatus("Select an audio file first.", true);
    return;
  }

  const file = audioFileInput.files[0];
  const sampleRate = getSampleRate();
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContext({ sampleRate });

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    fileStreamSamples = audioBuffer.getChannelData(0);
    fileStreamSampleRate = audioBuffer.sampleRate;
    fileStreamOffset = 0;
  } catch (error) {
    setStatus(`File decode error: ${error.message}`, true);
    await audioContext.close();
    audioContext = null;
    return;
  }

  isRecording = true;
  updateButtons();
  setStatus("Streaming file...");

  const chunkSize = 4096;
  const sendChunk = () => {
    if (!isRecording || !socket || socket.readyState !== WebSocket.OPEN) {
      return;
    }
    const end = Math.min(fileStreamOffset + chunkSize, fileStreamSamples.length);
    const slice = fileStreamSamples.subarray(fileStreamOffset, end);
    const pcm16 = floatTo16BitPCM(slice);
    socket.send(pcm16.buffer);
    fileStreamOffset = end;

    if (fileStreamOffset >= fileStreamSamples.length) {
      stopRecording();
      return;
    }

    const delayMs = (chunkSize / fileStreamSampleRate) * 1000;
    fileStreamTimer = setTimeout(sendChunk, delayMs);
  };

  sendChunk();
}

async function startRecording() {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    setStatus("Connect first.", true);
    return;
  }

  try {
    const deviceId = getSelectedDeviceId();
    const audioConstraints = deviceId
      ? { deviceId: { exact: deviceId } }
      : true;
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
    });
    micPermissionGranted = true;
    await loadAudioDevices();
  } catch (error) {
    setStatus(`Microphone error: ${error.message}`, true);
    return;
  }

  const sampleRate = getSampleRate();
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioContext = new AudioContext({ sampleRate });
  await audioContext.resume();

  sourceNode = audioContext.createMediaStreamSource(mediaStream);
  await setupAudioProcessing();

  isRecording = true;
  updateButtons();
  setStatus("Recording... speak into your microphone.");
}

async function stopRecording() {
  if (!isRecording) {
    return;
  }

  isRecording = false;
  updateButtons();
  clearFileStreamingState();

  if (processorNode) {
    processorNode.disconnect();
    processorNode.onaudioprocess = null;
    processorNode = null;
  }
  if (workletNode) {
    workletNode.port.onmessage = null;
    workletNode.disconnect();
    workletNode = null;
  }
  if (workletGain) {
    workletGain.disconnect();
    workletGain = null;
  }
  if (sourceNode) {
    sourceNode.disconnect();
    sourceNode = null;
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }
  if (audioContext) {
    await audioContext.close();
    audioContext = null;
  }

  if (socket && socket.readyState === WebSocket.OPEN) {
    const stopMessage = buildStopMessage();
    if (stopMessage) {
      socket.send(stopMessage);
    }
  }

  setStatus("Recording stopped.");
}

function validateCustomJson(value, label) {
  if (!value) {
    setStatus(`Enter ${label} JSON.`, true);
    return false;
  }
  try {
    JSON.parse(value);
  } catch (error) {
    setStatus(`Invalid ${label} JSON: ${error.message}`, true);
    return false;
  }
  return true;
}

function connectSocket() {
  if (pendingAutoStart === null) {
    pendingAutoStart = null;
  }
  const apiKey = apiKeyInput.value.trim();
  const useProxy = proxyModeInput.checked;

  if (!apiKey) {
    setStatus("Enter your SLNG API key.", true);
    return;
  }

  let wsUrl = "";
  try {
    wsUrl = useProxy ? buildProxyUrl() : buildWsUrl();
  } catch (error) {
    setStatus(`Invalid WebSocket URL: ${error.message}`, true);
    return;
  }
  if (!wsUrl) {
    setStatus("Enter a WebSocket URL.", true);
    return;
  }
  if (useProxy && !buildWsUrl()) {
    setStatus("Enter the target WebSocket URL.", true);
    return;
  }
  if (customInitModeInput?.checked) {
    if (!validateCustomJson(customInitPayload.value.trim(), "init")) {
      return;
    }
  }

  setStatus("Connecting...");
  appendLog(`Connecting to ${wsUrl}`);
  resetTranscript();

  socket = useProxy ? new WebSocket(wsUrl) : createWebSocket(wsUrl, apiKey);
  isConnected = true;
  updateButtons();

  socket.addEventListener("open", () => {
    appendLog("WebSocket open. Sending init.");
    if (useProxy) {
      const target = buildWsUrl();
      const envelope = JSON.stringify({ api_key: apiKey, target });
      socket.send(envelope);
    }
    const initMessage = buildInitMessage();
    if (initMessage) {
      socket.send(initMessage);
    }
    setStatus("Connected. Ready to record.");
    loadAudioDevices();

    if (pendingAutoStart) {
      const next = pendingAutoStart;
      pendingAutoStart = null;
      if (next === "file") {
        startFileStreaming();
      } else {
        startRecording();
      }
    }
  });

  socket.addEventListener("message", (event) => {
    if (typeof event.data === "string") {
      appendLog(`Message: ${event.data}`);
      try {
        const payload = JSON.parse(event.data);
        handleJsonMessage(payload);
      } catch {
        setStatus(event.data);
      }
      return;
    }

    appendLog("Binary message received.");
  });

  socket.addEventListener("close", () => {
    appendLog("WebSocket closed.");
    if (isRecording) {
      stopRecording();
    }
    setStatus("Disconnected.");
    pendingAutoStart = null;
    closeSocket();
  });

  socket.addEventListener("error", () => {
    setStatus("WebSocket error. Check the log for details.", true);
    appendLog("WebSocket error.");
  });
}

connectBtn.addEventListener("click", () => {
  if (isConnected) {
    setStatus("Disconnecting...");
    if (isRecording) {
      stopRecording();
    }
    closeSocket();
    return;
  }
  connectSocket();
});

refreshDevicesBtn.addEventListener("click", async () => {
  await requestMicPermission();
  await loadAudioDevices();
});

startBtn.addEventListener("click", () => {
  if (customStopModeInput?.checked) {
    if (!validateCustomJson(customStopPayload.value.trim(), "stop")) {
      return;
    }
  }
  const source = getAudioSource();
  if (source === "file" && !hasSelectedFile()) {
    setStatus("Select an audio file first.", true);
    return;
  }
  if (!isConnected) {
    pendingAutoStart = source;
    connectSocket();
    return;
  }
  if (source === "file") {
    startFileStreaming();
  } else {
    startRecording();
  }
});

stopBtn.addEventListener("click", () => {
  if (customStopModeInput?.checked) {
    if (!validateCustomJson(customStopPayload.value.trim(), "stop")) {
      return;
    }
  }
  stopRecording();
});

if (navigator.mediaDevices?.addEventListener) {
  navigator.mediaDevices.addEventListener("devicechange", () => {
    loadAudioDevices();
  });
}

audioSourceSelect?.addEventListener("change", () => {
  updateSourceUI();
  updateButtons();
});

audioFileInput?.addEventListener("change", () => {
  updateButtons();
});

updateButtons();
loadAudioDevices();
updateSourceUI();
