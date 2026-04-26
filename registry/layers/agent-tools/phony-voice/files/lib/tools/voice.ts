// Voice toolkit — STT / TTS / voice-cloning / voice RAG via @ph0ny/sdk.
// Only the public @ph0ny/sdk package is used; internal phony packages
// (@ph0ny/voice, @ph0ny/agents, @ph0ny/voice-widget) are NOT permitted
// in shipping bundles.

export interface SpeakOptions {
  text: string
  voiceId: string
  format?: 'mp3' | 'wav' | 'pcm16'
}

export interface TranscribeOptions {
  audio: Blob | ArrayBuffer | string
  language?: string
}

export async function speak(_opts: SpeakOptions): Promise<ArrayBuffer> {
  // Implementation imports @ph0ny/sdk at runtime: const { Phony } = await import('@ph0ny/sdk')
  // const phony = new Phony({ apiKey: process.env.PHONY_API_KEY })
  // return await phony.tts.synthesize(opts)
  throw new Error('speak: wire @ph0ny/sdk.tts.synthesize() here')
}

export async function transcribe(_opts: TranscribeOptions): Promise<{ text: string; language: string }> {
  throw new Error('transcribe: wire @ph0ny/sdk.stt.transcribe() here')
}

export interface CloneVoiceOptions {
  name: string
  samples: Array<Blob | ArrayBuffer>
  consentToken: string
}

export async function cloneVoice(_opts: CloneVoiceOptions): Promise<{ voiceId: string }> {
  // Voice cloning REQUIRES explicit consent — the consentToken must come
  // from a verified-consent flow upstream. Bundles never clone without it.
  throw new Error('cloneVoice: wire @ph0ny/sdk.voiceCloning.create() here, gated on consentToken')
}
