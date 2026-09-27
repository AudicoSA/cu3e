// Server-only: signs Live Avatar session tickets for the relay.
// Byte-compatible with live-relay/lib/ticket.mjs — keep the two in sync.
import { createHmac } from 'node:crypto';

export type LiveTicketPayload = {
  childId: string;
  parentId: string;
  childName: string;
  lang: string;
  mode: string;
  prompt: string;
  maxMinutes: number;
  exp: number; // ms epoch
};

export function signLiveTicket(payload: LiveTicketPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}
