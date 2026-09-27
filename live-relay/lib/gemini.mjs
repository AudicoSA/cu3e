// Gemini Live connection factory + config. Kept separate from the WebSocket
// plumbing so spike.mjs and server.mjs build sessions exactly the same way.
import { readFileSync } from 'node:fs';
import { GoogleGenAI, Modality } from '@google/genai';

export const MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live';

// Vertex / Gemini Enterprise (service account or `gcloud auth application-default login`)
// when GOOGLE_GENAI_USE_VERTEXAI=true, otherwise a Gemini API key.
export function createClient() {
  if (process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true') {
    const project = process.env.GOOGLE_CLOUD_PROJECT;
    const location = process.env.GOOGLE_CLOUD_LOCATION || 'europe-west4';
    if (!project) throw new Error('GOOGLE_CLOUD_PROJECT is required when GOOGLE_GENAI_USE_VERTEXAI=true');
    return new GoogleGenAI({ vertexai: true, project, location });
  }
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Set GOOGLE_GENAI_USE_VERTEXAI=true (+ GOOGLE_CLOUD_PROJECT) or GEMINI_API_KEY');
  }
  return new GoogleGenAI({ apiKey });
}

let cachedCustomAvatar;
function customAvatar() {
  if (cachedCustomAvatar !== undefined) return cachedCustomAvatar;
  const path = process.env.AVATAR_IMAGE_PATH;
  if (!path) return (cachedCustomAvatar = null);
  const mime = path.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
  cachedCustomAvatar = {
    imageMimeType: mime,
    imageData: readFileSync(path).toString('base64'),
  };
  return cachedCustomAvatar;
}

// Avatar config from env:
//   AVATAR_ENABLED=false         -> voice only (still Gemini, no face)
//   AVATAR_IMAGE_PATH=echo.png   -> custom avatar (allowlisted projects only;
//                                   portrait 9:16, min 704x1280)
//   AVATAR_NAME=<preset id>      -> Google preset avatar
export function avatarConfig() {
  if (process.env.AVATAR_ENABLED === 'false') return null;
  const custom = customAvatar();
  const cfg = {};
  if (custom) cfg.customizedAvatar = custom;
  else cfg.avatarName = process.env.AVATAR_NAME || 'Kai';
  if (process.env.AVATAR_VIDEO_BITRATE_BPS) cfg.videoBitrateBps = Number(process.env.AVATAR_VIDEO_BITRATE_BPS);
  if (process.env.AVATAR_AUDIO_BITRATE_BPS) cfg.audioBitrateBps = Number(process.env.AVATAR_AUDIO_BITRATE_BPS);
  return cfg;
}

export const END_SESSION_TOOL = {
  name: 'end_session',
  description:
    'End the face-to-face call. Call this right after your goodbye when the child says goodbye, ' +
    'wants to sleep, or asks you to stop talking.',
  parameters: {
    type: 'OBJECT',
    properties: {
      reason: { type: 'STRING', description: 'Short reason, e.g. "goodbye" or "sleepy".' },
    },
  },
};

export function buildConfig({ prompt, resumeHandle, languageCode }) {
  const config = {
    responseModalities: [Modality.AUDIO],
    systemInstruction: { parts: [{ text: prompt }] },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
    contextWindowCompression: { slidingWindow: {} },
    tools: [{ functionDeclarations: [END_SESSION_TOOL] }],
  };
  const avatar = avatarConfig();
  if (avatar) config.avatarConfig = avatar;
  // Gemini auto-detects the spoken language; the system prompt tells Echo
  // which language to answer in. Force a BCP-47 code only if auto-detect
  // misbehaves (e.g. SPEECH_LANGUAGE_CODES=af:af-ZA,zu:zu-ZA).
  if (languageCode) config.speechConfig = { languageCode };
  if (process.env.GEMINI_VOICE_NAME) {
    config.speechConfig = {
      ...(config.speechConfig ?? {}),
      voiceConfig: { prebuiltVoiceConfig: { voiceName: process.env.GEMINI_VOICE_NAME } },
    };
  }
  return config;
}

// Maps our 'en' | 'af' | 'zu' to an explicit BCP-47 speech code only when
// SPEECH_LANGUAGE_CODES opts in, e.g. "af:af-ZA,zu:zu-ZA".
export function speechCodeFor(lang) {
  const raw = process.env.SPEECH_LANGUAGE_CODES;
  if (!raw || !lang) return undefined;
  for (const pair of raw.split(',')) {
    const [k, v] = pair.split(':').map((x) => x.trim());
    if (k === lang && v) return v;
  }
  return undefined;
}

// One-line description of a server message for logs — the spike needs to
// learn the exact shape of avatar output, so we log what actually arrives.
export function describeMessage(msg) {
  const bits = [];
  if (msg.setupComplete) bits.push('setupComplete');
  const sc = msg.serverContent;
  if (sc) {
    for (const p of sc.modelTurn?.parts ?? []) {
      if (p.inlineData) {
        const size = Math.round(((p.inlineData.data?.length ?? 0) * 3) / 4);
        bits.push(`inline:${p.inlineData.mimeType}:${size}B`);
      } else if (p.text) bits.push(`text:${p.text.length}c`);
      else bits.push(`part:${Object.keys(p).join('+')}`);
    }
    if (sc.inputTranscription?.text) bits.push('inTx');
    if (sc.outputTranscription?.text) bits.push('outTx');
    if (sc.interrupted) bits.push('interrupted');
    if (sc.generationComplete) bits.push('generationComplete');
    if (sc.turnComplete) bits.push('turnComplete');
  }
  if (msg.toolCall) bits.push(`toolCall:${(msg.toolCall.functionCalls ?? []).map((f) => f.name).join(',')}`);
  if (msg.sessionResumptionUpdate) bits.push(`resumption:${msg.sessionResumptionUpdate.resumable ? 'ok' : 'no'}`);
  if (msg.goAway) bits.push(`goAway:${msg.goAway.timeLeft}`);
  if (msg.usageMetadata) bits.push(`usage:${msg.usageMetadata.totalTokenCount ?? '?'}`);
  const known = new Set(['setupComplete', 'serverContent', 'toolCall', 'sessionResumptionUpdate', 'goAway', 'usageMetadata']);
  for (const k of Object.keys(msg)) if (!known.has(k) && msg[k] !== undefined) bits.push(`?${k}`);
  return bits.join(' ') || '(empty)';
}
