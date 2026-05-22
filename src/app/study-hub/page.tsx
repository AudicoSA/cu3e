"use client";

import Image from "next/image";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import VoiceTalk from "../components/VoiceTalk";
import TalkToEchoFab from "../components/TalkToEchoFab";
import Screensaver from "../components/Screensaver";
import CameraCapture from "../components/CameraCapture";
import { useVoiceAugment } from "@/hooks/useVoiceAugment";
import { useWakeWord } from "@/hooks/useWakeWord";

type Child = {
  id: string;
  first_name: string;
  age: number | null;
  grade: string | null;
};

type CurriculumDoc = {
  id: string;
  filename: string;
  storage_path: string;
  is_active: boolean;
  child_id: string;
};

type LibraryPack = {
  id: string;
  region: string;
  grade: string | null;
  subject: string;
  title: string;
  description: string | null;
  storage_path: string;
  source_attribution: string | null;
};

type Mode = "tutor" | "storybook" | "skills" | "reading";

const CHILD_STORAGE_KEY = "cu3e.selectedChildId";
const MODE_STORAGE_KEY = "cu3e.mode";
// Per (child × storybook) so the kid can resume the same story they were
// writing yesterday. Tutor/skills stay ephemeral on purpose — homework
// resumption is its own decision and AI Skills lessons are meant to be
// short, fresh sessions.
const storybookChatKey = (childId: string) => `cu3e.lastChat:${childId}:storybook`;

const TUTOR_INTRO = {
  title: "Tutor mode",
  body: "Drop a homework PDF in the sidebar, or just type what you're stuck on. Echo will help you think — not hand over the answer.",
  prompts: [
    "Help me with my Patterns homework",
    "I don't get this problem",
    "Quiz me on what I just read",
  ],
};

const STORYBOOK_INTRO = {
  title: "Storybook mode",
  body: "You're the author. Echo's your sidekick. Tell me what kind of story you want to write — or just give me a character and we'll start.",
  prompts: [
    "Write a story about a dragon who's scared of broccoli",
    "Help me make a mystery in a school cafeteria",
    "A robot wakes up in a forest. What happens?",
  ],
};

const SKILLS_INTRO = {
  title: "AI Skills",
  body: "Pick a topic from the Skills page, or ask Echo anything about how AI actually works.",
  prompts: [
    "How does AI guess what's in a picture?",
    "Why does AI sometimes make stuff up?",
    "Show me an example of AI being wrong",
  ],
};

const READING_INTRO = {
  title: "Reading mode",
  body: "Read a passage out loud (turn on the mic). Echo listens, helps with hard words, and checks you understood. Paste any text or read from your homework PDF.",
  prompts: [
    "I want to read from my book",
    "Help me read this paragraph",
    "I need to practise reading aloud",
  ],
};

const INTROS: Record<Mode, typeof TUTOR_INTRO> = {
  tutor: TUTOR_INTRO,
  storybook: STORYBOOK_INTRO,
  skills: SKILLS_INTRO,
  reading: READING_INTRO,
};

