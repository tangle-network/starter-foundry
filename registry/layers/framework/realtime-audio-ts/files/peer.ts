// Minimal WebRTC peer scaffold for realtime audio. Wires an RTCPeerConnection
// with a placeholder signalling layer the product replaces with its own
// transport (WebSocket, Socket.IO, Supabase realtime, etc).

export interface PeerOptions {
  stream: MediaStream
  iceServers?: RTCIceServer[]
  onRemoteTrack?: (track: MediaStreamTrack, streams: ReadonlyArray<MediaStream>) => void
  onStateChange?: (state: RTCPeerConnectionState) => void
}

export interface Peer {
  pc: RTCPeerConnection
  createOffer: () => Promise<RTCSessionDescriptionInit>
  acceptAnswer: (answer: RTCSessionDescriptionInit) => Promise<void>
  acceptOffer: (offer: RTCSessionDescriptionInit) => Promise<RTCSessionDescriptionInit>
  close: () => void
}

export function createPeer(opts: PeerOptions): Peer {
  const pc = new RTCPeerConnection({
    iceServers: opts.iceServers ?? [{ urls: 'stun:stun.l.google.com:19302' }],
  })

  // ICE candidates need to go over the SIGNALLING channel — the product
  // attaches a handler on pc.onicecandidate and forwards to the peer.
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      // SIGNALLING TODO: send event.candidate.toJSON() to the remote peer.
    }
  }

  pc.ontrack = (event) => {
    if (opts.onRemoteTrack) opts.onRemoteTrack(event.track, event.streams)
  }

  pc.onconnectionstatechange = () => {
    if (opts.onStateChange) opts.onStateChange(pc.connectionState)
  }

  // addTrack MUST happen BEFORE createOffer, otherwise the offer's SDP
  // is missing the audio m-line and the remote peer has nothing to answer.
  for (const track of opts.stream.getTracks()) {
    pc.addTrack(track, opts.stream)
  }

  return {
    pc,
    async createOffer() {
      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      return offer
    },
    async acceptAnswer(answer) {
      await pc.setRemoteDescription(answer)
    },
    async acceptOffer(offer) {
      await pc.setRemoteDescription(offer)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      return answer
    },
    close() {
      pc.getSenders().forEach((s) => s.track?.stop())
      pc.close()
    },
  }
}
