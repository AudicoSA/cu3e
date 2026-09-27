import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signTicket, verifyTicket } from '../lib/ticket.mjs';
import { Bridge } from '../lib/bridge.mjs';
import { MEDIA_KIND } from '../lib/protocol.mjs';

const SECRET = 'test-secret-0123456789abcdef';

test('ticket round-trips and rejects tampering / expiry', () => {
  const t = signTicket({ childId: 'c1', prompt: 'hi', exp: Date.now() + 60_000 }, SECRET);
  assert.equal(verifyTicket(t, SECRET).childId, 'c1');
  const [body, sig] = t.split('.');
  const forged = Buffer.from(JSON.stringify({ childId: 'c2', prompt: 'evil', exp: Date.now() + 60_000 })).toString('base64url');
  assert.throws(() => verifyTicket(`${forged}.${sig}`, SECRET), /signature/);
  assert.throws(() => verifyTicket(`${body}.${sig}`, 'other-secret-xxxxxxxx'), /signature/);
  const old = signTicket({ childId: 'c1', prompt: 'hi', exp: Date.now() - 1 }, SECRET);
  assert.throws(() => verifyTicket(old, SECRET), /expired/);
});

// Fake Gemini Live SDK: records what the bridge sends and lets the test push
// server messages.
function fakeAi() {
  const sessions = [];
  return {
    sessions,
    live: {
      async connect({ config, callbacks }) {
        const s = {
          config, callbacks, sent: [], toolResponses: [], closed: false,
          sendRealtimeInput(x) { this.sent.push(x); },
          sendToolResponse(x) { this.toolResponses.push(x); },
          close() { this.closed = true; },
        };
        sessions.push(s);
        callbacks.onmessage({ setupComplete: {} });
        return s;
      },
    },
  };
}

function fakeWs() {
  return {
    readyState: 1, json: [], bin: [], closed: null,
    send(data, opts) { if (opts?.binary) this.bin.push(data); else this.json.push(JSON.parse(data)); },
    close(code, reason) { this.closed = { code, reason }; this.readyState = 3; },
  };
}

test('bridge pipes media, transcripts, tools and resumes on goAway', async () => {
  process.env.AVATAR_NAME = 'Kai';
  const ai = fakeAi();
  const ws = fakeWs();
  const b = new Bridge({ ws, ai, ticket: { prompt: 'You are Echo', lang: 'af', maxMinutes: 1 }, log: () => {} });
  await b.start();
  const s1 = ai.sessions[0];

  assert.equal(s1.config.avatarConfig.avatarName, 'Kai');
  assert.equal(s1.config.systemInstruction.parts[0].text, 'You are Echo');
  assert.ok(ws.json.find((m) => m.type === 'ready' && m.avatar === true));

  // mic audio in
  b.onClientBinary(Buffer.from([1, 2, 3, 4]));
  assert.equal(s1.sent[0].audio.mimeType, 'audio/pcm;rate=16000');
  // camera frame in
  b.onClientJson({ type: 'video', data: 'AAAA' });
  assert.equal(s1.sent[1].video.mimeType, 'image/jpeg');

  // avatar video + transcript out
  s1.callbacks.onmessage({
    serverContent: {
      modelTurn: { parts: [{ inlineData: { mimeType: 'video/mp4', data: Buffer.from('frag').toString('base64') } }] },
      outputTranscription: { text: 'Hallo!' },
    },
  });
  assert.deepEqual(ws.json.find((m) => m.type === 'mime'), { type: 'mime', kind: MEDIA_KIND.VIDEO_MP4, mimeType: 'video/mp4' });
  assert.equal(ws.bin[0][0], MEDIA_KIND.VIDEO_MP4);
  assert.equal(ws.bin[0].subarray(1).toString(), 'frag');
  assert.ok(ws.json.find((m) => m.type === 'outputTranscript' && m.text === 'Hallo!'));

  // end_session tool
  s1.callbacks.onmessage({ toolCall: { functionCalls: [{ id: 't1', name: 'end_session', args: { reason: 'sleepy' } }] } });
  assert.ok(ws.json.find((m) => m.type === 'endSession' && m.reason === 'sleepy'));
  assert.equal(s1.toolResponses[0].functionResponses[0].id, 't1');

  // goAway -> resume with latest handle
  s1.callbacks.onmessage({ sessionResumptionUpdate: { resumable: true, newHandle: 'H1' } });
  s1.callbacks.onmessage({ goAway: { timeLeft: '5s' } });
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(ai.sessions.length, 2);
  assert.equal(ai.sessions[1].config.sessionResumption.handle, 'H1');
  assert.ok(s1.closed);
  assert.ok(ws.json.find((m) => m.type === 'resumed'));
  // audio now goes to the new session
  b.onClientBinary(Buffer.from([5, 6]));
  assert.equal(ai.sessions[1].sent.length, 1);

  b.onClientJson({ type: 'stop' });
  assert.equal(ws.json.at(-1).type, 'closed');
  assert.equal(ws.closed.code, 1000);
});
