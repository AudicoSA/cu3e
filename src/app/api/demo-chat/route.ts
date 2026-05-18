import { streamText, type ModelMessage } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';

export const maxDuration = 30;

type IncomingPart = { text?: string };
type IncomingMessage = { role?: string; content?: string; parts?: IncomingPart[] };

// Hardcoded curriculum context for the homepage demo.
// Sourced from the Grade 7 Patterns worksheet (HomeworkHelp 365 notes) so Echo
// can speak about a real-looking homework page without anyone uploading anything.
const DEMO_CURRICULUM = `
GRADE 7 MATHEMATICS — PATTERNS

A pattern is a sequence of numbers, shapes or objects that follows a rule.

NUMERIC PATTERNS — examples:
- 2, 5, 8, 11, 14, ...  Rule: add 3 each time.  Next: 17, 20, 23.
- 100, 90, 80, 70, ...  Rule: subtract 10.  Next: 60, 50, 40.
- 3, 6, 12, 24, 48, ...  Rule: multiply by 2.  Next: 96, 192, 384.
- 1, 4, 9, 16, 25, ...  Rule: square the term number. Next: 36, 49, 64.

GEOMETRIC PATTERNS — examples:
- Growing dot pattern: add 1 dot each term.
- Square pattern: 1x1, 2x2, 3x3, 4x4, ... (each square adds one row and one column).
- Triangle dot pattern: row 1 has 1 dot, row 2 has 2 dots, etc. The total dots at term n is the nth triangular number.

PRACTICE PROBLEMS the child has been given:
1) 7, 11, 15, 19, ... (rule: add 4)
2) 50, 45, 40, 35, ... (rule: subtract 5)
3) 2, 4, 8, 16, ... (rule: multiply by 2)
4) 5, 10, 15, 20, ... (rule: add 5)
5) 1, 3, 6, 10, 15, ... (rule: add consecutive numbers — +2, +3, +4, +5, ...)
`;

export async function POST(req: Request) {
  const json = (await req.json()) as { messages?: IncomingMessage[] };
  const rawMessages = json.messages || [];

  const coreMessages: ModelMessage[] = [];
  let lastRole: 'user' | 'assistant' | '' = '';

  for (const m of rawMessages) {
    const text =
      m.content ||
      (m.parts ? m.parts.map((p) => p.text || '').join('') : '') ||
      '';
    if (!text.trim()) continue;

    const role: 'user' | 'assistant' = m.role === 'user' ? 'user' : 'assistant';

    if (role === lastRole && coreMessages.length > 0) {
      const prev = coreMessages[coreMessages.length - 1];
      prev.content = `${prev.content as string}\n\n${text}`;
    } else {
      coreMessages.push({ role, content: text });
      lastRole = role;
    }
  }

  const systemPrompt = `You are 'Echo', the AI tutor for CU3E. This is a public live demo on the CU3E homepage — the visitor is a curious parent, not the child.

A real Grade 7 Mathematics homework page on PATTERNS is "loaded" as your context (see below). Reference specific problems and rules from it when you respond.

Your behavior:
- Never just solve the problems. Instead, take the concept from the page and turn it into a creative, real-world challenge the child would have to think through.
- Be Socratic: ask the next good question instead of giving the answer.
- Keep responses tight — 3-4 sentences max for a demo. The parent is evaluating you in under a minute.
- Open warmly. Use **bold** sparingly for emphasis. No emojis.
- If the parent asks something off-topic (not about the homework or about CU3E), gently steer back to demonstrating how you would help their child with this Patterns page.

LOADED CURRICULUM:
${DEMO_CURRICULUM}`;

  const result = streamText({
    model: anthropic('claude-sonnet-4-6'),
    system: systemPrompt,
    messages: coreMessages,
    maxRetries: 1,
  });

  return result.toUIMessageStreamResponse();
}
