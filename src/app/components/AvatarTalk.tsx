"use client";

// Face-to-Face with Echo — Gemini 3.8 Live + Live Avatar.
//
// Sibling of VoiceTalk (ElevenLabs). Same overlay shape, same transcript →
// /api/voice-save → /api/grade-session pipeline, same 45s auto-sleep — but
// the "brain", voice and face all come from one Gemini Live session, reached
// through the cu3e live relay (live-relay/). Media path:
//
//   mic → AudioWorklet (PCM16 @ 16 kHz) → relay → Gemini
//   Gemini → relay → fMP4 (H.264 + AAC) → MediaSource → <video>
//                  → or raw PCM @ 24 kHz → Web Audio (voice-only fallback)
//   camera (optional "Homework lens") → 1 JPEG/sec → relay → Gemini

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { MEDIA_KIND, type RelayEvent } from "@/lib/live-protocol";

type Props = {
  open: boolean;
  onClose: () => void;
  childId: string | null;
  mode?: string;
};

type Turn = { role: "user" | "assistant"; content: string };

const SILENCE_MS = 45_000;
const SLEEP_CLOSE_DELAY_MS = 3_500;
const CAMERA_FPS = 1;
const CAMERA_MAX_EDGE = 640;

export default function AvatarTalk({ open, onClose, childId, mode }: Props) {
  if (!open) return null;
  return <Overlay onClose={onClose} childId={childId} mode={mode} />;
}

// Feature detection used by study-hub to decide whether to offer the button.
export function avatarSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!process.env.NEXT_PUBLIC_LIVE_RELAY_URL) return false;
  const w = window as unknown as { ManagedMediaSource?: unknown; MediaSource?: unknown };
  return !!(w.ManagedMediaSource || w.MediaSource) && !!navigator.mediaDevices?.getUserMedia;
}

// ---------------------------------------------------------------------------
// Mic capture worklet: downmix → Int16 → ~40 ms chunks posted to main thread.
// AudioContext is created at 16 kHz so the browser does the resampling.
const MIC_WORKLET = `
class PcmCapture extends AudioWorkletProcessor {
  constructor() { super(); this.buf = new Int16Array(640); this.n = 0; }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0];
    if (!ch) return true;
    for (let i = 0; i < ch.length; i++) {
      const s = Math.max(-1, Math.min(1, ch[i]));
      this.buf[this.n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
      if (this.n === this.buf.length) {
        this.port.postMessage(this.buf.buffer.slice(0));
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor('pcm-capture', PcmCapture);
`;

// ---------------------------------------------------------------------------
// fMP4 player on MediaSource / ManagedMediaSource (iPadOS 17+).
class FragmentPlayer {
  private ms: MediaSource | null = null;
  private sb: SourceBuffer | null = null;
  private queue: ArrayBuffer[] = [];
  private objectUrl: string | null = null;
  private ready: Promise<void>;
  private markReady!: () => void;
  onStalled?: () => void;
  onUnsupported?: (mime: string) => void;

  constructor(private video: HTMLVideoElement, mimeHint: string) {
    this.ready = new Promise((r) => (this.markReady = r));
    const w = window as unknown as { ManagedMediaSource?: typeof MediaSource };
    const MS = w.ManagedMediaSource ?? window.MediaSource;
    const ms = new MS();
    this.ms = ms;
    if (w.ManagedMediaSource) {
      // Required for ManagedMediaSource to be used on iOS/iPadOS.
      (video as HTMLVideoElement & { disableRemotePlayback: boolean }).disableRemotePlayback = true;
      this.video.srcObject = ms as unknown as MediaProvider;
    } else {
      this.objectUrl = URL.createObjectURL(ms);
      this.video.src = this.objectUrl;
    }
    ms.addEventListener("sourceopen", () => {
      const type = pickMime(MS, mimeHint);
      if (!type) {
        this.onUnsupported?.(mimeHint);
        return;
      }
      try {
        const sb = ms.addSourceBuffer(type);
        // Turns may restart timestamps; "sequence" plays fragments back to back.
        sb.mode = "sequence";
        sb.addEventListener("updateend", () => this.pump());
        this.sb = sb;
        this.markReady();
        this.pump();
      } catch (e) {
        console.error("[avatar] addSourceBuffer failed", type, e);
        this.onUnsupported?.(type);
      }
    });
  }

