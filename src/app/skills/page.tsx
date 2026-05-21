"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import {
  SKILL_LESSONS,
  SKILL_CATEGORIES,
  TIER_LABELS,
  skillTier,
  tierForProgress,
  detectSkillFromMessage,
  type SkillLesson,
  type SkillCategory,
} from "@/lib/skills";
import WaitlistModal from "./WaitlistModal";

export default function SkillsPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  // Per-family progress: a Set of lesson ids the parent's kids have engaged
  // with in the last 90 days. Aggregated across all the parent's children
  // because /skills doesn't have a child selector. (The dashboard handles
  // per-child breakdowns.)
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const [parentEmail, setParentEmail] = useState<string | undefined>(undefined);
  const [waitlistLesson, setWaitlistLesson] = useState<SkillLesson | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (cancelled || !user) return;
      setParentEmail(user.email ?? undefined);

      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      const { data: rows } = await supabase
        .from("chat_messages")
        .select("conversation_id, content, created_at")
        .eq("parent_id", user.id)
        .eq("mode", "skills")
        .eq("role", "user")
        .gte("created_at", ninetyDaysAgo.toISOString())
        .order("created_at", { ascending: true });
      if (cancelled || !rows) return;

      // First user message wins per conversation.
      const firstByConv = new Map<string, string>();
      for (const r of rows as Array<{ conversation_id: string; content: string }>) {
        if (!firstByConv.has(r.conversation_id)) firstByConv.set(r.conversation_id, r.content);
      }
      const completed = new Set<string>();
      for (const content of firstByConv.values()) {
        const id = detectSkillFromMessage(content);
        if (id) completed.add(id);
      }
      setCompletedSet(completed);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const completedCount = completedSet.size;
  const progress = tierForProgress(completedCount);
  const progressPct = (completedCount / SKILL_LESSONS.length) * 100;

  return (
    <section className="container" style={{ paddingTop: 80, paddingBottom: 96 }}>
      {/* Header */}
      <div className="meet-head" style={{ textAlign: "left", marginBottom: 32, maxWidth: 720 }}>
        <span className="eyebrow">AI Skills</span>
        <h1 className="h-section" style={{ marginTop: 16 }}>
          The stuff school <span className="serif-italic accent">isn&apos;t teaching</span> yet.
        </h1>
        <p style={{ marginTop: 20, color: "var(--ink-soft)", fontSize: 17, lineHeight: 1.6 }}>
          Fifty hands-on conversations with Echo — from how AI sees a picture, all the way to building your own assistant. Each one adapts to your child&apos;s age, and stands alone. Start anywhere.
        </p>
      </div>

      {/* Progress banner */}
      <ProgressBanner completedCount={completedCount} progressPct={progressPct} progress={progress} />

      {/* Categories */}
      <div style={{ marginTop: 56, display: "flex", flexDirection: "column", gap: 48 }}>
        {SKILL_CATEGORIES.map((cat) => (
          <CategorySection
            key={cat.id}
            category={cat}
            completedSet={completedSet}
            onWaitlist={(lesson) => setWaitlistLesson(lesson)}
          />
        ))}
      </div>

      <WaitlistModal
        lesson={waitlistLesson}
        defaultEmail={parentEmail}
        onClose={() => setWaitlistLesson(null)}
      />
    </section>
  );
}

