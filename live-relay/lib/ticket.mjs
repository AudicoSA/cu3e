// Signed session tickets.
//
// The Next.js app (/api/avatar-session) builds Echo's full system prompt
// server-side, then signs it together with the child's identity. The browser
// only carries the opaque ticket to the relay, so it can't swap in its own
// prompt or impersonate another child. Format:
//
//   base64url(JSON payload) + "." + base64url(HMAC-SHA256(payload, secret))
//
// Keep this file byte-compatible with src/lib/live-ticket.ts in the app.
import { createHmac, timingSafeEqual } from 'node:crypto';

export function signTicket(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyTicket(ticket, secret, now = Date.now()) {
  if (typeof ticket !== 'string' || !ticket.includes('.')) {
    throw new Error('malformed ticket');
  }
  const [body, sig] = ticket.split('.', 2);
  const expected = createHmac('sha256', secret).update(body).digest();
  const given = Buffer.from(sig, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new Error('bad ticket signature');
  }
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (typeof payload.exp !== 'number' || payload.exp < now) {
    throw new Error('ticket expired');
  }
  if (typeof payload.prompt !== 'string' || !payload.prompt) {
    throw new Error('ticket missing prompt');
  }
  return payload;
}