  async append(buf: ArrayBuffer) {
    this.queue.push(buf);
    await this.ready;
    this.pump();
  }

  private pump() {
    const sb = this.sb;
    if (!sb || sb.updating || this.queue.length === 0) return;
    try {
      // Keep memory bounded: drop what's already been played.
      const t = this.video.currentTime;
      if (sb.buffered.length && t - sb.buffered.start(0) > 30) {
        sb.remove(sb.buffered.start(0), t - 10);
        return;
      }
      sb.appendBuffer(this.queue.shift()!);
      this.chaseLiveEdge();
    } catch (e) {
      console.warn("[avatar] append failed", e);
    }
  }

  // If we've fallen behind (tab was busy), jump near the newest frame so Echo
  // doesn't lag the conversation.
  private chaseLiveEdge() {
    const b = this.video.buffered;
    if (!b.length) return;
    const end = b.end(b.length - 1);
    if (end - this.video.currentTime > 1.5) this.video.currentTime = Math.max(0, end - 0.3);
    if (this.video.paused) {
      this.video.play().catch(() => this.onStalled?.());
    }
  }

  // Barge-in: drop everything not yet played.
  flush() {
    this.queue = [];
    const sb = this.sb;
    if (!sb || !this.ms || this.ms.readyState !== "open") return;
    try {
      if (sb.updating) sb.abort();
      const t = this.video.currentTime;
      const b = sb.buffered;
      if (b.length && b.end(b.length - 1) > t + 0.05) sb.remove(t + 0.05, Infinity);
    } catch {
      /* best effort */
    }
  }

  destroy() {
    this.queue = [];
    try {
      if (this.ms?.readyState === "open") this.ms.endOfStream();
    } catch {
      /* ignore */
    }
    this.video.removeAttribute("src");
    this.video.srcObject = null;
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
  }
}

function pickMime(MS: typeof MediaSource, hint: string): string | null {
  const candidates = [
    hint.includes("codecs") ? hint : "",
    'video/mp4; codecs="avc1.42E01E, mp4a.40.2"',
    'video/mp4; codecs="avc1.4D401F, mp4a.40.2"',
    'video/mp4; codecs="avc1.64001F, mp4a.40.2"',
    'video/mp4; codecs="avc1.42E01E"',
  ].filter(Boolean);
  return candidates.find((c) => MS.isTypeSupported(c)) ?? null;
}

