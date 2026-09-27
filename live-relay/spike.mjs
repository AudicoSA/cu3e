// Phase 1 spike: talk to gemini-3.8-live with an avatar, no app, no browser.
//
//   npm run spike                      # uses .env
//   npm run spike -- "Say hi in Afrikaans"
//
// Writes everything the model sends to ./out:
//   out/avatar.mp4     concatenated fMP4 fragments (open it in VLC / Chrome)
//   out/audio.pcm      raw PCM if the model sent audio instead of video
//                      (play: ffplay -f s16le -ar 24000 -ac 1 out/audio.pcm)
//   out/messages.log   one line per server message (shape, sizes, timings)
// and prints time-to-first-media, bytes, bitrate and token usage.
import { mkdirSync, createWriteStream, writeFileSync } from 'node:fs';
import { createClient, MODEL, buildConfig, describeMessage, avatarConfig } from './lib/gemini.mjs';
import { MEDIA_KIND, kindForMime } from './lib/protocol.mjs';

const prompt =
  process.argv.slice(2).join(' ') ||
  'Hi Echo! Please introduce yourself in two short, friendly sentences for a 9-year-old, then ask me one question.';

mkdirSync('out', { recursive: true });
const video = createWriteStream('out/avatar.mp4');
const audio = createWriteStream('out/audio.pcm');
const lines = [];
const stats = { videoBytes: 0, audioBytes: 0, otherMimes: new Set(), firstMediaMs: null, usage: null, transcript: '' };

const ai = createClient();
const t0 = Date.now();
const ms = () => `${String(Date.now() - t0).padStart(6)}ms`;
let done;
const finished = new Promise((r) => (done = r));

console.log(`model=${MODEL} avatar=${JSON.stringify(avatarConfig() ? { ...avatarConfig(), customizedAvatar: avatarConfig().customizedAvatar ? '[image]' : undefined } : null)}`);

const session = await ai.live.connect({
  model: MODEL,
  config: buildConfig({
    prompt:
      'You are Echo, a warm, playful AI tutor owl for South African kids. Keep replies to two short sentences.',
  }),
  callbacks: {
    onmessage: (msg) => {
      const line = `${ms()}  ${describeMessage(msg)}`;
      lines.push(line);
      console.log(line);
      for (const p of msg.serverContent?.modelTurn?.parts ?? []) {
        const inline = p.inlineData;
        if (!inline?.data) continue;
        const bytes = Buffer.from(inline.data, 'base64');
        if (stats.firstMediaMs === null) stats.firstMediaMs = Date.now() - t0;
        const kind = kindForMime(inline.mimeType);
        if (kind === MEDIA_KIND.VIDEO_MP4) { video.write(bytes); stats.videoBytes += bytes.length; }
        else if (kind === MEDIA_KIND.AUDIO_PCM) { audio.write(bytes); stats.audioBytes += bytes.length; }
        else stats.otherMimes.add(inline.mimeType);
      }
      if (msg.serverContent?.outputTranscription?.text) stats.transcript += msg.serverContent.outputTranscription.text;
      if (msg.usageMetadata) stats.usage = msg.usageMetadata;
      if (msg.serverContent?.turnComplete) done();
    },
    onerror: (e) => { console.error('error', e?.message ?? e); done(); },
    onclose: (e) => { console.log(`${ms()}  closed code=${e?.code} reason=${e?.reason ?? ''}`); done(); },
  },
});

console.log(`${ms()}  connected; sending prompt: "${prompt}"`);
const sentAt = Date.now();
session.sendRealtimeInput({ text: prompt });

await Promise.race([finished, new Promise((r) => setTimeout(r, 60_000))]);
const turnSec = (Date.now() - sentAt) / 1000;
session.close();
video.end();
audio.end();
writeFileSync('out/messages.log', lines.join('\n') + '\n');

console.log('\n==== spike result ====');
console.log(`time to first media : ${stats.firstMediaMs ?? '-'} ms (from connect start)`);
console.log(`turn duration       : ${turnSec.toFixed(1)} s`);
console.log(`video bytes         : ${stats.videoBytes} (~${Math.round((stats.videoBytes * 8) / 1000 / Math.max(turnSec, 1))} kbps avg over turn)`);
console.log(`audio bytes         : ${stats.audioBytes}`);
if (stats.otherMimes.size) console.log(`other mime types    : ${[...stats.otherMimes].join(', ')}`);
console.log(`transcript          : ${stats.transcript.trim() || '-'}`);
console.log(`usage               : ${JSON.stringify(stats.usage)}`);
console.log('files               : out/avatar.mp4, out/audio.pcm, out/messages.log');
process.exit(0);
