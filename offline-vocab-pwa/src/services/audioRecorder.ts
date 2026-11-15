export type AudioChunkCallback = (pcmData: Float32Array) => void;
export type AudioLevelCallback = (rmsLevel: number) => void;
export type LiveSpeechCallback = (text: string, isFinal: boolean) => void;

const TARGET_SAMPLE_RATE = 16000;
const MIN_SPEECH_DURATION_SECONDS = 1.4;
const MAX_CHUNK_DURATION_SECONDS = 5.0;
const OVERLAP_DURATION_SECONDS = 0.35;
const SILENCE_RMS_THRESHOLD = 0.01;
const PAUSE_SILENCE_FRAMES = 2; // ~0.5s of silence triggers natural sentence cut

export class ContinuousAudioRecorder {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private recognition: any = null;
  private usingNativeSpeech = false;

  private sampleBuffer: number[] = [];
  private silenceFrameCount = 0;
  private hasSpokenInChunk = false;
  private isRecordingState = false;

  private onChunk: AudioChunkCallback;
  private onLevel?: AudioLevelCallback;
  private onLiveSpeech?: LiveSpeechCallback;

  constructor(
    onChunk: AudioChunkCallback,
    onLevel?: AudioLevelCallback,
    onLiveSpeech?: LiveSpeechCallback
  ) {
    this.onChunk = onChunk;
    this.onLevel = onLevel;
    this.onLiveSpeech = onLiveSpeech;
  }

  public async start(preferNativeFastSpeech = true): Promise<void> {
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

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.audioContext = new AudioCtx({ sampleRate: TARGET_SAMPLE_RATE });

    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    const actualSampleRate = this.audioContext.sampleRate;
    this.sourceNode = this.audioContext.createMediaStreamSource(this.stream);
    this.processorNode = this.audioContext.createScriptProcessor(4096, 1, 1);

    const minSpeechSamples = TARGET_SAMPLE_RATE * MIN_SPEECH_DURATION_SECONDS;
    const maxChunkSamples = TARGET_SAMPLE_RATE * MAX_CHUNK_DURATION_SECONDS;
    const overlapSamples = TARGET_SAMPLE_RATE * OVERLAP_DURATION_SECONDS;

    // Try starting fast native German SpeechRecognition (instant streaming feedback)
    if (preferNativeFastSpeech && this.onLiveSpeech) {
      this.startNativeSpeechRecognition();
    }

    this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
      if (!this.isRecordingState) return;

      const inputChannel = event.inputBuffer.getChannelData(0);
      const instantRms = this.calculateRMS(inputChannel);

      // Update live microphone visualizer level
      if (this.onLevel) {
        this.onLevel(Math.min(1, instantRms * 6));
      }

      // If native SpeechRecognition is actively handling live stream, skip queuing heavy Whisper chunks
      if (this.usingNativeSpeech) {
        return;
      }

      // Downsample to 16kHz if the hardware forced 44.1kHz or 48kHz
      const processedSamples =
        actualSampleRate === TARGET_SAMPLE_RATE
          ? inputChannel
          : this.downsampleBuffer(inputChannel, actualSampleRate, TARGET_SAMPLE_RATE);

      for (let i = 0; i < processedSamples.length; i++) {
        this.sampleBuffer.push(processedSamples[i]);
      }

      if (instantRms >= SILENCE_RMS_THRESHOLD) {
        this.hasSpokenInChunk = true;
        this.silenceFrameCount = 0;
      } else if (this.hasSpokenInChunk) {
        this.silenceFrameCount++;
      }

      // Flush on natural speech pause (VAD) after at least 1.4s of audio, or at max 5.0s
      const reachedNaturalPause =
        this.hasSpokenInChunk &&
        this.sampleBuffer.length >= minSpeechSamples &&
        this.silenceFrameCount >= PAUSE_SILENCE_FRAMES;

      const reachedMaxDuration = this.sampleBuffer.length >= maxChunkSamples;

      if (reachedNaturalPause || reachedMaxDuration) {
        const chunkArray = new Float32Array(this.sampleBuffer);
        const chunkRms = this.calculateRMS(chunkArray);

        if (this.hasSpokenInChunk && chunkRms >= SILENCE_RMS_THRESHOLD * 0.75) {
          this.onChunk(chunkArray);
        }

        // If cut at max duration mid-speech, retain a small overlap so words aren't lost
        this.sampleBuffer = reachedMaxDuration
          ? this.sampleBuffer.slice(Math.max(0, this.sampleBuffer.length - overlapSamples))
          : [];
        this.hasSpokenInChunk = false;
        this.silenceFrameCount = 0;
      } else if (!this.hasSpokenInChunk && this.sampleBuffer.length > TARGET_SAMPLE_RATE) {
        // Trim leading silence so buffer is always fresh when user starts speaking
        this.sampleBuffer = this.sampleBuffer.slice(-Math.round(TARGET_SAMPLE_RATE * 0.3));
      }
    };

    this.sourceNode.connect(this.processorNode);
    this.processorNode.connect(this.audioContext.destination);
    this.isRecordingState = true;
  }

  private startNativeSpeechRecognition(): void {
    const SpeechRec =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRec) {
      this.usingNativeSpeech = false;
      return;
    }

    try {
      const recognition = new SpeechRec();
      recognition.lang = 'de-DE';
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        this.usingNativeSpeech = true;
      };

      recognition.onresult = (event: any) => {
        if (!this.onLiveSpeech) return;
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0]?.transcript?.trim() || '';
          if (!transcript) continue;

          if (result.isFinal) {
            this.onLiveSpeech(transcript, true);
          } else {
            interimTranscript += (interimTranscript ? ' ' : '') + transcript;
          }
        }

        this.onLiveSpeech(interimTranscript, false);
      };

      recognition.onerror = (event: any) => {
        // If offline or unsupported in browser, gracefully fall back to Whisper WASM
        if (
          event.error === 'network' ||
          event.error === 'service-not-allowed' ||
          event.error === 'not-allowed'
        ) {
          this.usingNativeSpeech = false;
        }
      };

      recognition.onend = () => {
        // Auto-restart while recording if still using native speech
        if (this.isRecordingState && this.usingNativeSpeech) {
          try {
            recognition.start();
          } catch {
            this.usingNativeSpeech = false;
          }
        }
      };

      recognition.start();
      this.recognition = recognition;
      this.usingNativeSpeech = true;
    } catch {
      this.usingNativeSpeech = false;
    }
  }

  public stop(): void {
    this.isRecordingState = false;

    if (this.recognition) {
      try {
        this.recognition.onend = null;
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }

    // Flush any remaining spoken audio for Whisper mode if at least 0.8s long
    if (!this.usingNativeSpeech && this.hasSpokenInChunk && this.sampleBuffer.length >= TARGET_SAMPLE_RATE * 0.8) {
      const remainingChunk = new Float32Array(this.sampleBuffer);
      if (this.calculateRMS(remainingChunk) >= SILENCE_RMS_THRESHOLD * 0.75) {
        this.onChunk(remainingChunk);
      }
    }

    this.usingNativeSpeech = false;
    this.sampleBuffer = [];
    this.hasSpokenInChunk = false;
    this.silenceFrameCount = 0;

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
