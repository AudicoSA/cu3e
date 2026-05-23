import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import AddChildForm from "./AddChildForm";
import WeeklyOverview from "./WeeklyOverview";
import ChildAnalytics from "./ChildAnalytics";
import NotificationsBanner, { type ParentNotification } from "./NotificationsBanner";
import CurriculumProgressCard from "./CurriculumProgressCard";
import ChildLanguagePicker from "./ChildLanguagePicker";
import { logout } from "../auth/actions";
import Link from "next/link";
import { SKILL_LESSONS, FOUNDATIONS_SKILLS, detectSkillFromMessage } from "@/lib/skills";

export default async function Dashboard() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: parentProfile } = await supabase
    .from("parents")
    .select("*")
    .eq("id", user.id)
    .single();

  const { data: children } = await supabase
    .from("children")
    .select("*")
    .eq("parent_id", user.id)
    .order("created_at", { ascending: true });

  // Recent user prompts across all of this parent's children, newest first.
  const { data: recentPrompts } = await supabase
    .from("chat_messages")
    .select("id, content, created_at, child_id, flagged, flag_reason, mode")
    .eq("parent_id", user.id)
    .eq("role", "user")
    .order("created_at", { ascending: false })
    .limit(5);

  // -----------------------------------------------------------------------
  // Analytics — last 30 days of user-side messages, aggregated locally.
  // We pull a thin projection (no content) so the query stays cheap even
  // as families accumulate history.
  // -----------------------------------------------------------------------
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const { data: analyticsRows } = await supabase
    .from("chat_messages")
    .select("child_id, created_at, mode, flagged, conversation_id")
    .eq("parent_id", user.id)
    .eq("role", "user")
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  const rows = (analyticsRows ?? []) as Array<{
    child_id: string;
    created_at: string;
    mode: string;
    flagged: boolean | null;
    conversation_id: string | null;
  }>;

  // Daily series — one bucket per calendar day for the past 30 days.
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const dailySeriesMap = new Map<string, { date: string; total: number; perChild: Record<string, number> }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dailySeriesMap.set(dayKey(d), { date: dayKey(d), total: 0, perChild: {} });
  }
  for (const r of rows) {
    const k = dayKey(new Date(r.created_at));
    const slot = dailySeriesMap.get(k);
    if (!slot) continue;
    slot.total += 1;
    slot.perChild[r.child_id] = (slot.perChild[r.child_id] ?? 0) + 1;
  }
  const dailySeries = Array.from(dailySeriesMap.values());

  // Mode breakdown
  const modeCounts = new Map<string, number>();
  const voiceConvoIds = new Set<string>();
  let refusalsCount = 0;
  const modesExploredSet = new Set<string>();
  for (const r of rows) {
    modeCounts.set(r.mode, (modeCounts.get(r.mode) ?? 0) + 1);
    if (r.mode) modesExploredSet.add(r.mode);
    if (r.flagged) refusalsCount += 1;
    if (r.mode === "voice" && r.conversation_id) voiceConvoIds.add(r.conversation_id);
  }
  const modeBreakdown = Array.from(modeCounts.entries())
    .map(([mode, count]) => ({ mode, count }))
    .sort((a, b) => b.count - a.count);

  const counters = {
    totalQuestions: rows.length,
    refusals: refusalsCount,
    modesExplored: modesExploredSet.size,
    voiceConversations: voiceConvoIds.size,
  };

  // -----------------------------------------------------------------------
  // Phase 2 — AI-graded session quality. One row per conversation_id from
  // session_grades. Aggregated for the dashboard: average score + recent
  // breakthroughs.
  // -----------------------------------------------------------------------
  const { data: gradeRows } = await supabase
    .from("session_grades")
    .select("conversation_id, mode, persistence, insight, breakthrough, summary, graded_at, child_id")
    .eq("parent_id", user.id)
    .gte("graded_at", thirtyDaysAgo.toISOString())
    .order("graded_at", { ascending: true });

  const grades = (gradeRows ?? []) as Array<{
    conversation_id: string;
    mode: string;
    persistence: number;
    insight: number;
    breakthrough: number;
    summary: string | null;
    graded_at: string;
    child_id: string;
  }>;

  let qualityAvg: number | null = null;
  let breakthroughCount = 0;
  const qualityByDay = new Map<string, { date: string; avg: number; count: number; sum: number }>();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    qualityByDay.set(dayKey(d), { date: dayKey(d), avg: 0, count: 0, sum: 0 });
  }
  if (grades.length > 0) {
    let total = 0;
    for (const g of grades) {
      const composite = (g.persistence + g.insight + g.breakthrough) / 3;
      total += composite;
      if (g.breakthrough >= 4) breakthroughCount += 1;
      const k = dayKey(new Date(g.graded_at));
      const slot = qualityByDay.get(k);
      if (slot) {
        slot.sum += composite;
        slot.count += 1;
        slot.avg = slot.sum / slot.count;
      }
    }
    qualityAvg = total / grades.length;
  }
  const qualitySeries = Array.from(qualityByDay.values()).map((s) => ({
    date: s.date,
    avg: s.count > 0 ? Number(s.avg.toFixed(2)) : null,
  }));

  const recentGrades = grades.slice(-5).reverse();

  // -----------------------------------------------------------------------
  // Per-skill progress (Five Big Ideas ladder)
  // We pull skills-mode conversations from the last 90 days, grab their
  // FIRST user message, match against known opening-prompt signatures, then
  // aggregate per skill: sessions tried, last seen, avg quality (from
  // session_grades joined by conversation_id).
  // -----------------------------------------------------------------------
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const { data: skillsRows } = await supabase
    .from("chat_messages")
    .select("conversation_id, content, created_at")
    .eq("parent_id", user.id)
    .eq("mode", "skills")
    .eq("role", "user")
    .gte("created_at", ninetyDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  // First message per conversation_id (rows come back oldest-first so the
  // first occurrence wins).
  const firstMessageByConv = new Map<string, { content: string; created_at: string }>();
  for (const r of (skillsRows ?? []) as Array<{ conversation_id: string; content: string; created_at: string }>) {
    if (!firstMessageByConv.has(r.conversation_id)) {
      firstMessageByConv.set(r.conversation_id, { content: r.content, created_at: r.created_at });
    }
  }

  // Tag each conversation with a skill_id (or null for free-form sessions)
  const conversationSkill = new Map<string, string>();
  for (const [convId, first] of firstMessageByConv.entries()) {
    const skillId = detectSkillFromMessage(first.content);
    if (skillId) conversationSkill.set(convId, skillId);
  }

  // Look up grades for these conversations (graded ones only)
  const gradesByConv = new Map(grades.map((g) => [g.conversation_id, g]));

  type SkillStat = {
    id: string;
    number: string;
    title: string;
    sessions: number;
    lastSeenIso: string | null;
    avgQuality: number | null;
  };

  // Dashboard ladder shows the 5 foundations only — the full 50-module
  // curriculum has its own overview at the top of /skills.
  const skillStats: SkillStat[] = FOUNDATIONS_SKILLS.map((lesson) => {
    const matchingConvs: string[] = [];
    for (const [convId, sid] of conversationSkill.entries()) {
      if (sid === lesson.id) matchingConvs.push(convId);
    }
    let lastSeenIso: string | null = null;
    for (const convId of matchingConvs) {
      const t = firstMessageByConv.get(convId)?.created_at ?? null;
      if (t && (!lastSeenIso || t > lastSeenIso)) lastSeenIso = t;
    }
    const gradeScores: number[] = matchingConvs
      .map((c) => gradesByConv.get(c))
      .filter((g): g is NonNullable<typeof g> => Boolean(g))
      .map((g) => (g.persistence + g.insight + g.breakthrough) / 3);
    const avgQuality =
      gradeScores.length > 0
        ? gradeScores.reduce((a, b) => a + b, 0) / gradeScores.length
        : null;
    return {
      id: lesson.id,
      number: lesson.number,
      title: lesson.title,
      sessions: matchingConvs.length,
      lastSeenIso,
      avgQuality,
    };
  });

  const skillsExploredCount = skillStats.filter((s) => s.sessions > 0).length;

  // Full-curriculum progress across all 50 modules — distinct lesson ids the
  // family has engaged with. Drives the "Beginner / Intermediate / Advanced /
  // Expert" ribbon and the macro progress bar.
  const allExploredIds = new Set<string>();
  for (const sid of conversationSkill.values()) allExploredIds.add(sid);
  const curriculumProgress = {
    completed: allExploredIds.size,
    total: SKILL_LESSONS.length,
  };

  // -----------------------------------------------------------------------
  // Worksheet progress — pulled from curriculum_progress (Haiku-grader hits)
  // and joined to active curriculum_documents per child.
  // -----------------------------------------------------------------------
  const { data: progressRows } = await supabase
    .from("curriculum_progress")
    .select("child_id, curriculum_document_id")
    .eq("parent_id", user.id);
  const progressCounts = new Map<string, number>(); // key: `${child_id}::${doc_id}`
  for (const r of (progressRows ?? []) as Array<{ child_id: string; curriculum_document_id: string }>) {
    const k = `${r.child_id}::${r.curriculum_document_id}`;
    progressCounts.set(k, (progressCounts.get(k) ?? 0) + 1);
  }

  const childIds = (children ?? []).map((c) => c.id as string);
  const { data: docsForProgress } = childIds.length === 0
    ? { data: [] as Array<{ id: string; filename: string; child_id: string; question_count: number | null }> }
    : await supabase
        .from("curriculum_documents")
        .select("id, filename, child_id, question_count")
        .in("child_id", childIds)
        .eq("is_active", true);

  type WorksheetProgress = {
    child_id: string;
    child_name: string;
    doc_id: string;
    filename: string;
    answered: number;
    total: number;
  };
  const childNameById = new Map(
    (children ?? []).map((c) => [c.id as string, c.first_name as string])
  );
  const worksheetProgress: WorksheetProgress[] = (
    (docsForProgress ?? []) as Array<{ id: string; filename: string; child_id: string; question_count: number | null }>
  )
    .filter((d) => (d.question_count ?? 0) > 0)
    .map((d) => ({
      child_id: d.child_id,
      child_name: childNameById.get(d.child_id) ?? "Unknown",
      doc_id: d.id,
      filename: d.filename,
      answered: progressCounts.get(`${d.child_id}::${d.id}`) ?? 0,
      total: d.question_count ?? 0,
    }))
    .sort((a, b) => b.answered / b.total - a.answered / a.total);

  const analyticsChildren = (children ?? []).map((c) => ({
    id: c.id as string,
    first_name: c.first_name as string,
  }));

  const childById = new Map(
    (children ?? []).map((c) => [c.id as string, c as { id: string; first_name: string }])
  );

  // Recent undismissed breakthrough notifications (last 14 days). The grader
  // inserts these when a session scores breakthrough >= 4 or composite >= 4.3.
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const { data: notificationRows } = await supabase
    .from("parent_notifications")
    .select("id, kind, title, body, created_at, seen_at")
    .eq("parent_id", user.id)
    .is("dismissed_at", null)
    .gte("created_at", fourteenDaysAgo)
    .order("created_at", { ascending: false })
    .limit(5);
  const notifications: ParentNotification[] = (notificationRows ?? []) as ParentNotification[];

  // Latest weekly overview (audio) so the dashboard can show the existing one
  // without forcing a regenerate every visit.
  const { data: latestOverviewRow } = await supabase
    .from("weekly_overviews")
    .select("id, transcript, audio_storage_path, message_count, generated_at")
    .eq("parent_id", user.id)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let latestOverview: {
    id: string;
    transcript: string;
    audioUrl: string | null;
    message_count: number;
    generated_at: string;
  } | null = null;

  if (latestOverviewRow) {
    let audioUrl: string | null = null;
    if (latestOverviewRow.audio_storage_path) {
      const { data: signed } = await supabase.storage
        .from("overviews")
        .createSignedUrl(latestOverviewRow.audio_storage_path as string, 60 * 60);
      audioUrl = signed?.signedUrl ?? null;
    }
    latestOverview = {
      id: latestOverviewRow.id as string,
      transcript: latestOverviewRow.transcript as string,
      audioUrl,
      message_count: (latestOverviewRow.message_count as number) ?? 0,
      generated_at: latestOverviewRow.generated_at as string,
    };
  }

  const firstName = parentProfile?.full_name
    ? String(parentProfile.full_name).split(" ")[0]
    : "";

  return (
    <section className="container" style={{ padding: "56px 0 96px" }}>
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
          marginBottom: 40,
        }}
      >
        <div>
          <span className="eyebrow">Family</span>
          <h1 className="h-section" style={{ marginTop: 12, fontSize: "clamp(32px, 4vw, 48px)" }}>
            Welcome back{firstName ? <>, <span className="serif-italic accent">{firstName}</span></> : ""}.
          </h1>
        </div>
        <form action={logout}>
          <button className="btn btn-ghost" style={{ fontSize: 14 }}>
            Log out
          </button>
        </form>
      </div>

      {/* Body grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
          gap: 24,
        }}
        className="dashboard-layout"
      >
        {/* Left column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Breakthroughs — fresh strong sessions, dismissable */}
          <NotificationsBanner initial={notifications} />

          {/* Weekly audio overview */}
          <WeeklyOverview latest={latestOverview} />

          {/* AI Skills macro progress — across the full 50-module curriculum */}
          <CurriculumProgressCard
            completed={curriculumProgress.completed}
            total={curriculumProgress.total}
          />

          {/* Analytics with charts */}
          <ChildAnalytics
            children={analyticsChildren}
            dailySeries={dailySeries}
            modeBreakdown={modeBreakdown}
            counters={counters}
            qualityAvg={qualityAvg}
            qualitySeries={qualitySeries}
            recentGrades={recentGrades}
            breakthroughCount={breakthroughCount}
            skillStats={skillStats}
            skillsExploredCount={skillsExploredCount}
            childById={Object.fromEntries(
              (children ?? []).map((c) => [c.id as string, c.first_name as string])
            )}
          />

          {/* Worksheet progress */}
          {worksheetProgress.length > 0 && (
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                padding: 28,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <div>
                  <span className="eyebrow">Worksheet progress</span>
                  <h3 style={{ marginTop: 8, fontSize: 20, fontWeight: 600 }}>
                    What they&apos;ve solved
                  </h3>
                </div>
                <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>
                  Updated as Echo grades each correct answer
                </span>
              </div>

              <ul
                style={{
                  marginTop: 20,
                  listStyle: "none",
                  padding: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                }}
              >
                {worksheetProgress.map((wp) => {
                  const pct = wp.total > 0 ? Math.min(100, (wp.answered / wp.total) * 100) : 0;
                  return (
                    <li key={`${wp.child_id}-${wp.doc_id}`}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "baseline",
                          marginBottom: 6,
                          gap: 12,
                        }}
                      >
                        <span style={{ fontSize: 14, fontWeight: 500 }}>
                          <span style={{ color: "var(--ink-muted)" }}>{wp.child_name}</span>{" "}
                          · {wp.filename}
                        </span>
                        <span style={{ fontSize: 12, color: "var(--ink-muted)", whiteSpace: "nowrap" }}>
                          {wp.answered} / {wp.total} · {pct.toFixed(0)}%
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
                            width: `${pct}%`,
                            height: "100%",
                            background:
                              "linear-gradient(90deg, var(--violet, #8b5cf6), var(--cyan, #4ed8eb))",
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Recent prompts */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: 28,
            }}
          >
            <span className="eyebrow">Recent prompts</span>
            <h3
              className="h-section"
              style={{ marginTop: 10, fontSize: 24, lineHeight: 1.2 }}
            >
              What your kids <span className="serif-italic accent">asked Echo</span>
            </h3>

            {!recentPrompts || recentPrompts.length === 0 ? (
              <p
                style={{
                  marginTop: 20,
                  fontSize: 14,
                  color: "var(--ink-muted)",
                }}
              >
                No conversations yet. Once your child uses the Study Hub, their
                prompts show up here.
              </p>
            ) : (
              <ul style={{ marginTop: 20, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {recentPrompts.map((msg) => {
                  const childName =
                    childById.get(msg.child_id as string)?.first_name ?? "Your child";
                  const when = new Date(msg.created_at as string).toLocaleString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  });
                  const modeLabel =
                    msg.mode === "storybook" ? "Storybook" :
                    msg.mode === "skills" ? "Skills" :
                    msg.mode === "reading" ? "Reading" : "Tutor";
                  const modeColor =
                    msg.mode === "storybook" ? "rgba(78,216,235,0.5)" :
                    msg.mode === "skills" ? "rgba(240,179,64,0.5)" :
                    msg.mode === "reading" ? "rgba(52,211,153,0.5)" :
                    "rgba(138,107,255,0.5)";
                  const modeBg =
                    msg.mode === "storybook" ? "rgba(78,216,235,0.1)" :
                    msg.mode === "skills" ? "rgba(240,179,64,0.1)" :
                    msg.mode === "reading" ? "rgba(52,211,153,0.1)" :
                    "rgba(138,107,255,0.1)";
                  const modeText =
                    msg.mode === "storybook" ? "var(--cyan)" :
                    msg.mode === "skills" ? "var(--amber)" :
                    msg.mode === "reading" ? "#34d399" :
                    "var(--violet)";
                  return (
                    <li
                      key={msg.id as string}
                      style={{
                        background: "var(--bg-elev)",
                        border: "1px solid var(--border)",
                        borderRadius: 12,
                        padding: 16,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          gap: 12,
                          flexWrap: "wrap",
                        }}
                      >
                        <div
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 11,
                            color: "var(--ink-muted)",
                            letterSpacing: "0.06em",
                          }}
                        >
                          {childName} · {when}
                        </div>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                            fontWeight: 500,
                            letterSpacing: "0.14em",
                            textTransform: "uppercase",
                            borderRadius: 6,
                            border: `1px solid ${modeColor}`,
                            background: modeBg,
                            color: modeText,
                            padding: "2px 8px",
                          }}
                        >
                          {modeLabel}
                        </span>
                      </div>
                      <p
                        style={{
                          marginTop: 8,
                          fontSize: 14,
                          lineHeight: 1.5,
                        }}
                      >
                        &ldquo;{String(msg.content).slice(0, 220)}
                        {String(msg.content).length > 220 ? "…" : ""}&rdquo;
                      </p>
                      {msg.flagged && (
                        <div
                          style={{
                            marginTop: 10,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 8,
                            borderRadius: 6,
                            border: "1px solid rgba(245,158,11,0.4)",
                            background: "rgba(245,158,11,0.1)",
                            color: "var(--amber)",
                            fontSize: 12,
                            padding: "4px 8px",
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: 999,
                              background: "currentColor",
                            }}
                          />
                          {msg.flag_reason ?? "Flagged"}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          {/* Children */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: 28,
            }}
          >
            <h3 className="h-section" style={{ fontSize: 22, lineHeight: 1.2 }}>
              Children
            </h3>

            {children && children.length > 0 ? (
              <ul style={{ marginTop: 20, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {children.map((child) => (
                  <li
                    key={child.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      background: "var(--bg-elev)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      padding: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: "var(--violet-soft)",
                        border: "1px solid rgba(78,216,235,0.4)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontFamily: "var(--font-serif)",
                        fontWeight: 400,
                        color: "var(--violet)",
                        fontSize: 20,
                      }}
                    >
                      {child.first_name.charAt(0)}
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>
                        {child.first_name}
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 12,
                            fontWeight: 400,
                            color: "var(--ink-muted)",
                          }}
                        >
                          {child.age} yrs
                        </span>
                      </div>
                      {child.school && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--ink-muted)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {child.school}
                          {child.grade ? ` · ${child.grade}` : ""}
                        </div>
                      )}
                      <div
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          color: "var(--violet)",
                          marginTop: 2,
                          letterSpacing: "0.06em",
                        }}
                      >
                        Tutor: {child.ai_tutor_name}
                      </div>
                      <ChildLanguagePicker
                        childId={child.id as string}
                        current={(child.preferred_language as string | null) ?? null}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p
                style={{
                  marginTop: 16,
                  fontSize: 14,
                  color: "var(--ink-muted)",
                }}
              >
                No children registered yet.
              </p>
            )}

            <AddChildForm />
          </div>

          {/* CU3E Tablet — honest tease of the kiosk hardware in development */}
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-lg)",
              padding: 28,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <h3 className="h-section" style={{ fontSize: 22, lineHeight: 1.2, margin: 0 }}>
                CU3E Tablet
              </h3>
              <span
                className="pill"
                style={{
                  background: "rgba(240,179,64,0.10)",
                  borderColor: "rgba(240,179,64,0.35)",
                  color: "var(--amber)",
                }}
              >
                <span className="dot" style={{ background: "var(--amber)" }} />
                In development
              </span>
            </div>
            <p
              style={{
                marginTop: 14,
                fontSize: 14,
                color: "var(--ink-muted)",
                lineHeight: 1.5,
              }}
            >
              A locked-down Android tablet for homework time — same Echo, no TikTok tab one click away. Prototyping now.
            </p>
            <Link
              href="/contact"
              style={{
                marginTop: 14,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                color: "var(--violet)",
                textDecoration: "none",
              }}
            >
              Tell me when it&apos;s ready
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 920px) {
          .dashboard-layout { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </section>
  );
}

// CurriculumProgressCard moved to ./CurriculumProgressCard.tsx so it can be
// reused on the /parents marketing page with mocked data.
