// Shared definition of the AI Skills curriculum.
// Used by /skills (cards), /dashboard (foundations progress ladder), and
// /api/skill-images/seed (tile background generation).
//
// Curriculum structure: 10 categories × 5 modules = 50 modules total.
// Each module is either `live` (has a `prompt`, clickable, launches a chat)
// or `coming-soon` (greyed, opens a waitlist modal). The 5 original
// foundations lessons (perception → impact) are preserved exactly so the
// dashboard's progress ladder keeps matching past conversations.
//
// Age handling: every live module is age-adaptive — Echo's system prompt
// already branches on the child's age band, so we do NOT tag modules with
// a minimum age. The same module looks different for a 7yo than a 14yo.

export type SkillCategoryId =
  | 'foundations'
  | 'talking'
  | 'image'
  | 'video'
  | 'audio'
  | 'productivity'
  | 'social'
  | 'build'
  | 'critical'
  | 'projects';

export type SkillStatus = 'live' | 'coming-soon';

export type SkillLesson = {
  id: string;
  number: string;
  category: SkillCategoryId;
  title: string;
  pitch: string;
  // The opening user-message we send Echo when the kid clicks "Start lesson".
  // Live modules have a prompt; coming-soon modules have null and instead
  // open the waitlist modal.
  prompt: string | null;
  status: SkillStatus;
  // Optional pointer to a real-world tool / company the module culminates in.
  // Surfaces as a small chip on the tile. e.g. "Gemini Nano Banana".
  tool?: string;
};

export type SkillCategory = {
  id: SkillCategoryId;
  label: string;
  subtitle: string;
  accent: string;
};

// Category metadata — controls section ordering on /skills and the colour
// accent used both on cards and (later) on generated tile backgrounds.
export const SKILL_CATEGORIES: SkillCategory[] = [
  {
    id: 'foundations',
    label: 'The Basics',
    subtitle: 'How AI actually works — under the hood',
    accent: '#8a6bff',
  },
  {
    id: 'talking',
    label: 'Talking to AI',
    subtitle: 'The skill that runs underneath every other skill',
    accent: '#4ed8eb',
  },
  {
    id: 'image',
    label: 'Make Pictures',
    subtitle: 'From a sentence to an image you actually want',
    accent: '#f0b340',
  },
  {
    id: 'video',
    label: 'Make Videos',
    subtitle: 'Tell a story with frames AI helps you draw',
    accent: '#ec4899',
  },
  {
    id: 'audio',
    label: 'Make Sound',
    subtitle: 'Voices, music, and noise — built with AI',
    accent: '#22d3ee',
  },
  {
    id: 'productivity',
    label: 'Get Things Done',
    subtitle: 'Real homework, real life — done faster, not lazier',
    accent: '#a78bfa',
  },
  {
    id: 'social',
    label: 'Online & Social',
    subtitle: 'Posting, captioning, and not embarrassing yourself',
    accent: '#fb7185',
  },
  {
    id: 'build',
    label: 'Build With AI',
    subtitle: 'Stop using apps. Start making them.',
    accent: '#34d399',
  },
  {
    id: 'critical',
    label: 'Sharp Thinking',
    subtitle: 'When AI lies, when it’s biased, when to walk away',
    accent: '#fbbf24',
  },
  {
    id: 'projects',
    label: 'Real Projects',
    subtitle: 'Things you actually finish and show people',
    accent: '#60a5fa',
  },
];

export const SKILL_CATEGORY_BY_ID = new Map(
  SKILL_CATEGORIES.map((c) => [c.id, c])
);

