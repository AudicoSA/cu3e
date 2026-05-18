// Shared definition of the Five Big Ideas — mapped to AI4K12.
// Used by /skills (cards) and /dashboard (progress ladder).
// Each lesson has a stable id + the exact opening prompt sent to Echo
// when the kid clicks "Start lesson". The dashboard uses the prompt prefix
// to identify which skill a Skills-mode conversation was about.

export type SkillLesson = {
  id: string;
  number: string;
  title: string;
  pitch: string;
  prompt: string;
};

export const SKILL_LESSONS: SkillLesson[] = [
  {
    id: "perception",
    number: "01",
    title: "How AI sees",
    pitch:
      "Cameras see pixels. AI has to guess what those pixels mean. Sometimes it gets it brilliantly right. Sometimes hilariously wrong.",
    prompt:
      "Let's play a game about how AI sees pictures. Ask me to describe a tricky image — something that could fool an AI — and then let me try to guess what AI would think it is. Start the game.",
  },
  {
    id: "reasoning",
    number: "02",
    title: "How AI thinks",
    pitch:
      "AI doesn't 'know' things the way you do — it builds a map of the world. We'll poke at the edges of that map and find where it breaks.",
    prompt:
      "Help me see how AI 'thinks' about a topic. Pick something I probably know a lot about (an animal, a hobby, a place) and let's compare what I know to what AI knows. Start by asking me to pick one.",
  },
  {
    id: "learning",
    number: "03",
    title: "How AI learns",
    pitch:
      "AI learns by seeing millions of examples. Show it three of something and it tries to find a rule. We'll watch it succeed and watch it fail.",
    prompt:
      "Let's run a tiny experiment to see how AI learns from examples. Give me three things that follow a secret rule, then I'll guess your rule. Then we'll flip it — I make a rule and see if you spot it.",
  },
  {
    id: "interaction",
    number: "04",
    title: "Why AI misunderstands",
    pitch:
      "AI listens to your words but doesn't always get your meaning. We'll try to confuse it on purpose — and find out what makes a good prompt.",
    prompt:
      "Let's play 'trick the AI'. I'll ask you to do something in a confusing way, you do your best to misunderstand on purpose, and then we figure out together what made the request confusing. Set up the first round.",
  },
  {
    id: "impact",
    number: "05",
    title: "When not to trust AI",
    pitch:
      "AI can be unfair, biased, or just wrong about things that matter. We'll find one real example and talk about it.",
    prompt:
      "Talk to me about a situation where it would be a bad idea to trust AI — like making a medical decision, judging someone, or deciding who gets a job. Make it concrete and ask me what I'd do instead.",
  },
];

// Stable lookup by id
export const SKILL_BY_ID = new Map(SKILL_LESSONS.map((s) => [s.id, s]));

// Match a free-text first user message back to its skill id.
// We use the first ~60 chars of each opening prompt as a stable signature
// (whitespace-normalised). This avoids whole-string equality being broken by
// trailing punctuation or transport-layer trimming.
const SIGNATURE_LEN = 60;
const skillSignatures: Array<{ id: string; sig: string }> = SKILL_LESSONS.map((s) => ({
  id: s.id,
  sig: s.prompt.replace(/\s+/g, " ").trim().slice(0, SIGNATURE_LEN).toLowerCase(),
}));

export function detectSkillFromMessage(message: string): string | null {
  if (!message) return null;
  const normalised = message.replace(/\s+/g, " ").trim().toLowerCase();
  for (const { id, sig } of skillSignatures) {
    if (normalised.startsWith(sig)) return id;
  }
  return null;
}
