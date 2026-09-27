// One Bridge per browser connection: owns the Gemini Live session, pipes
// media both ways, runs tools, handles GoAway / resumption, and enforces the
// per-session time cap.
import { MODEL, avatarConfig, buildConfig, describeMessage, speechCodeFor } from './gemini.mjs';
import { MEDIA_KIND, frame, kindForMime } from './protocol.mjs';

const DEBUG = process.env.RELAY_DEBUG === 'true';
const LOG_FIRST_N = Number(process.env.RELAY_LOG_FIRST_N || 40);
const MAX_RESUME_ATTEMPTS = 2;

export class Bridge {
  constructor({ ws, ai, ticket, log }) {
    this.ws = ws;
    this.ai = ai;
    this.ticket = ticket;
    this.log = log;
    this.session = null;
    this.resumeHandle = null;
    this.resumeAttempts = 0;
    this.closing = false;
    this.swapping = false;
    this.announced = new Set();
    this.msgCount = 0;
    this.startedAt = Date.now();
    this.stats = {
      videoBytes: 0,
      audioBytes: 0,
      micBytes: 0,
      cameraFrames: 0,
      resumptions: 0,
      firstMediaMs: null,
      usage: null,
    };
    const capMin = Number(ticket.maxMinutes || process.env.MAX_SESSION_MINUTES || 15);
    this.maxSeconds = Math.max(1, Math.round(capMin * 60));
  }

  async start() {
    this.session = await this.connect(null);
    this.capTimer = setTimeout(() => {
      this.send({ type: 'limit', seconds: this.maxSeconds });
      this.close('time-limit');
    }, this.maxSeconds * 1000);
  }

  async connect(handle) {
    const config = buildConfig({
      prompt: this.ticket.prompt,
      resumeHandle: handle,
      languageCode: speechCodeFor(this.ticket.lang),
    });
    const t0 = Date.now();
    // Callbacks can fire before connect() resolves, so they read the session
    // through a holder instead of the (not yet assigned) return value.
    const ref = { s: null };
    const session = await this.ai.live.connect({
      model: MODEL,
      config,
      callbacks: {
        onmessage: (msg) => this.onGemini(ref.s, msg),
        onerror: (e) => {
          this.log('gemini error', e?.message ?? String(e));
          if (!ref.s || this.session === ref.s) this.send({ type: 'error', message: e?.message ?? 'gemini error' });
        },
        onclose: (e) => this.onGeminiClose(ref.s, e),
      },
    });
    ref.s = session;
    this.log(`connected ${MODEL} in ${Date.now() - t0}ms${handle ? ' (resumed)' : ''}`);
    return session;
  }

  // ---- Browser -> Gemini --------------------------------------------------

