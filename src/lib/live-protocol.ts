// Browser side of the live-relay wire protocol (see live-relay/lib/protocol.mjs).
export const MEDIA_KIND = {
  VIDEO_MP4: 1,
  AUDIO_PCM: 2,
  OTHER: 3,
} as const;

export type RelayEvent =
  | { type: 'ready'; avatar: boolean; model: string; maxSeconds: number }
  | { type: 'mime'; kind: number; mimeType: string }
  | { type: 'inputTranscript'; text: string }
  | { type: 'outputTranscript'; text: string }
  | { type: 'interrupted' }
  | { type: 'turnComplete' }
  | { type: 'endSession'; reason: string }
  | { type: 'resuming' }
  | { type: 'resumed' }
  | { type: 'limit'; seconds: number }
  | { type: 'error'; message: string }
  | { type: 'closed'; reason: string; stats?: Record<string, unknown> };
