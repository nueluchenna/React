export type AudioChunkCallback = (pcmData: Float32Array) => void;
export type AudioLevelCallback = (rmsLevel: number) => void;

const TARGET_SAMPLE_RATE = 16000;
const CHUNK_DURATION_SECONDS = 4;
const OVERLAP_DURATION_SECONDS = 0.5;
const SILENCE_RMS_THRESHOLD = 0.008; // Filters out room silence/hum

export class ContinuousAudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;

  private sampleBuffer: number[] = [];
  private isRecordingState = false;

  private onChunk: AudioChunkCallback;
  private onLevel?: AudioLevelCallback;

  constructor(onChunk: AudioChunkCallback, onLevel?: AudioLevelCallback) {
    this.onChunk = onChunk;
    this.onLevel = onLevel;
  }

  public async start(): Promise<void> {
    if (this.isRecordingState) return;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: TARGET_SAMPLE_RATE,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    });

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioCtx({ sampleRate: TARGET_SAMPLE_RATE });

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const actualSampleRate = this.audioContext.sampleRate;
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);

    // 4096 buffer size gives a smooth balance between UI level updates and CPU usage
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

    const targetChunkSamples = TARGET_SAMPLE_RATE * CHUNK_DURATION_SECONDS;
    const overlapSamples = TARGET_SAMPLE_RATE * OVERLAP_DURATION_SECONDS;

    this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this.isRecordingState) return;

      const inputChannel = event.inputBuffer.getChannelData(0);

      // Update live microphone visualizer level
      if (this.onLevel) {
        const instantRms = this.calculateRMS(inputChannel);
        this.onLevel(Math.min(1, instantRms * 5));
      }

      // Downsample to 16kHz if the mobile hardware forced 44.1kHz or 48kHz
      const processedSamples =
        actualSampleRate === TARGET_SAMPLE_RATE
          ? inputChannel
          : this.downsampleBuffer(inputChannel, actualSampleRate, TARGET_SAMPLE_RATE);

      for (let i = 0; i < processedSamples.length; i++) {
        this.sampleBuffer.push(processedSamples[i]);
      }

      // Once we have 4 seconds of 16kHz audio, check for speech energy and flush
      if (this.sampleBuffer.length >= targetChunkSamples) {
        const chunkArray = new Float32Array(this.sampleBuffer.slice(0, targetChunkSamples));
        const chunkRms = this.calculateRMS(chunkArray);

        if (chunkRms >= SILENCE_RMS_THRESHOLD) {
          this.onChunk(chunkArray);
        }

        // Retain the last 0.5 seconds so words split across chunks remain intact
        this.sampleBuffer = this.sampleBuffer.slice(targetChunkSamples - overlapSamples);
      }
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
    this.isRecordingState = true;
  }

  public stop(): void {
    this.isRecordingState = false;

    // Flush any remaining spoken audio if it's at least 1 second long
    if (this.sampleBuffer.length >= TARGET_SAMPLE_RATE) {
      const remainingChunk = new Float32Array(this.sampleBuffer);
      if (this.calculateRMS(remainingChunk) >= SILENCE_RMS_THRESHOLD) {
        this.onChunk(remainingChunk);
      }
    }
    this.sampleBuffer = [];

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }

    if (this.onLevel) {
      this.onLevel(0);
    }
  }

  public isRecording(): boolean {
    return this.isRecordingState;
  }

  private calculateRMS(buffer: Float32Array): number {
    let sumSquares = 0;
    for (let i = 0; i < buffer.length; i++) {
      sumSquares += buffer[i] * buffer[i];
    }
    return Math.sqrt(sumSquares / buffer.length);
  }

  private downsampleBuffer(
    buffer: Float32Array,
    inputSampleRate: number,
    outputSampleRate: number
  ): Float32Array {
    if (outputSampleRate === inputSampleRate) {
      return buffer;
    }
    const sampleRateRatio = inputSampleRate / outputSampleRate;
    const newLength = Math.round(buffer.length / sampleRateRatio);
    const result = new Float32Array(newLength);

    let offsetResult = 0;
    let offsetBuffer = 0;

    while (offsetResult < result.length) {
      const nextOffsetBuffer = Math.round((offsetResult + 1) * sampleRateRatio);
      let accum = 0;
      let count = 0;
      for (let i = offsetBuffer; i < nextOffsetBuffer && i < buffer.length; i++) {
        accum += buffer[i];
        count++;
      }
      result[offsetResult] = count > 0 ? accum / count : 0;
      offsetResult++;
      offsetBuffer = nextOffsetBuffer;
    }

    return result;
  }
}