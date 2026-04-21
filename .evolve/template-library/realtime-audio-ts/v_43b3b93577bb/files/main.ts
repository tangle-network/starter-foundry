// Glue: Start button unlocks the AudioContext (autoplay policy), grabs
// the mic stream, pipes it through the AudioGraph, attaches the
// visualizer, and hands the stream to the WebRTC peer harness.
//
// No bundler-level abstraction here on purpose — each module owns one
// concern and main.ts is the only place they meet.

import { AudioGraph } from "./audio";
import { Visualizer } from "./visualizer";
import { createPeer, type Peer } from "./peer";

const startButton = document.querySelector<HTMLButtonElement>("#start")!;
const stopButton = document.querySelector<HTMLButtonElement>("#stop")!;
const gainSlider = document.querySelector<HTMLInputElement>("#gain")!;
const statusEl = document.querySelector<HTMLSpanElement>("#status")!;
const canvas = document.querySelector<HTMLCanvasElement>("#visualizer")!;
const peerStatusEl = document.querySelector<HTMLParagraphElement>("#peer-status")!;
const remoteAudioEl = document.querySelector<HTMLAudioElement>("#remote-audio")!;

const graph = new AudioGraph();
const visualizer = new Visualizer(canvas);
let activePeer: Peer | null = null;

function setStatus(state: "idle" | "listening" | "error", label: string): void {
  statusEl.dataset.state = state;
  statusEl.textContent = label;
}

startButton.addEventListener("click", async () => {
  startButton.disabled = true;
  try {
    // Autoplay unlock — must be inside the user-gesture handler. Safari
    // and Chrome both refuse to run an AudioContext created outside of
    // one.
    await graph.unlock();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: false,
    });

    graph.attachStream(stream);
    visualizer.attach(graph.analyser);
    activePeer = createPeer({
      stream,
      onRemoteTrack: (_track, streams) => {
        // Wire the first remote stream to the <audio> element so incoming
        // peer audio plays back. MediaStream assignment is idempotent.
        const first = streams[0];
        if (first && remoteAudioEl.srcObject !== first) {
          remoteAudioEl.srcObject = first;
        }
      },
      onStateChange: (state) => {
        peerStatusEl.textContent = `Peer state: ${state}`;
      },
    });

    stopButton.disabled = false;
    setStatus("listening", "Listening");
  } catch (error) {
    setStatus("error", `Microphone denied: ${(error as Error).message}`);
    startButton.disabled = false;
  }
});

stopButton.addEventListener("click", () => {
  visualizer.detach();
  graph.stop();
  activePeer?.close();
  activePeer = null;
  stopButton.disabled = true;
  startButton.disabled = false;
  setStatus("idle", "Idle");
  peerStatusEl.textContent = "Peer closed.";
  remoteAudioEl.srcObject = null;
});

gainSlider.addEventListener("input", () => {
  graph.setGain(Number(gainSlider.value));
});

// Safari on iOS suspends the AudioContext when the page backgrounds.
// Resume on return or the meters stay frozen forever.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    graph.resumeIfSuspended();
  }
});
