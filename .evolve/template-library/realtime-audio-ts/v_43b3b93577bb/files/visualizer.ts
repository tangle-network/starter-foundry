// FFT bar visualizer. Draws one frame per RAF tick by reading
// AnalyserNode.getByteFrequencyData into a preallocated Uint8Array.
//
// Rule: never allocate inside the animation loop. Preallocate the
// buffer when attach() is called, and reuse it every frame — otherwise
// the GC jitters noticeably at 60fps.

export class Visualizer {
  private readonly ctx: CanvasRenderingContext2D;
  private analyser: AnalyserNode | null = null;
  private buffer: Uint8Array<ArrayBuffer> | null = null;
  private rafId: number | null = null;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("visualizer: canvas 2d context unavailable");
    this.ctx = ctx;
  }

  attach(analyser: AnalyserNode): void {
    this.detach();
    this.analyser = analyser;
    // frequencyBinCount is fftSize/2. Allocate ONCE here, reuse every
    // frame.
    this.buffer = new Uint8Array(analyser.frequencyBinCount);
    this.loop();
  }

  detach(): void {
    if (this.rafId !== null) cancelAnimationFrame(this.rafId);
    this.rafId = null;
    this.analyser = null;
    this.buffer = null;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  private loop = (): void => {
    if (!this.analyser || !this.buffer) return;
    this.analyser.getByteFrequencyData(this.buffer);

    const { width, height } = this.canvas;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, width, height);

    const bins = this.buffer.length;
    const barWidth = width / bins;
    for (let i = 0; i < bins; i += 1) {
      const magnitude = this.buffer[i]! / 255;
      const barHeight = magnitude * height;
      // Color ramps with frequency band so agents can see the FFT
      // working without guessing whether the canvas is frozen.
      const hue = Math.floor((i / bins) * 240);
      ctx.fillStyle = `hsl(${hue}, 70%, 55%)`;
      ctx.fillRect(i * barWidth, height - barHeight, Math.max(barWidth - 1, 1), barHeight);
    }

    this.rafId = requestAnimationFrame(this.loop);
  };
}
