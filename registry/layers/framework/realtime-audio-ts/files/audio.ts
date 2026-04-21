// AudioGraph owns the AudioContext lifecycle. Construction is cheap
// (no stream attached yet); unlock() is the autoplay-policy dance that
// must run inside a user-gesture handler.

const FFT_SIZE = 1024; // power of 2, 32..32768; sets analyser.frequencyBinCount = 512

export class AudioGraph {
  readonly context: AudioContext;
  readonly analyser: AnalyserNode;
  private readonly gainNode: GainNode;
  private source: MediaStreamAudioSourceNode | null = null;
  private currentStream: MediaStream | null = null;

  constructor() {
    // Construct-but-don't-resume. AudioContext starts suspended in
    // Chrome/Safari until the user gesture handler calls resume().
    this.context = new AudioContext();
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = FFT_SIZE;
    this.analyser.smoothingTimeConstant = 0.8;
    this.gainNode = this.context.createGain();
    this.gainNode.gain.value = 1;
    this.gainNode.connect(this.analyser);
  }

  async unlock(): Promise<void> {
    // Critical: must be called from a user-gesture handler, otherwise
    // the AudioContext stays suspended and getByteFrequencyData returns
    // all zeros with NO error. This is the #1 "audio doesn't work"
    // gotcha in the browser audio stack.
    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  async resumeIfSuspended(): Promise<void> {
    // iOS Safari suspends the context on tab-background >30s. Call
    // from a visibilitychange listener to recover automatically.
    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch {
        // If we're outside a user gesture, resume will reject silently.
        // The next click on the Start button will unlock again.
      }
    }
  }

  attachStream(stream: MediaStream): void {
    this.detachCurrent();
    this.currentStream = stream;
    this.source = this.context.createMediaStreamSource(stream);
    this.source.connect(this.gainNode);
  }

  setGain(value: number): void {
    // Clamp defensively — negative values invert the signal and values
    // above ~3 clip on most playback chains.
    const clamped = Math.max(0, Math.min(value, 3));
    this.gainNode.gain.setTargetAtTime(clamped, this.context.currentTime, 0.01);
  }

  stop(): void {
    this.detachCurrent();
  }

  private detachCurrent(): void {
    this.source?.disconnect();
    this.source = null;
    if (this.currentStream) {
      for (const track of this.currentStream.getTracks()) track.stop();
      this.currentStream = null;
    }
  }
}