export const SKILL_LESSONS: SkillLesson[] = [
  // -------------------------------------------------------------------------
  // FOUNDATIONS — the original 5, mapped to AI4K12's Five Big Ideas.
  // -------------------------------------------------------------------------
  {
    id: 'perception',
    number: '01',
    category: 'foundations',
    title: 'How AI sees',
    pitch:
      "Cameras see pixels. AI has to guess what those pixels mean. Sometimes it gets it brilliantly right. Sometimes hilariously wrong.",
    status: 'live',
    prompt:
      "Let's play a game about how AI sees pictures. Ask me to describe a tricky image — something that could fool an AI — and then let me try to guess what AI would think it is. Start the game.",
  },
  {
    id: 'reasoning',
    number: '02',
    category: 'foundations',
    title: 'How AI thinks',
    pitch:
      "AI doesn't 'know' things the way you do — it builds a map of the world. We'll poke at the edges of that map and find where it breaks.",
    status: 'live',
    prompt:
      "Help me see how AI 'thinks' about a topic. Pick something I probably know a lot about (an animal, a hobby, a place) and let's compare what I know to what AI knows. Start by asking me to pick one.",
  },
  {
    id: 'learning',
    number: '03',
    category: 'foundations',
    title: 'How AI learns',
    pitch:
      "AI learns by seeing millions of examples. Show it three of something and it tries to find a rule. We'll watch it succeed and watch it fail.",
    status: 'live',
    prompt:
      "Let's run a tiny experiment to see how AI learns from examples. Give me three things that follow a secret rule, then I'll guess your rule. Then we'll flip it — I make a rule and see if you spot it.",
  },
  {
    id: 'interaction',
    number: '04',
    category: 'foundations',
    title: 'Why AI misunderstands',
    pitch:
      "AI listens to your words but doesn't always get your meaning. We'll try to confuse it on purpose — and find out what makes a good prompt.",
    status: 'live',
    prompt:
      "Let's play 'trick the AI'. I'll ask you to do something in a confusing way, you do your best to misunderstand on purpose, and then we figure out together what made the request confusing. Set up the first round.",
  },
  {
    id: 'impact',
    number: '05',
    category: 'foundations',
    title: 'When not to trust AI',
    pitch:
      "AI can be unfair, biased, or just wrong about things that matter. We'll find one real example and talk about it.",
    status: 'live',
    prompt:
      "Talk to me about a situation where it would be a bad idea to trust AI — like making a medical decision, judging someone, or deciding who gets a job. Make it concrete and ask me what I'd do instead.",
  },

  // -------------------------------------------------------------------------
  // TALKING TO AI — the meta-skill that runs underneath everything else.
  // -------------------------------------------------------------------------
  {
    id: 'prompt-craft',
    number: '06',
    category: 'talking',
    title: 'The art of the prompt',
    pitch:
      "A vague question gets a vague answer. We'll take one ordinary request and rewrite it three ways until AI gives us something amazing.",
    status: 'live',
    prompt:
      "Let's run a tiny prompt-engineering workshop. Ask me for any everyday thing I might ask an AI (a recipe, a story idea, help with a question). Then together we'll rewrite my prompt three times — adding context, then constraints, then a format — and you respond differently to each version so I can see how prompts change answers. Start by asking me what I'd like to ask.",
  },
  {
    id: 'iterating',
    number: '07',
    category: 'talking',
    title: 'When one shot isn’t enough',
    pitch:
      "Pro AI users don't stop at the first answer. They edit, redirect, and push back until the AI actually gets it. We'll practice the moves.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'formatting',
    number: '08',
    category: 'talking',
    title: 'Tell AI HOW to answer',
    pitch:
      "Bullet list? Table? In the voice of a pirate? Three sentences only? You're allowed to ask for anything — and you should.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'few-shot',
    number: '09',
    category: 'talking',
    title: 'Show, don’t tell',
    pitch:
      "Give AI two examples of what you want and one of what you don't, and watch its answers snap into place. This is the secret power.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'thinking-out-loud',
    number: '10',
    category: 'talking',
    title: 'Make AI think out loud',
    pitch:
      "Ask for the answer, you get the answer. Ask for the reasoning first, you get a smarter answer — and you can spot mistakes.",
    status: 'coming-soon',
    prompt: null,
  },

  // -------------------------------------------------------------------------
  // IMAGE — culminates in Gemini Nano Banana / Higgsfield style tools.
  // -------------------------------------------------------------------------
  {
    id: 'image-from-words',
    number: '11',
    category: 'image',
    title: 'Make a picture from words',
    pitch:
      "Describe something AI has never seen — a dragon driving a school bus, your dog as a spaceship captain — and we'll generate it together.",
    status: 'live',
    tool: 'Gemini Nano Banana',
    prompt:
      "We're going to learn how to turn words into pictures using AI image tools. Don't generate any images yourself — just help me write GREAT image prompts. Start by asking me what I want to picture, then coach me through three improvements to the prompt (subject → style → composition). At the end, give me the final polished prompt I could paste into Gemini or Midjourney. Make it fun.",
  },
  {
    id: 'character-consistency',
    number: '12',
    category: 'image',
    title: 'Same hero, different scenes',
    pitch:
      "AI can draw the same character five different ways. We'll teach it to remember our hero — same face, same outfit, every time.",
    status: 'coming-soon',
    tool: 'Higgsfield Soul',
    prompt: null,
  },
  {
    id: 'style-mood',
    number: '13',
    category: 'image',
    title: 'Style and mood',
    pitch:
      "Cinematic. Watercolour. Studio Ghibli. Cyberpunk neon. Same subject, ten worlds. Pick yours.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'photo-editing',
    number: '14',
    category: 'image',
    title: 'Edit a real photo',
    pitch:
      "Remove a stranger from the background. Swap your school uniform for a spacesuit. AI editing is wild — and easier than you think.",
    status: 'coming-soon',
    tool: 'Gemini Nano Banana',
    prompt: null,
  },
  {
    id: 'real-vs-ai',
    number: '15',
    category: 'image',
    title: 'Real vs AI',
    pitch:
      "Half these images are real, half AI. Can you tell? We'll find the giveaways AI still leaves behind — and what to do when you can't tell.",
    status: 'coming-soon',
    prompt: null,
  },

  // -------------------------------------------------------------------------
  // VIDEO — culminates in Higgsfield Seedance, HeyGen, Sora-style tools.
  // -------------------------------------------------------------------------
  {
    id: 'video-from-sentence',
    number: '16',
    category: 'video',
    title: 'Make a video from a sentence',
    pitch:
      "Ten years ago this was a film studio's job. Now it's a sentence and a wait. We'll plan a 6-second clip you'll actually want to share.",
    status: 'coming-soon',
    tool: 'Higgsfield Seedance 2',
    prompt: null,
  },
  {
    id: 'storyboarding',
    number: '17',
    category: 'video',
    title: 'Storyboard your story',
    pitch:
      "AI video makes the clips. YOU still have to decide what happens. We'll plan a tiny story frame-by-frame, then describe each frame.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'talking-heads',
    number: '18',
    category: 'video',
    title: 'Make a photo talk',
    pitch:
      "Pick a face. Pick a voice. Pick a script. Twenty years of CGI in a five-minute upload.",
    status: 'coming-soon',
    tool: 'HeyGen',
    prompt: null,
  },
  {
    id: 'music-video',
    number: '19',
    category: 'video',
    title: 'Music video in 10 minutes',
    pitch:
      "Generate a song, generate the visuals, line them up. Your first directing credit. Today.",
    status: 'coming-soon',
    tool: 'Suno + Seedance',
    prompt: null,
  },
  {
    id: 'cinematics',
    number: '20',
    category: 'video',
    title: 'Camera, light, framing',
    pitch:
      "“Close-up. Low angle. Golden hour.” The vocabulary directors use is the vocabulary that turns AI video from cursed to cinematic.",
    status: 'coming-soon',
    prompt: null,
  },

  // -------------------------------------------------------------------------
  // AUDIO — voices, music, sound design.
  // -------------------------------------------------------------------------
  {
    id: 'ai-voices',
    number: '21',
    category: 'audio',
    title: 'Give characters a voice',
    pitch:
      "Wizard. Robot. Toddler. Talk-show host. We'll pick a character and find the voice that makes them real.",
    status: 'coming-soon',
    tool: 'ElevenLabs',
    prompt: null,
  },
  {
    id: 'voice-cloning',
    number: '22',
    category: 'audio',
    title: 'Cloning a voice (the right way)',
    pitch:
      "AI can copy someone's voice from 30 seconds of audio. The how is easy. The when-and-why is the actual lesson.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'ai-music',
    number: '23',
    category: 'audio',
    title: 'Write a song from scratch',
    pitch:
      "You don't need to play an instrument. You need to know what you want it to feel like. We'll write one together.",
    status: 'coming-soon',
    tool: 'Suno',
    prompt: null,
  },
  {
    id: 'sound-design',
    number: '24',
    category: 'audio',
    title: 'Sound effects on demand',
    pitch:
      "Footsteps in snow. A door opening in a haunted house. The hum of a spaceship. AI makes them — you direct them.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'voice-agents',
    number: '25',
    category: 'audio',
    title: 'Talk to your own AI',
    pitch:
      "Voice in, voice out, no typing. We'll set up a hands-free conversation and figure out when it's actually better than text.",
    status: 'coming-soon',
    prompt: null,
  },

  // -------------------------------------------------------------------------
  // PRODUCTIVITY — real homework, real life.
  // -------------------------------------------------------------------------
  {
    id: 'emails-like-you',
    number: '26',
    category: 'productivity',
    title: 'Emails that sound like you',
    pitch:
      "AI can write a polite email in three seconds. The hard part is making it not sound like AI wrote it. We'll fix that.",
    status: 'live',
    prompt:
      "Help me write an email that sounds like ME, not a generic AI. First ask me: who am I writing to (teacher, coach, parent, friend's mom), what do I want, and what's my normal tone? Then give me a first draft. Then ask me what feels OFF about it, and we'll edit it together until it sounds like something I'd actually send. Don't use cringey AI phrases like “I hope this email finds you well.”",
  },
  {
    id: 'studying-with-ai',
    number: '27',
    category: 'productivity',
    title: 'Studying with AI',
    pitch:
      "Flashcards, quizzes, mock tests, explanations of the thing the teacher said too fast. Your private tutor, on tap.",
    status: 'live',
    prompt:
      "Help me study something I've got coming up at school. First ask what subject and what kind of test it is (essay, multiple choice, oral, exam). Then ask me to tell you what I already know about the topic — that's our starting point. Don't dump information at me. Make me retrieve it. Quiz me with one question at a time, give me a hint if I'm stuck, and only after I've tried do you tell me the answer. End with three flashcard-style Q&As I can use later. Make it feel like a study session with a smart friend.",
  },
  {
    id: 'summarising',
    number: '28',
    category: 'productivity',
    title: 'Read the hard stuff',
    pitch:
      "Long article. Boring chapter. Confusing science paper. AI can break it down for you — but only if you know how to ask.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'notes',
    number: '29',
    category: 'productivity',
    title: 'Notes that organise themselves',
    pitch:
      "Messy braindump in, structured notes out. AI is great at this — but the structure has to be yours, not its.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'research',
    number: '30',
    category: 'productivity',
    title: 'Research without copying',
    pitch:
      "Use AI to explore. Use your brain to decide. The line between research and cheating is real and we'll find it.",
    status: 'coming-soon',
    prompt: null,
  },

  // -------------------------------------------------------------------------
  // SOCIAL — captions, hooks, what to post.
  // -------------------------------------------------------------------------
  {
    id: 'captions',
    number: '31',
    category: 'social',
    title: 'Captions that actually work',
    pitch:
      "AI can generate ten captions in two seconds. Knowing which one is good is the actual skill. We'll learn the taste.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'thumbnails',
    number: '32',
    category: 'social',
    title: 'What makes someone tap',
    pitch:
      "Three faces. One word. A shocked expression. A bright yellow border. Why this works. Why your video gets ignored without it.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'posting-cadence',
    number: '33',
    category: 'social',
    title: 'AI as your producer',
    pitch:
      "Post daily without losing your mind. Plan a week of content in 30 minutes. The chore part becomes the AI part.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'spotting-trends',
    number: '34',
    category: 'social',
    title: 'Spot a trend before it’s dead',
    pitch:
      "By the time a sound is on your For You page, it's already late. AI can read the early signal — if you ask it the right thing.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'honesty-line',
    number: '35',
    category: 'social',
    title: 'The honesty line',
    pitch:
      "What do you have to disclose when AI helped? What's just craft? The rules are forming right now — let's get ahead of them.",
    status: 'coming-soon',
    prompt: null,
  },

  // -------------------------------------------------------------------------
  // BUILD — the layer above using AI: making things with it.
  // -------------------------------------------------------------------------
  {
    id: 'claude-desktop',
    number: '36',
    category: 'build',
    title: 'Claude on your computer',
    pitch:
      "Not a browser tab. An actual app that reads your files, runs your code, and remembers what you're working on. This is the future of using AI.",
    status: 'coming-soon',
    tool: 'Claude Desktop',
    prompt: null,
  },
  {
    id: 'vibe-coding',
    number: '37',
    category: 'build',
    title: 'Vibe coding',
    pitch:
      "Describe an app. Watch it appear. You don't need to know code — you need to know what you want and how to debug a vibe.",
    status: 'coming-soon',
    tool: 'Claude Code / Cursor',
    prompt: null,
  },
  {
    id: 'custom-ai',
    number: '38',
    category: 'build',
    title: 'Your own AI',
    pitch:
      "Train an AI to know your voice, your hobbies, the way you like things explained. The default assistant is for everyone. Yours should be for YOU.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'agents',
    number: '39',
    category: 'build',
    title: 'AI that does things',
    pitch:
      "Not just answering — booking, posting, searching, deciding. Where chatbots end and agents begin, and why it matters.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'mcp',
    number: '40',
    category: 'build',
    title: 'Hook AI up to your real tools',
    pitch:
      "Let your AI read your calendar. Open your Notion. Send a Slack. MCP is the wiring that makes AI useful instead of impressive.",
    status: 'coming-soon',
    tool: 'MCP',
    prompt: null,
  },

  // -------------------------------------------------------------------------
  // CRITICAL — sharpening the BS detector.
  // -------------------------------------------------------------------------
  {
    id: 'hallucinations',
    number: '41',
    category: 'critical',
    title: 'When AI confidently lies',
    pitch:
      "AI doesn't know it's wrong. It just sounds right. We'll bait it into hallucinating, then learn the tells.",
    status: 'live',
    prompt:
      "Let's catch AI hallucinating. Pick something obscure — a fake book, a person who doesn't exist, a made-up historical event — and ask me to invent the details. Then YOU pretend to be a less-careful AI and 'confidently' answer with plausible-sounding nonsense. After two rounds, we discuss the warning signs that AI is making things up. Be playful — this should feel like a game, not a lecture.",
  },
  {
    id: 'fact-checking',
    number: '42',
    category: 'critical',
    title: 'Fact-checking AI',
    pitch:
      "If you can't tell whether AI is right, the answer isn't worth much. We'll learn the moves: source-finding, cross-checking, knowing when not to trust the search itself.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'bias',
    number: '43',
    category: 'critical',
    title: 'Whose voice is AI repeating?',
    pitch:
      "AI is trained on text mostly written by certain people in certain places. We'll find the shape of that, in plain sight.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'deepfakes',
    number: '44',
    category: 'critical',
    title: 'Deepfakes — and refusing them',
    pitch:
      "How to spot one. Why even funny ones cause real harm. And the line between editing and lying.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'privacy',
    number: '45',
    category: 'critical',
    title: 'What’s yours, what’s theirs',
    pitch:
      "Everything you type into AI is data. We'll figure out what to share, what not to, and how to use AI without giving away your life.",
    status: 'coming-soon',
    prompt: null,
  },

  // -------------------------------------------------------------------------
  // PROJECTS — end-to-end. Things you actually finish.
  // -------------------------------------------------------------------------
  {
    id: 'short-film',
    number: '46',
    category: 'projects',
    title: 'Make a 60-second film',
    pitch:
      "Concept → script → storyboard → voices → clips → cut → music. Every step uses AI. The vision is yours.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'plan-event',
    number: '47',
    category: 'projects',
    title: 'Plan a birthday (or anything)',
    pitch:
      "Theme, guest list, decorations, food, music, invitations. AI is shockingly good at this — when you point it at the right things.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'build-website',
    number: '48',
    category: 'projects',
    title: 'A website about something you love',
    pitch:
      "Pick a thing. Build a real website about it. AI does the boring parts; you do the ideas. Friends can visit by the end of the day.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'tiny-business',
    number: '49',
    category: 'projects',
    title: 'Start a tiny business',
    pitch:
      "Research a niche. Brand it. Make the first sale. AI gives you the unfair advantage adults pay consultants for.",
    status: 'coming-soon',
    prompt: null,
  },
  {
    id: 'teach-the-ai',
    number: '50',
    category: 'projects',
    title: 'Teach Echo something',
    pitch:
      "You know things AI doesn't. The skill — the cousin, the inside joke, the local secret. Teach it. That's a real lesson.",
    status: 'coming-soon',
    prompt: null,
  },
];