// ---------------------------------------------------------------------------
// Voice-only fallback: schedule raw PCM16 chunks on a Web Audio timeline.
class PcmPlayer {
  private ctx: AudioContext;
  private at = 0;
  private sources = new Set<AudioBufferSourceNode>();
  constructor(private rate = 24000) {
    this.ctx = new AudioContext({ sampleRate: rate });
  }
  setRate(mime: string) {
    const m = /rate=(\d+)/.exec(mime);
    if (m && Number(m[1]) !== this.rate) {
      void this.ctx.close();
      this.rate = Number(m[1]);
      this.ctx = new AudioContext({ sampleRate: this.rate });
      this.at = 0;
    }
  }
  play(buf: ArrayBuffer) {
    const pcm = new Int16Array(buf);
    const f = new Float32Array(pcm.length);
    for (let i = 0; i < pcm.length; i++) f[i] = pcm[i] / 0x8000;
    const ab = this.ctx.createBuffer(1, f.length, this.rate);
    ab.copyToChannel(f, 0);
    const src = this.ctx.createBufferSource();
    src.buffer = ab;
    src.connect(this.ctx.destination);
    const start = Math.max(this.ctx.currentTime + 0.02, this.at);
    src.start(start);
    this.at = start + ab.duration;
    this.sources.add(src);
    src.onended = () => this.sources.delete(src);
  }
  get speaking() {
    return this.at > this.ctx.currentTime;
  }
  flush() {
    for (const s of this.sources) {
      try {
        s.stop();
      } catch {
        /* ignore */
      }
    }
    this.sources.clear();
    this.at = 0;
  }
  resume() {
    return this.ctx.resume();
  }
  destroy() {
    this.flush();
    void this.ctx.close();
  }
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

// ---------------------------------------------------------------------------

type Phase = "connecting" | "live" | "resuming" | "error" | "ended";

function Overlay({ onClose, childId, mode }: { onClose: () => void; childId: string | null; mode?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const camTimerRef = useRef<number | null>(null);
  const playerRef = useRef<FragmentPlayer | null>(null);
  const pcmRef = useRef<PcmPlayer | null>(null);
  const mimeByKind = useRef<Record<number, string>>({});
  const turnsRef = useRef<Turn[]>([]);
  const userBufRef = useRef("");
  const echoBufRef = useRef("");
  const lastActivityRef = useRef(0);
  const lastMediaRef = useRef(0);
  const mutedRef = useRef(false);
  const closingRef = useRef(false);
  const sleepTimerRef = useRef<number | null>(null);
  const conversationIdRef = useRef<string>(crypto.randomUUID());

  const [phase, setPhase] = useState<Phase>("connecting");
  const [error, setError] = useState<string | null>(null);
  const [hasVideo, setHasVideo] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [caption, setCaption] = useState("");
  const [muted, setMuted] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);

  // ---- transcript bookkeeping (same shape VoiceTalk saves) ----------------
  const commitUser = useCallback(() => {
    const t = userBufRef.current.trim();
    if (t) turnsRef.current.push({ role: "user", content: t });
    userBufRef.current = "";
  }, []);
  const commitEcho = useCallback(() => {
    const t = echoBufRef.current.trim();
    if (t) turnsRef.current.push({ role: "assistant", content: t });
    echoBufRef.current = "";
  }, []);

  const flushTranscript = useCallback(async () => {
    commitUser();
    commitEcho();
    const turns = turnsRef.current;
    turnsRef.current = [];
    if (turns.length === 0 || !childId) return;
    let savedId: string | null = null;
    try {
      const r = await fetch("/api/voice-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, conversationId: conversationIdRef.current, turns }),
      });
      if (r.ok) {
        const b = (await r.json().catch(() => ({}))) as { conversationId?: string };
        savedId = b.conversationId ?? conversationIdRef.current;
      }
    } catch (e) {
      console.warn("[avatar] save transcript failed", e);
    }
    if (savedId && turns.filter((t) => t.content.length > 4).length >= 3) {
      void fetch("/api/grade-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: savedId }),
      }).catch(() => {});
    }
  }, [childId, commitEcho, commitUser]);

  // ---- teardown -----------------------------------------------------------
  const stopCamera = useCallback(() => {
    if (camTimerRef.current !== null) window.clearInterval(camTimerRef.current);
    camTimerRef.current = null;
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    setCameraOn(false);
  }, []);

  const teardown = useCallback(() => {
    stopCamera();
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    void micCtxRef.current?.close().catch(() => {});
    micCtxRef.current = null;
    playerRef.current?.destroy();
    playerRef.current = null;
    pcmRef.current?.destroy();
    pcmRef.current = null;
    const ws = wsRef.current;
    wsRef.current = null;
    if (ws && ws.readyState <= 1) {
      try {
        ws.send(JSON.stringify({ type: "stop" }));
      } catch {
        /* ignore */
      }
      ws.close();
    }
  }, [stopCamera]);

  const handleClose = useCallback(async () => {
    if (closingRef.current) return;
    closingRef.current = true;
    if (sleepTimerRef.current !== null) window.clearTimeout(sleepTimerRef.current);
    teardown();
    await flushTranscript();
    onClose();
  }, [flushTranscript, onClose, teardown]);

  const handleCloseRef = useRef(handleClose);
  useEffect(() => {
    handleCloseRef.current = handleClose;
  }, [handleClose]);

  // ---- relay events -------------------------------------------------------
  const onEvent = useCallback(
    (ev: RelayEvent) => {
      switch (ev.type) {
        case "ready":
          setPhase("live");
          lastActivityRef.current = Date.now();
          break;
        case "mime":
          mimeByKind.current[ev.kind] = ev.mimeType;
          if (ev.kind === MEDIA_KIND.AUDIO_PCM) pcmRef.current?.setRate(ev.mimeType);
          break;
        case "inputTranscript":
          // Child is talking: close off Echo's previous turn first.
          if (echoBufRef.current) commitEcho();
          userBufRef.current += ev.text;
          lastActivityRef.current = Date.now();
          break;
        case "outputTranscript":
          if (userBufRef.current) commitUser();
          echoBufRef.current += ev.text;
          setCaption(echoBufRef.current.trim().split(/(?<=[.!?])\s+/).slice(-2).join(" "));
          lastActivityRef.current = Date.now();
          break;
        case "interrupted":
          playerRef.current?.flush();
          pcmRef.current?.flush();
          commitEcho();
          setCaption("");
          break;
        case "turnComplete":
          commitEcho();
          break;
        case "endSession":
          if (sleepTimerRef.current === null) {
            sleepTimerRef.current = window.setTimeout(() => void handleCloseRef.current(), SLEEP_CLOSE_DELAY_MS);
          }
          break;
        case "resuming":
          setPhase("resuming");
          break;
        case "resumed":
          setPhase("live");
          break;
        case "limit":
          setError(`That's ${Math.round(ev.seconds / 60)} minutes of face-to-face for now — Echo needs a rest!`);
          break;
        case "error":
          setError(ev.message);
          setPhase("error");
          break;
        case "closed":
          if (!closingRef.current) {
            setPhase((p) => (p === "error" ? p : "ended"));
            void flushTranscript();
          }
          break;
      }
    },
    [commitEcho, commitUser, flushTranscript]
  );

  const onMedia = useCallback((data: ArrayBuffer) => {
    const kind = new Uint8Array(data, 0, 1)[0];
    const payload = data.slice(1);
    lastActivityRef.current = Date.now();
    lastMediaRef.current = Date.now();
    if (kind === MEDIA_KIND.VIDEO_MP4) {
      const video = videoRef.current;
      if (!video) return;
      if (!playerRef.current) {
        playerRef.current = new FragmentPlayer(video, mimeByKind.current[kind] ?? "video/mp4");
        playerRef.current.onStalled = () => setNeedsTap(true);
        playerRef.current.onUnsupported = (mime) => {
          setHasVideo(false);
          setError(`This browser can't play Echo's video (${mime}). Try Chrome, Edge or Safari — or use the normal voice button.`);
        };
        setHasVideo(true);
      }
      void playerRef.current.append(payload);
    } else if (kind === MEDIA_KIND.AUDIO_PCM) {
      if (!pcmRef.current) pcmRef.current = new PcmPlayer();
      pcmRef.current.play(payload);
    }
  }, []);

  // ---- start --------------------------------------------------------------
  const start = useCallback(async () => {
    setError(null);
    setPhase("connecting");
    closingRef.current = false;
    lastActivityRef.current = Date.now();
    try {
      const r = await fetch("/api/avatar-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ childId, mode }),
      });
      const data = (await r.json().catch(() => ({}))) as { relayUrl?: string; ticket?: string; error?: string };
      if (!r.ok || !data.relayUrl || !data.ticket) throw new Error(data.error ?? `status ${r.status}`);

      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
      micStreamRef.current = mic;

      const url = data.relayUrl.replace(/\/$/, "") + (data.relayUrl.endsWith("/live") ? "" : "/live");
      const ws = new WebSocket(url);
      ws.binaryType = "arraybuffer";
      wsRef.current = ws;
      ws.onopen = () => ws.send(JSON.stringify({ type: "start", ticket: data.ticket }));
      ws.onmessage = (m) => {
        if (typeof m.data === "string") {
          try {
            onEvent(JSON.parse(m.data) as RelayEvent);
          } catch {
            /* ignore */
          }
        } else {
          onMedia(m.data as ArrayBuffer);
        }
      };
      ws.onerror = () => setError("Couldn't reach Echo's face-to-face server.");
      ws.onclose = (e) => {
        if (closingRef.current) return;
        if (e.code !== 1000) {
          setError((prev) => prev ?? `Connection closed (${e.code}${e.reason ? `: ${e.reason}` : ""})`);
          setPhase("error");
        } else {
          setPhase("ended");
        }
        void flushTranscript();
      };

      const ctx = new AudioContext({ sampleRate: 16000 });
      micCtxRef.current = ctx;
      const workletUrl = URL.createObjectURL(new Blob([MIC_WORKLET], { type: "application/javascript" }));
      await ctx.audioWorklet.addModule(workletUrl);
      URL.revokeObjectURL(workletUrl);
      const src = ctx.createMediaStreamSource(mic);
      const node = new AudioWorkletNode(ctx, "pcm-capture");
      node.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
        const sock = wsRef.current;
        if (!sock || sock.readyState !== 1 || mutedRef.current) return;
        sock.send(e.data);
      };
      src.connect(node);
      // Worklet must be pulled by the graph; route to a muted gain so nothing is heard.
      const sink = ctx.createGain();
      sink.gain.value = 0;
      node.connect(sink).connect(ctx.destination);
      await ctx.resume();

      // Prime playback while we're still close to the user's tap.
      pcmRef.current = new PcmPlayer();
      await pcmRef.current.resume().catch(() => {});
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setPhase("error");
      teardown();
    }
  }, [childId, mode, onEvent, onMedia, teardown, flushTranscript]);

  useEffect(() => {
    // Deferred a tick so start()'s state updates don't run inside the effect body.
    const id = window.setTimeout(() => void start(), 0);
    return () => {
      window.clearTimeout(id);
      teardown();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- speaking indicator + auto-sleep ------------------------------------
  useEffect(() => {
    const id = window.setInterval(() => {
      const recentMedia = Date.now() - lastMediaRef.current < 700;
      const v = videoRef.current;
      const videoPlaying = !!v && !v.paused && v.buffered.length > 0 && v.buffered.end(v.buffered.length - 1) - v.currentTime > 0.1;
      const isSpeaking = recentMedia || videoPlaying || !!pcmRef.current?.speaking;
      setSpeaking(isSpeaking);
      if (isSpeaking) lastActivityRef.current = Date.now();
      if (phase === "live" && Date.now() - lastActivityRef.current > SILENCE_MS) {
        void handleCloseRef.current();
      }
    }, 300);
    return () => window.clearInterval(id);
  }, [phase]);

  // Esc closes
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") void handleCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- controls -----------------------------------------------------------
  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMuted(next);
    if (next) wsRef.current?.send(JSON.stringify({ type: "audioStreamEnd" }));
  }, []);

  const toggleCamera = useCallback(async () => {
    if (cameraOn) {
      stopCamera();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        audio: false,
      });
      camStreamRef.current = stream;
      const v = cameraVideoRef.current;
      if (v) {
        v.srcObject = stream;
        await v.play().catch(() => {});
      }
      const canvas = document.createElement("canvas");
      camTimerRef.current = window.setInterval(() => {
        const vid = cameraVideoRef.current;
        const sock = wsRef.current;
        if (!vid || !vid.videoWidth || !sock || sock.readyState !== 1) return;
        const scale = Math.min(1, CAMERA_MAX_EDGE / Math.max(vid.videoWidth, vid.videoHeight));
        canvas.width = Math.round(vid.videoWidth * scale);
        canvas.height = Math.round(vid.videoHeight * scale);
        canvas.getContext("2d")?.drawImage(vid, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          async (blob) => {
            if (!blob || wsRef.current?.readyState !== 1) return;
            const b64 = arrayBufferToBase64(await blob.arrayBuffer());
            wsRef.current.send(JSON.stringify({ type: "video", data: b64 }));
          },
          "image/jpeg",
          0.7
        );
      }, 1000 / CAMERA_FPS);
      setCameraOn(true);
    } catch (e) {
      console.warn("[avatar] camera failed", e);
      setError("Couldn't open the camera.");
    }
  }, [cameraOn, stopCamera]);

  const tapToPlay = useCallback(() => {
    setNeedsTap(false);
    void videoRef.current?.play().catch(() => setNeedsTap(true));
    void pcmRef.current?.resume();
  }, []);

  // ---- UI -----------------------------------------------------------------
  let label = "Connecting to Echo…";
  if (phase === "error") label = "Couldn't connect";
  else if (phase === "resuming") label = "Echo blinked — reconnecting…";
  else if (phase === "ended") label = "Call ended";
  else if (phase === "live") label = speaking ? "Echo is talking" : muted ? "Muted" : "Listening — your turn";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Face-to-face call with Echo"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        background: "rgba(7, 8, 13, 0.95)",
        backdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div style={{ width: "100%", maxWidth: 520, textAlign: "center" }}>
        {/* Echo's face */}
        <div
          style={{
            position: "relative",
            width: "min(100%, 360px)",
            aspectRatio: "9 / 16",
            maxHeight: "62vh",
            margin: "0 auto",
            borderRadius: 24,
            overflow: "hidden",
            border: `2px solid ${speaking ? "var(--violet)" : "var(--border-strong)"}`,
            boxShadow: speaking ? "0 0 40px rgba(138,107,255,0.45)" : "var(--shadow-soft)",
            transition: "border-color 200ms ease, box-shadow 200ms ease",
            background: "#0b0c14",
          }}
        >
          <video
            ref={videoRef}
            playsInline
            autoPlay
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: hasVideo ? 1 : 0,
              transition: "opacity 400ms ease",
            }}
          />
          {!hasVideo && (
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <div style={{ position: "relative", width: 180, height: 180, borderRadius: "50%", overflow: "hidden" }}>
                <Image
                  src="/echo.png"
                  alt="Echo"
                  fill
                  sizes="180px"
                  style={{ objectFit: "cover", animation: "avatarBreathe 3s ease-in-out infinite" }}
                />
              </div>
            </div>
          )}

          {/* Homework-lens preview (small, top-right) */}
          <video
            ref={cameraVideoRef}
            playsInline
            muted
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 96,
              borderRadius: 10,
              border: "2px solid var(--cyan)",
              display: cameraOn ? "block" : "none",
            }}
          />
          {cameraOn && (
            <div
              className="mono"
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                fontSize: 10,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                background: "rgba(0,0,0,0.6)",
                color: "var(--cyan)",
                padding: "4px 8px",
                borderRadius: 999,
              }}
            >
              ● Echo can see
            </div>
          )}

          {/* Captions */}
          {caption && (
            <div
              style={{
                position: "absolute",
                left: 10,
                right: 10,
                bottom: 10,
                background: "rgba(0,0,0,0.62)",
                color: "#fff",
                fontSize: 16,
                lineHeight: 1.35,
                padding: "8px 12px",
                borderRadius: 12,
              }}
            >
              {caption}
            </div>
          )}

          {needsTap && (
            <button
              onClick={tapToPlay}
              className="btn btn-violet"
              style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)" }}
            >
              Tap to see Echo
            </button>
          )}
        </div>

        <div
          className="mono"
          style={{ marginTop: 16, fontSize: 12, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-muted)" }}
        >
          {label}
        </div>

        {error && (
          <p style={{ margin: "12px auto 0", color: "var(--ink-soft)", fontSize: 14, maxWidth: 380 }}>{error}</p>
        )}

        <div style={{ marginTop: 20, display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
          {phase === "error" || phase === "ended" ? (
            <button onClick={() => void start()} className="btn btn-violet">
              Try again
            </button>
          ) : (
            <>
              <button onClick={toggleMute} className="btn btn-ghost" aria-pressed={muted}>
                {muted ? "Unmute" : "Mute"}
              </button>
              <button onClick={() => void toggleCamera()} className="btn btn-ghost" aria-pressed={cameraOn}>
                {cameraOn ? "Hide homework" : "Show homework"}
              </button>
            </>
          )}
          <button
            onClick={() => void handleClose()}
            className="btn btn-ghost"
            style={{ borderColor: "rgba(239,68,68,0.45)", color: "#fca5a5" }}
          >
            End call
          </button>
        </div>

        <p style={{ marginTop: 18, color: "var(--ink-muted)", fontSize: 12, fontFamily: "var(--font-mono)", letterSpacing: "0.06em" }}>
          Echo is an AI · Esc to end · Auto-sleeps after 45s of silence
        </p>
      </div>
      <style>{`
        @keyframes avatarBreathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.04); } }
      `}</style>
    </div>
  );
}
