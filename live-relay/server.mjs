// CU3E live relay — sits between the study-hub (browser) and Gemini 3.8 Live.
//
// Why it exists: Vertex / Gemini Enterprise has no browser-safe ephemeral
// tokens, and Vercel functions can't hold long-lived WebSockets. This small
// Node server keeps Google credentials server-side and holds the socket.
//
//   GET  /healthz   -> "ok"
//   WS   /live      -> see lib/protocol.mjs
import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { WebSocketServer } from 'ws';
import { createClient, MODEL, avatarConfig } from './lib/gemini.mjs';
import { verifyTicket } from './lib/ticket.mjs';
import { Bridge } from './lib/bridge.mjs';

const PORT = Number(process.env.PORT || 8787);
const SECRET = process.env.LIVE_RELAY_SECRET;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT_SESSIONS || 3);

// Factory so tests can inject a fake Gemini client.
export function createRelayServer({ ai, secret = SECRET, allowedOrigins = ALLOWED_ORIGINS, maxConcurrent = MAX_CONCURRENT } = {}) {
  let active = 0;
  let nextId = 1;

  const server = http.createServer((req, res) => {
    if (req.url === '/healthz' || req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({
    server,
    path: '/live',
    maxPayload: 4 * 1024 * 1024,
    verifyClient: ({ origin }, cb) => {
      if (allowedOrigins.length && !allowedOrigins.includes(origin)) return cb(false, 403, 'origin not allowed');
      if (active >= maxConcurrent) return cb(false, 503, 'relay busy');
      cb(true);
    },
  });

  wss.on('connection', (ws) => {
    const id = nextId++;
    const log = (...a) => console.log(`[relay#${id}]`, ...a);
    active++;
    let bridge = null;
    let starting = false;

    const startTimeout = setTimeout(() => {
      if (!bridge) ws.close(4001, 'no start message');
    }, 10_000);

    ws.on('message', async (data, isBinary) => {
      if (isBinary) {
        bridge?.onClientBinary(Buffer.isBuffer(data) ? data : Buffer.from(data));
        return;
      }
      let msg;
      try {
        msg = JSON.parse(data.toString());
      } catch {
        return;
      }
      if (msg.type === 'start') {
        if (bridge || starting) return;
        starting = true;
        let ticket;
        try {
          ticket = verifyTicket(msg.ticket, secret);
        } catch (e) {
          log('rejected ticket:', e.message);
          ws.send(JSON.stringify({ type: 'error', message: e.message }));
          ws.close(4003, 'bad ticket');
          return;
        }
        clearTimeout(startTimeout);
        log(`start child=${ticket.childName ?? ticket.childId} lang=${ticket.lang} mode=${ticket.mode ?? 'tutor'}`);
        const b = new Bridge({ ws, ai, ticket, log });
        try {
          await b.start();
          if (ws.readyState !== 1) {
            b.close('client-gone');
            return;
          }
          bridge = b;
        } catch (e) {
          log('connect failed:', e?.message ?? e);
          ws.send(JSON.stringify({ type: 'error', message: `Gemini connect failed: ${e?.message ?? e}` }));
          ws.close(1011, 'gemini connect failed');
        }
        return;
      }
      bridge?.onClientJson(msg);
    });

    ws.on('close', () => {
      active--;
      clearTimeout(startTimeout);
      bridge?.close('client-disconnected');
    });
    ws.on('error', (e) => log('ws error', e.message));
  });

  return server;
}

// Run directly: `node server.mjs`
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!SECRET || SECRET.length < 16) {
    console.error('LIVE_RELAY_SECRET must be set (>=16 chars) and match the Next.js app.');
    process.exit(1);
  }
  const server = createRelayServer({ ai: createClient() });
  server.listen(PORT, () => {
    const av = avatarConfig();
    console.log(
      `cu3e-live-relay on :${PORT}  model=${MODEL}  backend=${process.env.GOOGLE_GENAI_USE_VERTEXAI === 'true' ? 'vertex' : 'gemini-api'}  avatar=${av ? (av.customizedAvatar ? 'custom-image' : av.avatarName) : 'off'}`
    );
  });
}