// Stable lookup by id
export const SKILL_BY_ID = new Map(SKILL_LESSONS.map((s) => [s.id, s]));

// Convenience filters
export const LIVE_SKILLS = SKILL_LESSONS.filter((s) => s.status === 'live');
export const FOUNDATIONS_SKILLS = SKILL_LESSONS.filter(
  (s) => s.category === 'foundations'
);

// Match a free-text first user message back to its skill id.
// We use the first ~60 chars of each opening prompt as a stable signature
// (whitespace-normalised). This avoids whole-string equality being broken by
// trailing punctuation or transport-layer trimming. Only live modules have
// prompts; coming-soon modules are skipped automatically.
const SIGNATURE_LEN = 60;
const skillSignatures: Array<{ id: string; sig: string }> = SKILL_LESSONS
  .filter((s): s is SkillLesson & { prompt: string } => Boolean(s.prompt))
  .map((s) => ({
    id: s.id,
    sig: s.prompt.replace(/\s+/g, ' ').trim().slice(0, SIGNATURE_LEN).toLowerCase(),
  }));

export function detectSkillFromMessage(message: string): string | null {
  if (!message) return null;
  const normalised = message.replace(/\s+/g, ' ').trim().toLowerCase();
  for (const { id, sig } of skillSignatures) {
    if (normalised.startsWith(sig)) return id;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Difficulty ramp — every module sits on a 1→4 beginner→expert spine.
// Used to (a) tier-sort within each category on /skills, (b) tag the tile,
// and (c) compute a fuzzy "level" for the kid on the dashboard.
//
// Kept as a separate map so the curriculum array above stays readable. If
// you add a new module, add its tier here too — `skillTier()` falls back to
// tier 2 for safety, but a missing tier is a bug.
// ---------------------------------------------------------------------------
export type SkillTier = 1 | 2 | 3 | 4;

export const TIER_LABELS: Record<SkillTier, string> = {
  1: 'Beginner',
  2: 'Intermediate',
  3: 'Advanced',
  4: 'Expert',
};

const SKILL_TIERS: Record<string, SkillTier> = {
  // Foundations — entry layer.
  perception: 1, reasoning: 1, learning: 1, interaction: 1, impact: 1,
  // Talking to AI — meta-skill, ramps up.
  'prompt-craft': 1, iterating: 2, formatting: 2, 'few-shot': 3, 'thinking-out-loud': 3,
  // Image.
  'image-from-words': 1, 'character-consistency': 3, 'style-mood': 2, 'photo-editing': 3, 'real-vs-ai': 2,
  // Video.
  'video-from-sentence': 2, storyboarding: 3, 'talking-heads': 3, 'music-video': 4, cinematics: 4,
  // Audio.
  'ai-voices': 2, 'voice-cloning': 3, 'ai-music': 2, 'sound-design': 2, 'voice-agents': 3,
  // Productivity.
  'emails-like-you': 1, 'studying-with-ai': 1, summarising: 1, notes: 2, research: 2,
  // Social.
  captions: 2, thumbnails: 2, 'posting-cadence': 3, 'spotting-trends': 3, 'honesty-line': 2,
  // Build.
  'claude-desktop': 3, 'vibe-coding': 4, 'custom-ai': 3, agents: 4, mcp: 4,
  // Critical thinking.
  hallucinations: 1, 'fact-checking': 2, bias: 2, deepfakes: 3, privacy: 2,
  // Projects.
  'short-film': 4, 'plan-event': 2, 'build-website': 3, 'tiny-business': 4, 'teach-the-ai': 1,
};

export function skillTier(id: string): SkillTier {
  return SKILL_TIERS[id] ?? 2;
}

// Translate a kid's count of completed lessons into the tier label they
// currently belong to. Used for the headline on /skills and dashboard.
// Thresholds are deliberately gentle — every milestone should feel like a
// small graduation, not a grind.
export function tierForProgress(completed: number): {
  tier: SkillTier;
  label: string;
  blurb: string;
} {
  if (completed >= 40) return { tier: 4, label: 'Expert', blurb: 'You’ve seen most of it. The frontier is yours.' };
  if (completed >= 25) return { tier: 3, label: 'Advanced', blurb: 'You’re past the basics. Real fluency.' };
  if (completed >= 10) return { tier: 2, label: 'Intermediate', blurb: 'You’ve got the moves. Now widen them.' };
  if (completed >= 1) return { tier: 1, label: 'Beginner', blurb: 'Off the start line. Keep going.' };
  return { tier: 1, label: 'Not started', blurb: 'Pick any beginner module — they all stand alone.' };
}