  onClientBinary(buf) {
    if (!this.session) return;
    this.stats.micBytes += buf.length;
    this.session.sendRealtimeInput({
      audio: { data: buf.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
    });
  }

  onClientJson(msg) {
    if (msg.type === 'stop') return this.close('client-stop');
    if (!this.session) return;
    switch (msg.type) {
      case 'video':
        if (typeof msg.data === 'string' && msg.data.length < 2_000_000) {
          this.stats.cameraFrames++;
          this.session.sendRealtimeInput({ video: { data: msg.data, mimeType: 'image/jpeg' } });
        }
        break;
      case 'text':
        if (typeof msg.text === 'string' && msg.text.trim()) {
          this.session.sendRealtimeInput({ text: msg.text.slice(0, 2000) });
        }
        break;
      case 'audioStreamEnd':
        this.session.sendRealtimeInput({ audioStreamEnd: true });
        break;
      default:
        break;
    }
  }

  // ---- Gemini -> Browser --------------------------------------------------

  onGemini(session, msg) {
    // `session` is undefined for messages that arrive before connect() resolves
    // (setupComplete usually does). Treat those as coming from the newest session.
    this.msgCount++;
    if (DEBUG || this.msgCount <= LOG_FIRST_N) this.log(`← ${describeMessage(msg)}`);

    if (msg.setupComplete && !this.swapping) {
      this.send({ type: 'ready', avatar: !!avatarConfig(), model: MODEL, maxSeconds: this.maxSeconds });
    }

    const sc = msg.serverContent;
    if (sc) {
      for (const part of sc.modelTurn?.parts ?? []) {
        const inline = part.inlineData;
        if (!inline?.data) continue;
        const kind = kindForMime(inline.mimeType);
        if (!this.announced.has(kind)) {
          this.announced.add(kind);
          this.send({ type: 'mime', kind, mimeType: inline.mimeType });
          this.log(`first media kind=${kind} mime=${inline.mimeType}`);
        }
        const bytes = Buffer.from(inline.data, 'base64');
        if (this.stats.firstMediaMs === null) this.stats.firstMediaMs = Date.now() - this.startedAt;
        if (kind === MEDIA_KIND.VIDEO_MP4) this.stats.videoBytes += bytes.length;
        else if (kind === MEDIA_KIND.AUDIO_PCM) this.stats.audioBytes += bytes.length;
        this.sendBinary(frame(kind, bytes));
      }
      if (sc.inputTranscription?.text) this.send({ type: 'inputTranscript', text: sc.inputTranscription.text });
      if (sc.outputTranscription?.text) this.send({ type: 'outputTranscript', text: sc.outputTranscription.text });
      if (sc.interrupted) this.send({ type: 'interrupted' });
      if (sc.turnComplete) this.send({ type: 'turnComplete' });
    }

    if (msg.toolCall?.functionCalls?.length) this.onToolCalls(msg.toolCall.functionCalls);

    if (msg.sessionResumptionUpdate?.resumable && msg.sessionResumptionUpdate.newHandle) {
      this.resumeHandle = msg.sessionResumptionUpdate.newHandle;
    }

    if (msg.usageMetadata) this.stats.usage = msg.usageMetadata;

    if (msg.goAway) {
      this.log(`goAway (timeLeft=${msg.goAway.timeLeft}) — resuming`);
      void this.resume();
    }
  }

  onToolCalls(calls) {
    const responses = [];
    for (const call of calls) {
      if (call.name === 'end_session') {
        const reason = call.args?.reason ?? 'goodbye';
        this.send({ type: 'endSession', reason });
        responses.push({ id: call.id, name: call.name, response: { ok: true } });
      } else {
        responses.push({ id: call.id, name: call.name, response: { error: `unknown tool ${call.name}` } });
      }
    }
    try {
      this.session?.sendToolResponse({ functionResponses: responses });
    } catch (e) {
      this.log('tool response failed', e?.message);
    }
  }

  async resume() {
    if (this.swapping || this.closing) return;
    if (!this.resumeHandle || this.resumeAttempts >= MAX_RESUME_ATTEMPTS) {
      this.log('cannot resume (no handle or too many attempts)');
      return this.close('connection-lost');
    }
    this.swapping = true;
    this.resumeAttempts++;
    this.stats.resumptions++;
    this.send({ type: 'resuming' });
    const old = this.session;
    try {
      const next = await this.connect(this.resumeHandle);
      this.session = next;
      this.resumeAttempts = 0;
      this.send({ type: 'resumed' });
      try { old?.close(); } catch { /* already closed */ }
    } catch (e) {
      this.log('resume failed', e?.message);
      this.close('resume-failed');
    } finally {
      this.swapping = false;
    }
  }

  onGeminiClose(session, e) {
    this.log(`gemini closed code=${e?.code} reason=${e?.reason ?? ''}`);
    if (e?.reason) this.lastGeminiClose = `${e.code ?? ''} ${e.reason}`.trim();
    if (this.closing) return;
    // An old session closing after a successful swap is expected.
    if (session && this.session && session !== this.session) return;
    if (this.swapping) return;
    void this.resume();
  }

  // ---- Plumbing -----------------------------------------------------------

  send(obj) {
    if (this.ws.readyState === 1) this.ws.send(JSON.stringify(obj));
  }

  sendBinary(buf) {
    if (this.ws.readyState === 1) this.ws.send(buf, { binary: true });
  }

  close(reason) {
    if (this.closing) return;
    this.closing = true;
    clearTimeout(this.capTimer);
    const seconds = Math.round((Date.now() - this.startedAt) / 1000);
    const stats = { ...this.stats, seconds, geminiClose: this.lastGeminiClose ?? null };
    this.log(`closing (${reason}) ${JSON.stringify(stats)}`);
    this.send({ type: 'closed', reason, stats });
    try { this.session?.close(); } catch { /* ignore */ }
    try { this.ws.close(1000, reason.slice(0, 100)); } catch { /* ignore */ }
  }
}
