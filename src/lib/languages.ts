// Multilingual support — single source of truth for which languages Echo
// speaks, the parent-facing label per language, and the system-prompt
// directive that switches Echo's output language at runtime.
//
// Adding a language is a single edit here (plus the migration's CHECK
// constraint, plus a UI option in AddChildForm). Echo's behaviour comes
// from `buildLanguageDirective` — the rest of the system prompts stay in
// English (memory brief, curriculum text, in-prompt rules) and Echo
// translates naturally at output time.

export type LanguageCode = "en" | "af" | "zu";

export const SUPPORTED_LANGUAGES: Array<{
  code: LanguageCode;
  // What parents see in the picker.
  label: string;
  // Native language name (display alongside the English label).
  native: string;
  // ISO 639-1 (matches `code`) but spelled out for the voice-agent override.
  iso: string;
  // ElevenLabs voice ID for native-sounding TTS in this language. Used by
  // /api/voice-session to override the agent's default voice when the
  // child's preferred_language isn't English. Null = use agent default.
  voiceId: string | null;
}> = [
  { code: "en", label: "English", native: "English", iso: "en", voiceId: null },
  // Charles Onselen — Kenny tested the preview and his Afrikaans accent
  // is solid (despite EL metadata listing him as "en (south african)").
  // Added to the workspace library as "Charles Onselen - Afrikaans Echo".
  { code: "af", label: "Afrikaans", native: "Afrikaans", iso: "af", voiceId: "IT5cb4lfodSX8eyXUzyO" },
  // isiZulu still null — no native isiZulu voice in EL's library yet.
  // Kenny's friend speaks Zulu and is the natural first voice-clone subject.
  { code: "zu", label: "isiZulu", native: "isiZulu", iso: "zu", voiceId: null },
];

// Voice ID for a given language code. Returns null when the agent's default
// voice should be used (English, or a language without a configured voice).
export function voiceIdForLanguage(code: LanguageCode): string | null {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code)?.voiceId ?? null;
}

export function isSupportedLanguage(code: string | null | undefined): code is LanguageCode {
  return code === "en" || code === "af" || code === "zu";
}

// Returns the language directive to prepend to a chat / voice system
// prompt. Empty string for English (the default — no extra instruction
// needed). Lives at the very top of the prompt so it's the strongest
// signal to the model.
export function buildLanguageDirective(code: LanguageCode, childName: string): string {
  if (code === "en") return "";

  if (code === "af") {
    return `LANGUAGE: ${childName} prefers Afrikaans. Speak to ${childName} in Afrikaans — natural, age-appropriate Afrikaans, not stilted textbook Afrikaans. If ${childName} switches to English mid-sentence, follow their lead and switch with them, then drift back to Afrikaans on your next reply. Bilingual code-switching is completely natural for SA kids — don't fight it. Curriculum content and your private memory notes may be in English; translate naturally as you speak.\n\n`;
  }

  if (code === "zu") {
    return `LANGUAGE: ${childName} prefers isiZulu. Speak to ${childName} in isiZulu — natural, age-appropriate isiZulu, not formal exam-paper register. Use the words and rhythms a SA family would actually use at home. If ${childName} switches to English mid-sentence (very common for SA learners), follow their lead and switch with them, then drift back to isiZulu on your next reply. Curriculum content and your private memory notes may be in English; translate naturally as you speak. For maths and technical terms with no everyday isiZulu equivalent, you may use the English word — that's how most SA learners actually talk about them.\n\n`;
  }

  return "";
}

// Short version of the language directive — for the voice-agent's first
// message and dynamic-variable contexts where space is tight.
export function buildLanguageHint(code: LanguageCode): string {
  if (code === "en") return "English";
  if (code === "af") return "Afrikaans";
  if (code === "zu") return "isiZulu";
  return "English";
}