function ProgressBanner({
  completedCount,
  progressPct,
  progress,
}: {
  completedCount: number;
  progressPct: number;
  progress: ReturnType<typeof tierForProgress>;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 24,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <span className="eyebrow">Your journey</span>
          <div style={{ marginTop: 10, display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: "var(--font-serif)",
                fontSize: 36,
                letterSpacing: "-0.02em",
                color: "var(--violet)",
                lineHeight: 1,
              }}
            >
              {completedCount}
              <span style={{ fontSize: 18, color: "var(--ink-muted)", marginLeft: 4 }}>
                of {SKILL_LESSONS.length}
              </span>
            </span>
            <span
              className="pill"
              style={{ background: "rgba(138,107,255,0.12)", borderColor: "rgba(138,107,255,0.35)" }}
            >
              {progress.label}
            </span>
          </div>
          <p style={{ marginTop: 8, fontSize: 13.5, color: "var(--ink-muted)", maxWidth: 480 }}>
            {progress.blurb}
          </p>
        </div>
      </div>
      <div
        style={{
          marginTop: 18,
          height: 8,
          background: "var(--surface-2)",
          borderRadius: 999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${Math.max(2, progressPct)}%`,
            height: "100%",
            background: "linear-gradient(90deg, var(--violet, #8a6bff), var(--cyan, #4ed8eb))",
            transition: "width 600ms ease",
          }}
        />
      </div>
    </div>
  );
}

function CategorySection({
  category,
  completedSet,
  onWaitlist,
}: {
  category: SkillCategory;
  completedSet: Set<string>;
  onWaitlist: (lesson: SkillLesson) => void;
}) {
  const lessons = useMemo(
    () =>
      SKILL_LESSONS.filter((l) => l.category === category.id).sort(
        (a, b) => skillTier(a.id) - skillTier(b.id)
      ),
    [category.id]
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        <div>
          <span
            className="eyebrow"
            style={{ color: category.accent }}
          >
            {category.label}
          </span>
          <h2
            className="h-section"
            style={{ marginTop: 8, fontSize: 24, lineHeight: 1.2 }}
          >
            {category.subtitle}
          </h2>
        </div>
        <span style={{ fontSize: 12, color: "var(--ink-muted)", fontFamily: "var(--font-mono)", letterSpacing: "0.08em" }}>
          {lessons.filter((l) => completedSet.has(l.id)).length} / {lessons.length} done
        </span>
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: 16,
        }}
      >
        {lessons.map((lesson) => (
          <SkillTile
            key={lesson.id}
            lesson={lesson}
            categoryAccent={category.accent}
            completed={completedSet.has(lesson.id)}
            onWaitlist={onWaitlist}
          />
        ))}
      </div>
    </div>
  );
}

function SkillTile({
  lesson,
  categoryAccent,
  completed,
  onWaitlist,
}: {
  lesson: SkillLesson;
  categoryAccent: string;
  completed: boolean;
  onWaitlist: (lesson: SkillLesson) => void;
}) {
  const tier = skillTier(lesson.id);
  const tierLabel = TIER_LABELS[tier];
  const isLive = lesson.status === "live";

  // Public bucket — falls back to a CSS gradient if the seed route hasn't
  // generated this tile's image yet.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const imageSrc = supabaseUrl
    ? `${supabaseUrl}/storage/v1/object/public/skill-images/${lesson.id}.png`
    : "";

  const inner = (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        border: `1px solid ${completed ? categoryAccent : "var(--border)"}`,
        borderRadius: 14,
        overflow: "hidden",
        height: "100%",
        opacity: isLive ? 1 : 0.78,
        cursor: "pointer",
        transition: "border-color 180ms ease, transform 180ms ease, opacity 180ms ease",
      }}
      className="skill-tile"
    >
      {/* Image / gradient background */}
      <div
        style={{
          position: "relative",
          aspectRatio: "4 / 3",
          background: `linear-gradient(135deg, ${categoryAccent}33, #0a0b1066)`,
          overflow: "hidden",
        }}
      >
        {imageSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageSrc}
            alt=""
            loading="lazy"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: isLive ? "none" : "grayscale(0.6) brightness(0.8)",
            }}
          />
        )}
        {!isLive && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background:
                "linear-gradient(180deg, rgba(10,11,16,0.05) 0%, rgba(10,11,16,0.7) 100%)",
            }}
          />
        )}
        {/* Top chips */}
        <div
          style={{
            position: "absolute",
            top: 10,
            left: 10,
            right: 10,
            display: "flex",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "3px 8px",
              borderRadius: 999,
              background: "rgba(10,11,16,0.6)",
              backdropFilter: "blur(4px)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "var(--ink)",
            }}
          >
            Lesson {lesson.number}
          </span>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.10em",
              padding: "3px 8px",
              borderRadius: 999,
              background: completed
                ? `${categoryAccent}33`
                : "rgba(10,11,16,0.6)",
              backdropFilter: "blur(4px)",
              border: `1px solid ${completed ? categoryAccent : "rgba(255,255,255,0.12)"}`,
              color: completed ? categoryAccent : "var(--ink-soft)",
            }}
          >
            {completed ? "Done ✓" : tierLabel}
          </span>
        </div>
        {!isLive && (
          <span
            style={{
              position: "absolute",
              left: 10,
              bottom: 10,
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              padding: "4px 10px",
              borderRadius: 999,
              background: "rgba(10,11,16,0.7)",
              border: "1px solid rgba(255,255,255,0.16)",
              color: "var(--amber)",
            }}
          >
            Coming soon
          </span>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
        <div style={{ fontFamily: "var(--font-serif)", fontSize: 21, lineHeight: 1.2, letterSpacing: "-0.01em" }}>
          {lesson.title}
        </div>
        <p
          style={{
            fontSize: 13.5,
            color: "var(--ink-soft)",
            lineHeight: 1.5,
            margin: 0,
            flex: 1,
          }}
        >
          {lesson.pitch}
        </p>
        <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          {lesson.tool ? (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10.5,
                color: "var(--ink-muted)",
                letterSpacing: "0.06em",
              }}
            >
              {lesson.tool}
            </span>
          ) : <span />}
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              color: isLive ? categoryAccent : "var(--ink-muted)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {isLive ? "Start" : "Notify me"}
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </span>
        </div>
      </div>
    </div>
  );

  if (isLive && lesson.prompt) {
    return (
      <Link
        href={`/study-hub?mode=skills&prompt=${encodeURIComponent(lesson.prompt)}`}
        style={{ textDecoration: "none", color: "inherit" }}
      >
        {inner}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onWaitlist(lesson)}
      style={{
        textAlign: "left",
        background: "transparent",
        border: "none",
        padding: 0,
        font: "inherit",
        color: "inherit",
        cursor: "pointer",
        width: "100%",
        display: "block",
      }}
    >
      {inner}
    </button>
  );
}