export default function StudyHub() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // Children + selection
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("tutor");

  // Documents for current child
  const [documents, setDocuments] = useState<CurriculumDoc[]>([]);
  // Upload + extraction state. "uploading" = Supabase upload in flight,
  // "extracting" = Claude reading the PDF, "ready" = saved + extracted.
  // Both phases share one drop-zone status banner.
  const [uploadStage, setUploadStage] = useState<
    'idle' | 'uploading' | 'extracting' | 'ready' | 'error'
  >('idle');
  const [uploadFilename, setUploadFilename] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progress bar at top of chat. The "active" doc is the most recent one;
  // we compare distinct correct-answer rows against its question_count.
  const [progress, setProgress] = useState<{ answered: number; total: number; docFilename: string } | null>(null);

  // Share-to-library modal: when non-null, opens the form for that doc.
  const [shareDoc, setShareDoc] = useState<CurriculumDoc | null>(null);

  // Voice-augment mode: kid can talk OR type. When ON, Echo's text turns are
  // spoken aloud, and the mic is continuously transcribing into the input.
  const [voiceAugmentOn, setVoiceAugmentOn] = useState(false);

  // Curriculum library (shared catalog)
  const [library, setLibrary] = useState<LibraryPack[]>([]);
  const [activatingId, setActivatingId] = useState<string | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  const urlMode = searchParams?.get("mode");
  const urlPrompt = searchParams?.get("prompt");
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);

  useEffect(() => {
    if (urlMode === "tutor" || urlMode === "storybook" || urlMode === "skills" || urlMode === "reading") {
      setMode(urlMode);
    } else {
      const storedMode = (typeof window !== "undefined" && localStorage.getItem(MODE_STORAGE_KEY)) as Mode | null;
      if (storedMode === "tutor" || storedMode === "storybook" || storedMode === "skills" || storedMode === "reading") setMode(storedMode);
    }
    if (urlPrompt) setPendingPrompt(urlPrompt);
    if (urlMode || urlPrompt) {
      router.replace("/study-hub");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load children
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("children")
        .select("id, first_name, age, grade")
        .eq("parent_id", user.id)
        .order("created_at", { ascending: true });
      if (cancelled || !data) return;
      const list = data as Child[];
      setChildren(list);

      const stored = typeof window !== "undefined" ? localStorage.getItem(CHILD_STORAGE_KEY) : null;
      const found = stored && list.find((c) => c.id === stored);
      setSelectedChildId(found ? found.id : list[0]?.id ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Load documents
  useEffect(() => {
    if (!selectedChildId) {
      setDocuments([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("curriculum_documents")
        .select("id, filename, storage_path, is_active, child_id")
        .eq("child_id", selectedChildId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      setDocuments((data as CurriculumDoc[]) || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, selectedChildId]);

  // Per-curriculum progress: distinct correct answers for the most-recent
  // active doc. The grader writes rows server-side after each child reply,
  // so we re-fetch a few times after each user message to catch the result.
  const fetchProgress = useCallback(async () => {
    if (!selectedChildId) {
      setProgress(null);
      return;
    }
    const { data: docs } = await supabase
      .from('curriculum_documents')
      .select('id, filename, question_count')
      .eq('child_id', selectedChildId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1);
    const activeDoc = (docs as { id: string; filename: string; question_count: number | null }[] | null)?.[0];
    if (!activeDoc || !activeDoc.question_count) {
      setProgress(null);
      return;
    }
    const { count } = await supabase
      .from('curriculum_progress')
      .select('id', { count: 'exact', head: true })
      .eq('child_id', selectedChildId)
      .eq('curriculum_document_id', activeDoc.id);
    setProgress({
      answered: count ?? 0,
      total: activeDoc.question_count,
      docFilename: activeDoc.filename,
    });
  }, [supabase, selectedChildId]);

  useEffect(() => {
    void fetchProgress();
  }, [fetchProgress, documents.length]);

  // Load the curriculum library catalogue once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("curriculum_library")
        .select("id, region, grade, subject, title, description, storage_path, source_attribution")
        .eq("is_published", true)
        .order("region", { ascending: true });
      if (cancelled || !data) return;
      setLibrary(data as LibraryPack[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  // Open the share modal for a given doc; submission lives in ShareModal.
  const promoteDocToLibrary = useCallback((doc: CurriculumDoc) => {
    setShareDoc(doc);
  }, []);

  // Called by ShareModal once promotion succeeds — refresh the library list.
  const refreshLibrary = useCallback(async () => {
    const { data } = await supabase
      .from("curriculum_library")
      .select("id, region, grade, subject, title, description, storage_path, source_attribution")
      .eq("is_published", true)
      .order("region", { ascending: true });
    if (data) setLibrary(data as LibraryPack[]);
  }, [supabase]);

  // Activate a library pack — copies the metadata into curriculum_documents
  // pointing at the shared storage path. Then refreshes the active documents.
  const activateLibraryPack = useCallback(
    async (pack: LibraryPack) => {
      if (!selectedChildId || activatingId) return;
      // Skip if already active for this child
      if (documents.some((d) => d.storage_path === pack.storage_path)) return;

      setActivatingId(pack.id);
      try {
        const filename = `${pack.region} · ${pack.grade ? pack.grade + " · " : ""}${pack.title}.pdf`;
        const { error: insErr } = await supabase.from("curriculum_documents").insert({
          child_id: selectedChildId,
          filename,
          storage_path: pack.storage_path,
          is_active: true,
        });
        if (insErr) throw insErr;

        const { data } = await supabase
          .from("curriculum_documents")
          .select("id, filename, storage_path, is_active, child_id")
          .eq("child_id", selectedChildId)
          .eq("is_active", true)
          .order("created_at", { ascending: false });
        if (data) setDocuments(data as CurriculumDoc[]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[library] activation failed:", msg);
        alert("Couldn't add this pack: " + msg);
      } finally {
        setActivatingId(null);
      }
    },
    [supabase, selectedChildId, activatingId, documents]
  );

  const onChooseChild = useCallback((id: string) => {
    setSelectedChildId(id);
    if (typeof window !== "undefined") localStorage.setItem(CHILD_STORAGE_KEY, id);
  }, []);
  const onChooseMode = useCallback((m: Mode) => {
    setMode(m);
    if (typeof window !== "undefined") localStorage.setItem(MODE_STORAGE_KEY, m);
  }, []);

  // chatId is the conversation id for the active chat. For storybook we
  // persist it per child in localStorage so kids resume their in-progress
  // story; for tutor/skills it stays ephemeral.
  const [chatId, setChatId] = useState("");
  useEffect(() => {
    if (!selectedChildId) {
      setChatId("");
      return;
    }
    if (mode === "storybook" && typeof window !== "undefined") {
      const key = storybookChatKey(selectedChildId);
      const stored = localStorage.getItem(key);
      if (stored) {
        setChatId(stored);
        return;
      }
      const fresh = `${selectedChildId}-storybook-${crypto.randomUUID()}`;
      localStorage.setItem(key, fresh);
      setChatId(fresh);
      return;
    }
    setChatId(`${selectedChildId}-${mode}-${crypto.randomUUID()}`);
  }, [selectedChildId, mode]);

  const startNewStorybook = useCallback(() => {
    if (!selectedChildId) return;
    const fresh = `${selectedChildId}-storybook-${crypto.randomUUID()}`;
    if (typeof window !== "undefined") {
      localStorage.setItem(storybookChatKey(selectedChildId), fresh);
    }
    setChatId(fresh);
  }, [selectedChildId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => ({
          childId: selectedChildId ?? undefined,
          mode,
        }),
      }),
    [selectedChildId, mode]
  );

  const { messages, sendMessage, status, error, setMessages } = useChat({
    id: chatId,
    transport,
  });

  useEffect(() => {
    setMessages([]);
    setSceneImages({});
    if (!chatId || mode !== "storybook") return;

    // Resume a stored storybook conversation: restore the message thread
    // and hydrate scene images via signed URLs for the storage objects
    // saved by /api/story-image. Tutor/skills don't have scenes; their
    // chatId is fresh each mount so this fetch would return nothing.
    let cancelled = false;
    (async () => {
      const { data: rows } = await supabase
        .from("chat_messages")
        .select("id, role, content, storybook_image_path, created_at")
        .eq("conversation_id", chatId)
        .order("created_at", { ascending: true });
      if (cancelled || !rows || rows.length === 0) return;

      type Row = {
        id: string;
        role: "user" | "assistant";
        content: string;
        storybook_image_path: string | null;
      };
      const typed = rows as Row[];

      const restored: UIMessage[] = typed.map((r) => ({
        id: r.id,
        role: r.role,
        parts: [{ type: "text", text: r.content }],
      }));
      setMessages(restored);

      const withImages = typed.filter(
        (r) => r.role === "assistant" && r.storybook_image_path
      );
      if (withImages.length === 0) return;

      const signed = await Promise.all(
        withImages.map(async (r) => {
          const { data } = await supabase.storage
            .from("story-images")
            .createSignedUrl(r.storybook_image_path!, 60 * 60);
          return { id: r.id, url: data?.signedUrl ?? null };
        })
      );
      if (cancelled) return;
      setSceneImages((prev) => {
        const next = { ...prev };
        for (const { id, url } of signed) {
          if (url) next[id] = url;
        }
        return next;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [chatId, mode, supabase, setMessages]);

  const [sceneImages, setSceneImages] = useState<Record<string, "loading" | "error" | string>>({});

  const [input, setInput] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isLoading = status === "submitted" || status === "streaming";

  // ---------------------------------------------------------------------
  // Kiosk-bedside trio (#21 FAB, #22 wake word, #23 screensaver)
  // Wake-word is opt-in (localStorage). Screensaver is on by default but
  // auto-disables while voice or chat is busy. The three coordinate so
  // saying "Echo" pops voice mode whether the screen is awake or saving.
  // ---------------------------------------------------------------------
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [screensaverActive, setScreensaverActive] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setWakeWordEnabled(localStorage.getItem("cu3e.wakeWord") === "on");
  }, []);

  const toggleWakeWord = useCallback(() => {
    setWakeWordEnabled((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("cu3e.wakeWord", next ? "on" : "off");
      }
      return next;
    });
  }, []);

  // When the wake word fires, pop voice mode and dismiss the screensaver
  // if it was up. We also suppress the listener while voice modal is open
  // so EL's own mic capture isn't fighting Web Speech for the device.
  const onWakeWord = useCallback(() => {
    setScreensaverActive(false);
    setVoiceOpen(true);
  }, []);

  useWakeWord({
    enabled: wakeWordEnabled && !voiceOpen,
    keyword: "echo",
    onWake: onWakeWord,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sceneImages]);

  // Refetch the in-chat progress bar whenever Echo finishes a reply in
  // tutor mode. Grader runs in parallel with the stream so by this point it
  // has usually saved. We also refetch after a 4s grace in case Haiku was
  // slow to grade.
  useEffect(() => {
    if (mode !== 'tutor') return;
    if (isLoading) return;
    if (messages.length === 0) return;
    void fetchProgress();
    const t = window.setTimeout(() => void fetchProgress(), 4000);
    return () => window.clearTimeout(t);
  }, [isLoading, mode, messages.length, fetchProgress]);

  const selectedChild = children.find((c) => c.id === selectedChildId) ?? null;

  // Storybook image gen
  useEffect(() => {
    if (mode !== "storybook") return;
    if (status === "streaming" || status === "submitted") return;
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    if (sceneImages[lastAssistant.id]) return;

    const scene = lastAssistant.parts
      ? lastAssistant.parts
          .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
          .map((p) => p.text)
          .join("")
      : "";
    if (!scene.trim()) return;

    const storySoFar = messages
      .filter((m) => m.id !== lastAssistant.id)
      .map((m) =>
        m.parts
          ?.filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
          .map((p) => p.text)
          .join("") ?? ""
      )
      .join("\n");

    setSceneImages((prev) => ({ ...prev, [lastAssistant.id]: "loading" }));

    fetch("/api/story-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scene,
        storySoFar,
        age: selectedChild?.age ?? null,
        mode: "storybook",
        // Tag the image with the chat conversation so we can group scenes
        // later in a gallery / revisit-stories view.
        conversationId: chatId,
      }),
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`status ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (typeof data?.image === "string") {
          setSceneImages((prev) => ({ ...prev, [lastAssistant.id]: data.image }));
        } else {
          setSceneImages((prev) => ({ ...prev, [lastAssistant.id]: "error" }));
        }
      })
      .catch((err) => {
        console.warn("[storybook] image gen failed:", err);
        setSceneImages((prev) => ({ ...prev, [lastAssistant.id]: "error" }));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, status, mode]);

  const send = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading || !selectedChildId) return;
      sendMessage({ text });
      setInput("");
    },
    [isLoading, selectedChildId, sendMessage]
  );

  // Voice-augment: hands-free conversation alongside the text chat. Echo's
  // turns are spoken aloud as they stream; the kid's mic is continuously
  // transcribed into the input and auto-submitted on pause.
  useVoiceAugment({
    enabled: voiceAugmentOn,
    messages,
    isLoading,
    onInterim: (text) => setInput(text),
    onUserSpeech: (text) => send(text),
  });

  // Auto-send launch prompt
  useEffect(() => {
    if (!pendingPrompt) return;
    if (!selectedChildId) return;
    if (messages.length > 0) return;
    send(pendingPrompt);
    setPendingPrompt(null);
  }, [pendingPrompt, selectedChildId, messages.length, send]);

  // Auto-grade the conversation once it has enough turns. Server enforces
  // uniqueness on conversation_id, so this is safe to fire more than once —
  // we still gate locally to avoid wasted POSTs.
  const gradedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!chatId || gradedRef.current.has(chatId)) return;
    const userTurns = messages.filter((m) => m.role === "user").length;
    if (userTurns < 3) return; // need a few exchanges before grading is meaningful
    if (status !== "ready") return; // wait until streaming is done
    gradedRef.current.add(chatId);
    void fetch("/api/grade-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: chatId }),
    }).catch((err) => console.warn("[grade-session] fire-and-forget failed:", err));
  }, [chatId, messages, status]);

  const handleFileUpload = async (file: File) => {
    if (!selectedChildId) {
      alert("Pick a child first.");
      return;
    }
    const acceptedTypes: Record<string, string> = {
      "application/pdf": "pdf",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
    };
    const ext = file ? acceptedTypes[file.type] : undefined;
    if (!file || !ext) {
      alert("Please upload a PDF or a photo (JPG/PNG/WebP).");
      return;
    }

    setUploadFilename(file.name);
    setUploadStage('uploading');
    let insertedId: string | null = null;
    try {
      const fileName = `${selectedChildId}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("curriculum")
        .upload(fileName, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: inserted, error: dbError } = await supabase
        .from("curriculum_documents")
        .insert({
          child_id: selectedChildId,
          filename: file.name,
          storage_path: fileName,
          is_active: true,
        })
        .select("id")
        .single();
      if (dbError) throw dbError;
      insertedId = inserted?.id ?? null;

      // Refresh the sidebar list immediately so the new doc appears.
      const { data } = await supabase
        .from("curriculum_documents")
        .select("id, filename, storage_path, is_active, child_id")
        .eq("child_id", selectedChildId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (data) setDocuments(data as CurriculumDoc[]);

      // Now run extraction with the user watching. We poll for completion
      // by awaiting the extract-pdf endpoint directly (it only returns after
      // Claude has saved the text). Roughly 10-30s for typical homework PDFs.
      if (insertedId) {
        setUploadStage('extracting');
        const res = await fetch("/api/extract-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document_id: insertedId }),
        });
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          throw new Error(errBody.error || `extract failed (${res.status})`);
        }
        setUploadStage('ready');
        // Linger on "ready" for a moment so the user actually sees it.
        setTimeout(() => setUploadStage('idle'), 2500);
      } else {
        setUploadStage('idle');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      console.error(err);
      setUploadStage('error');
      alert("Upload failed: " + msg);
      setTimeout(() => setUploadStage('idle'), 4000);
    }
  };

  const renderText = (m: UIMessage) =>
    m.parts
      ? m.parts
          .filter((p): p is Extract<typeof p, { type: "text" }> => p.type === "text")
          .map((p) => p.text)
          .join("")
      : "";

  const intro = INTROS[mode];

  return (
    <section className="container" style={{ padding: "56px 0 96px", minHeight: "88vh", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
          flexWrap: "wrap",
          paddingBottom: 32,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <span className="eyebrow">Study Hub</span>
          <h1 className="h-section" style={{ marginTop: 12, fontSize: "clamp(32px, 4vw, 48px)" }}>
            {mode === "tutor" && (
              <>Build, <span className="serif-italic accent">don&apos;t copy.</span></>
            )}
            {mode === "storybook" && (
              <>Make something, <span className="serif-italic accent">together.</span></>
            )}
            {mode === "skills" && (
              <>How AI <span className="serif-italic accent">actually works.</span></>
            )}
            {mode === "reading" && (
              <>Read it <span className="serif-italic accent">out loud.</span></>
            )}
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          {children.length > 1 && selectedChildId && (
            <select
              value={selectedChildId}
              onChange={(e) => onChooseChild(e.target.value)}
              className="field"
              style={{ maxWidth: 200, padding: "10px 12px", fontSize: 14, background: "var(--surface)" }}
              aria-label="Choose child"
            >
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.first_name}
                  {typeof c.age === "number" ? ` · ${c.age}` : ""}
                </option>
              ))}
            </select>
          )}

          <ModeToggle mode={mode} onChange={onChooseMode} />
        </div>
      </div>

      <VoiceTalk
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        childId={selectedChildId}
      />

      <ShareModal
        doc={shareDoc}
        onClose={() => setShareDoc(null)}
        onPromoted={refreshLibrary}
      />

      {/* Floating "Talk to Echo" — visible regardless of scroll, the
          existing header button gets pushed out of view mid-session. */}
      <TalkToEchoFab
        onPress={() => setVoiceOpen(true)}
        disabled={!selectedChildId}
        hidden={voiceOpen || screensaverActive}
      />

      {/* Bedside-companion screensaver. Idle-triggered, exits on tap or
          when the wake word fires (handled in onWakeWord above). */}
      <Screensaver
        enabled={!!selectedChildId}
        active={screensaverActive}
        onActiveChange={setScreensaverActive}
        busy={isLoading || voiceOpen || cameraOpen}
        wakeWordArmed={wakeWordEnabled}
      />

      {/* Tablet camera viewfinder — kid snaps a homework worksheet, the
          captured JPEG flows through the existing handleFileUpload pipe
          (same code path as a dropped PDF, same Claude extraction). */}
      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file) => void handleFileUpload(file)}
      />

      {/* Body */}
      <div
        className="hub-body"
        style={{
          marginTop: 32,
          flex: 1,
          display: "grid",
          gridTemplateColumns: mode === "tutor" ? "minmax(0, 1fr) minmax(0, 2fr)" : "minmax(0, 1fr)",
          gap: 20,
        }}
      >
        {mode === "tutor" && (
          <Sidebar
            documents={documents}
            uploadStage={uploadStage}
            uploadFilename={uploadFilename}
            fileInputRef={fileInputRef}
            onPickFile={() => fileInputRef.current?.click()}
            onPickPhoto={() => setCameraOpen(true)}
            onFileChange={(f) => f && handleFileUpload(f)}
            library={library}
            activatingId={activatingId}
            onActivate={activateLibraryPack}
            onPromote={promoteDocToLibrary}
          />
        )}

        {/* Chat */}
        <section
          className="chat"
          style={{ maxHeight: "78vh", padding: 0 }}
        >
          {/* Header */}
          <div className="chat-header" style={{ padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <div className="avatar">
              <Image src="/echo.png" alt="Echo" fill sizes="36px" style={{ objectFit: "cover" }} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="chat-name">
                Echo · {mode === "tutor" ? "tutor" : mode === "storybook" ? "story partner" : mode === "reading" ? "reading coach" : "AI guide"}
                {selectedChild ? ` for ${selectedChild.first_name}` : ""}
              </div>
              <div className="chat-sub" style={{ marginTop: 2 }}>
                {isLoading ? "Thinking…" : "Ready"}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setVoiceAugmentOn((v) => !v)}
              title={
                voiceAugmentOn
                  ? "Voice mode ON — Echo speaks, mic listens. Tap to turn off."
                  : "Voice mode OFF — tap to let Echo speak and the mic listen."
              }
              aria-label={voiceAugmentOn ? "Disable voice mode" : "Enable voice mode"}
              aria-pressed={voiceAugmentOn}
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                border: `1px solid ${voiceAugmentOn ? "var(--violet)" : "var(--border-strong)"}`,
                background: voiceAugmentOn ? "var(--violet)" : "transparent",
                color: voiceAugmentOn ? "#0a0b10" : "var(--ink-muted)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                <line x1="12" y1="19" x2="12" y2="23" />
                <line x1="8" y1="23" x2="16" y2="23" />
              </svg>
            </button>
            <button
              type="button"
              onClick={toggleWakeWord}
              title={
                wakeWordEnabled
                  ? `Wake word ON — say "Echo" to start a voice call. Tap to disable.`
                  : `Wake word OFF — tap to enable hands-free start (say "Echo" anywhere).`
              }
              aria-label={wakeWordEnabled ? "Disable wake word" : "Enable wake word"}
              aria-pressed={wakeWordEnabled}
              style={{
                width: 40,
                height: 40,
                borderRadius: 999,
                border: `1px solid ${wakeWordEnabled ? "var(--cyan)" : "var(--border-strong)"}`,
                background: wakeWordEnabled ? "var(--cyan)" : "transparent",
                color: wakeWordEnabled ? "#0a0b10" : "var(--ink-muted)",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: "0.04em",
                transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
              }}
            >
              E
            </button>
            {mode === "storybook" && messages.length > 0 && (
              <button
                type="button"
                onClick={startNewStorybook}
                title="Save this story for later and start a fresh one"
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: "8px 12px" }}
              >
                + New story
              </button>
            )}
            <span className="pill">
              <span
                className="dot"
                style={
                  voiceAugmentOn
                    ? { background: "var(--violet)", boxShadow: "0 0 0 4px rgba(138,107,255,0.18)" }
                    : isLoading
                      ? { background: "var(--amber)", boxShadow: "0 0 0 4px rgba(240,179,64,0.15)" }
                      : undefined
                }
              />
              {voiceAugmentOn ? "Voice" : isLoading ? "Live" : "Ready"}
            </span>
          </div>

          {/* Per-curriculum progress bar — only in tutor mode with an active PDF */}
          {mode === 'tutor' && progress && progress.total > 0 && (
            <div
              style={{
                padding: "8px 20px 12px",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 10.5,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--ink-muted)",
                  }}
                >
                  Worksheet progress
                </span>
                <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                  {progress.answered} of {progress.total} done
                </span>
              </div>
              <div
                style={{
                  height: 6,
                  background: "var(--surface-2)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${Math.min(100, (progress.answered / progress.total) * 100)}%`,
                    height: "100%",
                    background: "linear-gradient(90deg, var(--violet, #8b5cf6), var(--cyan, #4ed8eb))",
                    transition: "width 600ms ease",
                  }}
                />
              </div>
            </div>
          )}

          {/* Messages */}
          <div
            className="chat-body"
            style={{
              padding: "24px 20px",
              flex: 1,
              overflowY: "auto",
              gap: 20,
            }}
          >
            {!selectedChildId ? (
              <div style={{ margin: "auto", textAlign: "center", color: "var(--ink-muted)", fontSize: 14 }}>
                No child selected. Add one in the dashboard first.
              </div>
            ) : messages.length === 0 ? (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: 440 }}>
                <p style={{ fontFamily: "var(--font-serif)", fontSize: 26, color: "var(--ink-muted)", letterSpacing: "-0.01em" }}>
                  {intro.title}
                </p>
                <p style={{ marginTop: 8, fontSize: 14, color: "var(--ink-muted)", lineHeight: 1.55 }}>
                  {intro.body}
                </p>
                <div style={{ marginTop: 20, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
                  {intro.prompts.map((p) => (
                    <button
                      key={p}
                      onClick={() => send(p)}
                      disabled={isLoading}
                      style={{
                        borderRadius: 999,
                        border: "1px solid var(--border-strong)",
                        background: "var(--surface)",
                        padding: "6px 14px",
                        fontSize: 12.5,
                        color: "var(--ink-muted)",
                        cursor: isLoading ? "not-allowed" : "pointer",
                        opacity: isLoading ? 0.5 : 1,
                        fontFamily: "var(--font-sans)",
                        transition: "color 150ms ease, border-color 150ms ease, background 150ms ease",
                      }}
                      onMouseOver={(e) => {
                        if (!isLoading) {
                          e.currentTarget.style.color = "var(--ink)";
                          e.currentTarget.style.background = "var(--surface-2)";
                        }
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.color = "var(--ink-muted)";
                        e.currentTarget.style.background = "var(--surface)";
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="bubble user">
                    {renderText(m)}
                  </div>
                ) : (
                  <div key={m.id} style={{ alignSelf: "flex-start", display: "flex", gap: 12, maxWidth: "88%" }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        boxShadow: "0 0 0 1px var(--border-strong)",
                        overflow: "hidden",
                        position: "relative",
                        flexShrink: 0,
                        marginTop: 4,
                      }}
                    >
                      <Image src="/echo.png" alt="" fill sizes="28px" style={{ objectFit: "cover" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                      {mode === "storybook" && <SceneImage state={sceneImages[m.id]} />}
                      <div className="bubble echo" style={{ maxWidth: "100%" }}>
                        {renderText(m)}
                      </div>
                    </div>
                  </div>
                )
              )
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div
            style={{
              borderTop: "1px solid var(--border)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {error && (
              <div
                style={{
                  borderRadius: 8,
                  border: "1px solid rgba(239,68,68,0.4)",
                  background: "rgba(239,68,68,0.1)",
                  color: "#fca5a5",
                  fontSize: 12,
                  padding: "8px 12px",
                }}
              >
                {error.message}
              </div>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              style={{ position: "relative" }}
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                type="text"
                disabled={isLoading || !selectedChildId}
                className="field"
                style={{ paddingRight: 48 }}
                placeholder={
                  voiceAugmentOn
                    ? "Listening… or just type."
                    : mode === "tutor"
                    ? "Pitch your idea to Echo…"
                    : mode === "storybook"
                    ? "What happens next?"
                    : mode === "reading"
                    ? "Paste a passage, or read aloud…"
                    : "Ask Echo about AI…"
                }
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim() || !selectedChildId}
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  padding: 8,
                  borderRadius: 8,
                  background: "var(--violet)",
                  color: "#0a0b10",
                  border: "none",
                  opacity: isLoading || !input.trim() || !selectedChildId ? 0.4 : 1,
                  cursor: isLoading || !input.trim() || !selectedChildId ? "not-allowed" : "pointer",
                  transition: "background 150ms ease",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="Send"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </form>
          </div>
        </section>
      </div>

      <style>{`
        @media (max-width: 920px) {
          .hub-body { grid-template-columns: 1fr !important; }
          /* On mobile the sidebar stacks above the chat. Keep it compact so
             the chat is visible without scrolling past upload + library. */
          .hub-sidebar { max-height: 320px !important; padding: 16px !important; gap: 20px !important; }
        }
      `}</style>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Subcomponents
// ---------------------------------------------------------------------------

function ShareModal({
  doc,
  onClose,
  onPromoted,
}: {
  doc: CurriculumDoc | null;
  onClose: () => void;
  onPromoted: () => void;
}) {
  const [region, setRegion] = useState<string>("CAPS");
  const [grade, setGrade] = useState<string>("");
  const [subject, setSubject] = useState<string>("Mathematics");
  const [title, setTitle] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (doc) {
      setTitle(doc.filename.replace(/\.pdf$/i, ""));
      setGrade("");
      setSubject("Mathematics");
      setRegion("CAPS");
      setDescription("");
      setError(null);
    }
  }, [doc]);

  if (!doc) return null;

  const submit = async () => {
    if (!title.trim() || !subject.trim()) {
      setError("Title and subject are required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const r = await fetch("/api/library/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          document_id: doc.id,
          region,
          grade,
          subject,
          title,
          description,
        }),
      });
      const json = await r.json();
      if (!r.ok) {
        setError(json.error ?? `Status ${r.status}`);
        return;
      }
      onPromoted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 14,
    background: "var(--surface)",
    border: "1px solid var(--border-strong)",
    borderRadius: 8,
    color: "var(--ink)",
    fontFamily: "var(--font-sans)",
  };
  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    color: "var(--ink-muted)",
    marginBottom: 6,
    fontWeight: 500,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Share to library"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(7, 8, 13, 0.7)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        zIndex: 300,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: 28,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div>
          <span className="eyebrow">Share to library</span>
          <h3 style={{ marginTop: 8, fontSize: 22, fontWeight: 600, letterSpacing: "-0.01em" }}>
            {doc.filename}
          </h3>
          <p style={{ marginTop: 6, fontSize: 13, color: "var(--ink-muted)", lineHeight: 1.5 }}>
            Make this worksheet available to other CU3E families as a one-click pack.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={labelStyle}>Region</label>
            <select value={region} onChange={(e) => setRegion(e.target.value)} style={fieldStyle}>
              <option value="CAPS">CAPS (South Africa)</option>
              <option value="CommonCore">Common Core (US)</option>
              <option value="GCSE">GCSE (UK)</option>
              <option value="IB">IB</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Grade</label>
            <input
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              placeholder="Grade 7"
              style={fieldStyle}
            />
          </div>
        </div>

        <div>
          <label style={labelStyle}>Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Mathematics"
            style={fieldStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Fractions of a group — worksheet"
            style={fieldStyle}
          />
        </div>

        <div>
          <label style={labelStyle}>One-line description (optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's on the worksheet — for other parents browsing the library."
            style={fieldStyle}
          />
        </div>

        {error && (
          <div
            style={{
              fontSize: 13,
              color: "#f87171",
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.3)",
              padding: "10px 12px",
              borderRadius: 8,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-violet"
            onClick={submit}
            disabled={submitting}
            style={{ opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? "Sharing…" : "Add to library"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  const opts: { value: Mode; label: string }[] = [
    { value: "tutor", label: "Tutor" },
    { value: "storybook", label: "Storybook" },
    { value: "skills", label: "Skills" },
    { value: "reading", label: "Reading" },
  ];
  return (
    <div
      style={{
        display: "inline-flex",
        border: "1px solid var(--border-strong)",
        background: "var(--surface)",
        padding: 3,
        borderRadius: 10,
      }}
    >
      {opts.map((o) => {
        const active = o.value === mode;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            style={{
              padding: "8px 16px",
              fontSize: 13.5,
              fontWeight: 500,
              borderRadius: 7,
              border: "none",
              transition: "background 150ms ease, color 150ms ease",
              background: active ? "var(--violet)" : "transparent",
              color: active ? "#0a0b10" : "var(--ink-muted)",
              cursor: "pointer",
            }}
            onMouseOver={(e) => {
              if (!active) e.currentTarget.style.color = "var(--ink)";
            }}
            onMouseOut={(e) => {
              if (!active) e.currentTarget.style.color = "var(--ink-muted)";
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Sidebar({
  documents,
  uploadStage,
  uploadFilename,
  fileInputRef,
  onPickFile,
  onPickPhoto,
  onFileChange,
  library,
  activatingId,
  onActivate,
  onPromote,
}: {
  documents: CurriculumDoc[];
  uploadStage: 'idle' | 'uploading' | 'extracting' | 'ready' | 'error';
  uploadFilename: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onPickFile: () => void;
  onPickPhoto: () => void;
  onFileChange: (file: File | null) => void;
  library: LibraryPack[];
  activatingId: string | null;
  onActivate: (pack: LibraryPack) => void;
  onPromote: (doc: CurriculumDoc) => void;
}) {
  const activeStoragePaths = new Set(documents.map((d) => d.storage_path));
  const busy = uploadStage === 'uploading' || uploadStage === 'extracting';

  const stageLabel =
    uploadStage === 'uploading' ? 'Uploading PDF…'
      : uploadStage === 'extracting' ? 'Echo is reading your worksheet (10–30 sec)…'
        : uploadStage === 'ready' ? 'Ready — Echo can talk about it now ✓'
          : uploadStage === 'error' ? 'Upload failed'
            : '';

  const stageColor =
    uploadStage === 'ready' ? 'var(--green, #4ade80)'
      : uploadStage === 'error' ? 'var(--red, #f87171)'
        : 'var(--ink)';

  return (
    <aside
      className="hub-sidebar"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 24,
        display: "flex",
        flexDirection: "column",
        gap: 28,
        maxHeight: "78vh",
        overflowY: "auto",
      }}
    >
      <div>
        <span className="eyebrow">Knowledge base</span>
        <p style={{ marginTop: 10, fontSize: 12.5, color: "var(--ink-muted)", lineHeight: 1.55 }}>
          Upload a worksheet — drop a PDF, or take a photo with the tablet camera.
        </p>

        <div
          style={{
            marginTop: 16,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 10,
          }}
        >
          {/* PDF drop zone — compact version */}
          <button
            type="button"
            disabled={busy}
            onClick={() => { if (!busy) onPickFile(); }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (busy) return;
              const f = e.dataTransfer.files?.[0] ?? null;
              onFileChange(f);
            }}
            style={{
              border: "1px dashed var(--border-strong)",
              borderRadius: 12,
              padding: "14px 10px",
              background: "transparent",
              color: "var(--ink)",
              textAlign: "center",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
              transition: "border-color 150ms ease, background 150ms ease",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              minHeight: 110,
              justifyContent: "center",
            }}
            onMouseOver={(e) => {
              if (!busy) {
                e.currentTarget.style.borderColor = "var(--violet)";
                e.currentTarget.style.background = "var(--surface-2)";
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "var(--border-strong)";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <input
              type="file"
              hidden
              accept=".pdf,image/jpeg,image/png,image/webp"
              ref={fileInputRef}
              onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
            />
            <UploadIcon />
            <span style={{ fontSize: 12, fontWeight: 500 }}>Drop a PDF</span>
            <span style={{ fontSize: 10.5, color: "var(--ink-muted)" }}>or browse</span>
          </button>

          {/* Take a photo — opens the in-app camera viewfinder */}
          <button
            type="button"
            disabled={busy}
            onClick={() => { if (!busy) onPickPhoto(); }}
            style={{
              border: "1px solid var(--border-strong)",
              borderRadius: 12,
              padding: "14px 10px",
              background: "var(--surface-2)",
              color: "var(--ink)",
              textAlign: "center",
              cursor: busy ? "not-allowed" : "pointer",
              opacity: busy ? 0.6 : 1,
              transition: "border-color 150ms ease, background 150ms ease, transform 150ms ease",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              minHeight: 110,
              justifyContent: "center",
            }}
            onMouseOver={(e) => {
              if (!busy) e.currentTarget.style.borderColor = "var(--violet)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "var(--border-strong)";
            }}
          >
            <CameraIcon />
            <span style={{ fontSize: 12, fontWeight: 500 }}>Take a photo</span>
            <span style={{ fontSize: 10.5, color: "var(--ink-muted)" }}>of your worksheet</span>
          </button>
        </div>

        {/* Shared status row — applies to either upload path */}
        {(busy || uploadStage === 'ready' || uploadStage === 'error') && (
          <div style={{ marginTop: 12 }}>
            <p style={{ fontSize: 12.5, fontWeight: 500, color: stageColor, margin: 0 }}>
              {stageLabel}
            </p>
            {busy && uploadFilename && (
              <p style={{ marginTop: 2, fontSize: 11, color: "var(--ink-muted)" }}>
                {uploadFilename}
              </p>
            )}
            {busy && (
              <div
                style={{
                  marginTop: 10,
                  height: 3,
                  width: "100%",
                  background: "var(--surface-2)",
                  borderRadius: 2,
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(90deg, transparent, var(--violet, #8b5cf6), transparent)",
                    animation: "uploadBarSlide 1.2s ease-in-out infinite",
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>
      <style>{`
        @keyframes uploadBarSlide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>

      <div>
        <span className="eyebrow">Active documents</span>
        <ul style={{ marginTop: 12, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
          {documents.length === 0 ? (
            <li style={{ fontSize: 12, color: "var(--ink-muted)", fontStyle: "italic" }}>
              Nothing active yet.
            </li>
          ) : (
            documents.map((doc) => (
              <li
                key={doc.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "var(--bg-elev)",
                  padding: "8px 12px",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  {doc.filename}
                </span>
                <button
                  type="button"
                  onClick={() => onPromote(doc)}
                  title="Share this worksheet to the public library so other families can use it"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--ink-muted)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 9.5,
                    letterSpacing: "0.12em",
                    padding: "2px 6px",
                    borderRadius: 4,
                    cursor: "pointer",
                  }}
                >
                  SHARE
                </button>
              </li>
            ))
          )}
        </ul>
      </div>

      {/* Curriculum library — pre-curated starter packs */}
      {library.length > 0 && (
        <div>
          <span className="eyebrow">From the library</span>
          <p style={{ marginTop: 8, fontSize: 11.5, color: "var(--ink-muted)", lineHeight: 1.5 }}>
            One-click curriculum packs Echo can teach from.
          </p>
          <ul style={{ marginTop: 12, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {library.map((pack) => {
              const active = activeStoragePaths.has(pack.storage_path);
              const busy = activatingId === pack.id;
              return (
                <li
                  key={pack.id}
                  style={{
                    borderRadius: 10,
                    border: "1px solid var(--border)",
                    background: "var(--bg-elev)",
                    padding: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "var(--ink-muted)",
                    }}
                  >
                    <span style={{ color: "var(--violet)" }}>{pack.region}</span>
                    {pack.grade && <span>· {pack.grade}</span>}
                    <span>· {pack.subject}</span>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-serif)",
                      fontSize: 15,
                      lineHeight: 1.25,
                      marginTop: 4,
                      letterSpacing: "-0.01em",
                    }}
                  >
                    {pack.title}
                  </div>
                  {pack.description && (
                    <p style={{ marginTop: 4, fontSize: 11.5, color: "var(--ink-muted)", lineHeight: 1.45 }}>
                      {pack.description}
                    </p>
                  )}
                  <button
                    onClick={() => onActivate(pack)}
                    disabled={active || busy}
                    style={{
                      marginTop: 10,
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 8,
                      border: active
                        ? "1px solid rgba(78,216,235,0.4)"
                        : "1px solid var(--border-strong)",
                      background: active ? "rgba(78,216,235,0.1)" : "transparent",
                      color: active ? "var(--cyan)" : "var(--ink)",
                      fontSize: 12,
                      fontFamily: "var(--font-sans)",
                      cursor: active || busy ? "default" : "pointer",
                      opacity: busy ? 0.6 : 1,
                      transition: "background 150ms ease, border-color 150ms ease",
                    }}
                  >
                    {active ? "Active" : busy ? "Adding…" : "+ Add to hub"}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
}

function SceneImage({ state }: { state: "loading" | "error" | string | undefined }) {
  if (!state) return null;

  if (state === "error") return null;

  if (state === "loading") {
    return (
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          borderRadius: 999,
          border: "1px solid var(--border)",
          background: "var(--surface)",
          padding: "6px 14px",
          fontSize: 11.5,
          color: "var(--ink-muted)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <span
          style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            border: "2px solid var(--border-strong)",
            borderTopColor: "var(--violet)",
            animation: "spin 1s linear infinite",
            display: "inline-block",
          }}
        />
        drawing…
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // data URL
  return (
    <div
      style={{
        width: "100%",
        maxWidth: 480,
        borderRadius: 12,
        overflow: "hidden",
        border: "1px solid var(--border)",
      }}
    >
      {/* Plain img tag because next/image won't optimize base64 data URLs */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={state} alt="Story illustration" style={{ width: "100%", height: "auto", display: "block" }} />
    </div>
  );
}

function UploadIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--ink-muted)" }}
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ color: "var(--violet)" }}
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
