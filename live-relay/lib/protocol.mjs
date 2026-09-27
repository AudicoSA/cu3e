// Wire protocol between the browser (AvatarTalk.tsx) and this relay.
//
// Browser -> relay
//   text  {type:'start', ticket}          first message, required
//   binary                                 raw PCM16 LE mono @ 16 kHz mic audio
//   text  {type:'video', data}             base64 JPEG camera frame
//   text  {type:'text', text}              typed input (debug / accessibility)
//   text  {type:'audioStreamEnd'}          mic paused/muted
//   text  {type:'stop'}                    child ended the call
//
// Relay -> browser
//   binary [kind:uint8][payload bytes]     model media (see MEDIA_KIND)
//   text   {type:'mime', kind, mimeType}   announced before the first frame of each kind
//   text   {type:'ready', avatar, model, maxSeconds}
//   text   {type:'inputTranscript', text}  what the child said (chunks)
//   text   {type:'outputTranscript', text} what Echo said (chunks)
//   text   {type:'interrupted'}            child barged in: flush playback
//   text   {type:'turnComplete'}
//   text   {type:'endSession', reason}     Echo called end_session
//   text   {type:'resuming'} / {type:'resumed'}
//   text   {type:'limit', seconds}         session cap reached, relay will close
//   text   {type:'error', message}
//   text   {type:'closed', reason, stats}

// Mirrored in src/lib/live-protocol.ts; keep the two in sync.
export const MEDIA_KIND = {
  VIDEO_MP4: 1, // fragmented MP4 (H.264 + AAC) from Live Avatar
  AUDIO_PCM: 2, // raw PCM16 (24 kHz) when no avatar video is produced
  OTHER: 3,
};

export function kindForMime(mimeType = '') {
  const m = mimeType.toLowerCase();
  if (m.startsWith('video/mp4') || m.startsWith('video/')) return MEDIA_KIND.VIDEO_MP4;
  if (m.startsWith('audio/pcm') || m.startsWith('audio/l16')) return MEDIA_KIND.AUDIO_PCM;
  return MEDIA_KIND.OTHER;
}

export function frame(kind, bytes) {
  const out = Buffer.allocUnsafe(bytes.length + 1);
  out[0] = kind;
  bytes.copy(out, 1);
  return out;
}
