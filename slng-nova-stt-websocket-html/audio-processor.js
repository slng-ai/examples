class PcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const channel = input[0];
      this.port.postMessage(new Float32Array(channel));
    }
    return true;
  }
}

registerProcessor("pcm-processor", PcmProcessor);
