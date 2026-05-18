"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";

type Child = { id: string; first_name: string };

type DailyRow = { date: string; total: number; perChild: Record<string, number> };

type ModeRow = { mode: string; count: number };

type Counters = {
  totalQuestions: number;
  refusals: number;
  modesExplored: number;
  voiceConversations: number;
};

type QualityRow = { date: string; avg: number | null };

type RecentGrade = {
  conversation_id: string;
  mode: string;
  persistence: number;
  insight: number;
  breakthrough: number;
  summary: string | null;
  graded_at: string;
  child_id: string;
};

type SkillStat = {
  id: string;
  number: string;
  title: string;
  sessions: number;
  lastSeenIso: string | null;
  avgQuality: number | null;
};

type Props = {
  children: Child[];
  dailySeries: DailyRow[];
  modeBreakdown: ModeRow[];
  counters: Counters;
  qualityAvg: number | null;
  qualitySeries: QualityRow[];
  recentGrades: RecentGrade[];
  breakthroughCount: number;
  skillStats: SkillStat[];
  skillsExploredCount: number;
  childById: Record<string, string>;
};

// Brand-aligned palette — keep enough distinct hues for up to 4 kids
// (Family tier allows max 4). After that they cycle.
const CHILD_COLORS = ["#4ed8eb", "#8a6bff", "#f0b340", "#ec4899"];
const MODE_COLORS: Record<string, string> = {
  tutor: "#8a6bff",       // violet
  storybook: "#4ed8eb",   // cyan
  skills: "#f0b340",      // amber
  voice: "#ec4899",       // pink
};

export default function ChildAnalytics({
  children,
  dailySeries,
  modeBreakdown,
  counters,
  qualityAvg,
  qualitySeries,
  recentGrades,
  breakthroughCount,
  skillStats,
  skillsExploredCount,
  childById,
}: Props) {
  const hasData = counters.totalQuestions > 0;
  const hasQuality = qualityAvg !== null && recentGrades.length > 0;
  const hasSkills = skillsExploredCount > 0;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 28,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap" }}>
        <div>
          <span className="eyebrow">Last 30 days</span>
          <h3 className="h-section" style={{ marginTop: 10, fontSize: 26, lineHeight: 1.2 }}>
            Activity &amp; <span className="serif-italic accent">progress</span>
          </h3>
        </div>
        {hasData && (
          <span className="pill" style={{ alignSelf: "center" }}>
            <span className="dot" />
            Live
          </span>
        )}
      </div>

      {!hasData ? (
        <p
          style={{
            marginTop: 20,
            fontSize: 14,
            color: "var(--ink-muted)",
            lineHeight: 1.55,
          }}
        >
          Once your child starts using Echo, this is where you&apos;ll see real
          patterns — when they&apos;re learning, what mode they&apos;re drawn to, and
          how many times Echo had to refuse a shortcut.
        </p>
      ) : (
        <>
          {/* Counters */}
          <div
            style={{
              marginTop: 24,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 12,
            }}
          >
            <CounterTile
              label="Questions asked"
              value={counters.totalQuestions}
              accent="var(--violet)"
            />
            <CounterTile
              label="Refusals (cheat attempts)"
              value={counters.refusals}
              accent="var(--amber)"
            />
            <CounterTile
              label="Modes explored"
              value={counters.modesExplored}
              accent="var(--cyan)"
              suffix={` of 4`}
            />
            <CounterTile
              label="Voice calls"
              value={counters.voiceConversations}
              accent="#ec4899"
            />
            {qualityAvg !== null && (
              <CounterTile
                label="Avg learning quality"
                valueText={qualityAvg.toFixed(1)}
                accent="var(--violet)"
                suffix={` / 5`}
              />
            )}
            <CounterTile
              label="Breakthroughs"
              value={breakthroughCount}
              accent="var(--cyan)"
            />
          </div>

          {/* Daily activity */}
          <div style={{ marginTop: 32 }}>
            <div
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--ink-muted)",
                marginBottom: 12,
              }}
            >
              Daily activity {children.length > 1 ? "· per child" : ""}
            </div>
            <div style={{ width: "100%", height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailySeries} margin={{ top: 8, right: 4, left: -16, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="2 4" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={{ stroke: "var(--border)" }}
                    minTickGap={28}
                    tickFormatter={(v: string) => {
                      const d = new Date(v);
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                  />
                  <YAxis
                    tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border-strong)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--ink)" }}
                    itemStyle={{ color: "var(--ink-soft)" }}
                    labelFormatter={(label) => {
                      const d = new Date(label);
                      return d.toLocaleDateString(undefined, {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      });
                    }}
                  />
                  {children.map((child, i) => (
                    <Bar
                      key={child.id}
                      dataKey={`perChild.${child.id}`}
                      stackId="kids"
                      fill={CHILD_COLORS[i % CHILD_COLORS.length]}
                      radius={i === children.length - 1 ? [4, 4, 0, 0] : 0}
                      name={child.first_name}
                    />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            {children.length > 1 && (
              <div style={{ marginTop: 12, display: "flex", gap: 16, flexWrap: "wrap" }}>
                {children.map((child, i) => (
                  <span
                    key={child.id}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "var(--ink-muted)",
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 2,
                        background: CHILD_COLORS[i % CHILD_COLORS.length],
                      }}
                    />
                    {child.first_name}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Mode breakdown */}
          {modeBreakdown.length > 0 && (
            <div
              style={{
                marginTop: 32,
                display: "grid",
                gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                gap: 20,
                alignItems: "center",
              }}
              className="mode-breakdown-grid"
            >
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--ink-muted)",
                    marginBottom: 12,
                  }}
                >
                  How they&apos;re using Echo
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {modeBreakdown.map((row) => {
                    const pct = Math.round((row.count / counters.totalQuestions) * 100);
                    return (
                      <li key={row.mode} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <span
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 2,
                            background: MODE_COLORS[row.mode] ?? "var(--ink-muted)",
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ fontSize: 14, textTransform: "capitalize", flex: 1 }}>{row.mode}</span>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 12,
                            color: "var(--ink-muted)",
                          }}
                        >
                          {row.count} · {pct}%
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <div style={{ height: 180 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={modeBreakdown}
                      dataKey="count"
                      nameKey="mode"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={3}
                      strokeWidth={0}
                    >
                      {modeBreakdown.map((row) => (
                        <Cell key={row.mode} fill={MODE_COLORS[row.mode] ?? "var(--ink-muted)"} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "var(--surface)",
                        border: "1px solid var(--border-strong)",
                        borderRadius: 10,
                        fontSize: 12,
                      }}
                      labelStyle={{ color: "var(--ink)" }}
                      itemStyle={{ color: "var(--ink-soft)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Per-skill progress ladder */}
          {hasSkills && (
            <div style={{ marginTop: 36 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 4,
                }}
              >
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--ink-muted)",
                  }}
                >
                  AI Skills progress
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    color: "var(--cyan)",
                    letterSpacing: "0.08em",
                  }}
                >
                  {skillsExploredCount} of {skillStats.length} explored
                </div>
              </div>
              <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 14, lineHeight: 1.5 }}>
                Which AI literacy lessons they&apos;ve actually started — and how deep they went.
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {skillStats.map((s) => (
                  <SkillRow key={s.id} skill={s} />
                ))}
              </ul>
            </div>
          )}

          {/* Learning quality */}
          {hasQuality && (
            <>
              <div style={{ marginTop: 36 }}>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--ink-muted)",
                    marginBottom: 4,
                  }}
                >
                  Learning quality · graded by AI
                </div>
                <p style={{ fontSize: 12.5, color: "var(--ink-muted)", marginBottom: 12, lineHeight: 1.5 }}>
                  Each conversation is scored on persistence, insight, and breakthrough. This is the trend.
                </p>
                <div style={{ width: "100%", height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={qualitySeries} margin={{ top: 8, right: 12, left: -16, bottom: 4 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="2 4" vertical={false} />
                      <XAxis
                        dataKey="date"
                        tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                        minTickGap={28}
                        tickFormatter={(v: string) => {
                          const d = new Date(v);
                          return `${d.getDate()}/${d.getMonth() + 1}`;
                        }}
                      />
                      <YAxis
                        domain={[1, 5]}
                        tick={{ fill: "var(--ink-muted)", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        ticks={[1, 2, 3, 4, 5]}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--surface)",
                          border: "1px solid var(--border-strong)",
                          borderRadius: 10,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "var(--ink)" }}
                        itemStyle={{ color: "var(--ink-soft)" }}
                        labelFormatter={(label) => {
                          const d = new Date(label);
                          return d.toLocaleDateString(undefined, {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          });
                        }}
                        formatter={(value: unknown) =>
                          typeof value === "number" ? value.toFixed(1) : "—"
                        }
                      />
                      <Line
                        type="monotone"
                        dataKey="avg"
                        stroke="var(--violet)"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "var(--violet)", strokeWidth: 0 }}
                        connectNulls
                        name="Quality"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div style={{ marginTop: 28 }}>
                <div
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: 11,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "var(--ink-muted)",
                    marginBottom: 12,
                  }}
                >
                  Recent sessions
                </div>
                <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                  {recentGrades.map((g) => {
                    const composite = ((g.persistence + g.insight + g.breakthrough) / 3).toFixed(1);
                    const name = childById[g.child_id] ?? "Your child";
                    const when = new Date(g.graded_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    });
                    return (
                      <li
                        key={g.conversation_id}
                        style={{
                          padding: 14,
                          background: "var(--bg-elev)",
                          border: "1px solid var(--border)",
                          borderRadius: 10,
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
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-muted)", letterSpacing: "0.06em" }}>
                            {name} · {when} · {g.mode}
                          </span>
                          <span
                            style={{
                              fontFamily: "var(--font-serif)",
                              fontSize: 22,
                              letterSpacing: "-0.02em",
                              color: "var(--violet)",
                            }}
                          >
                            {composite}
                            <span style={{ fontSize: 12, color: "var(--ink-muted)", marginLeft: 2 }}>/ 5</span>
                          </span>
                        </div>
                        {g.summary && (
                          <p style={{ marginTop: 6, fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.5 }}>
                            {g.summary}
                          </p>
                        )}
                        <div
                          style={{
                            marginTop: 8,
                            display: "flex",
                            gap: 14,
                            fontFamily: "var(--font-mono)",
                            fontSize: 10.5,
                            color: "var(--ink-muted)",
                            letterSpacing: "0.06em",
                          }}
                        >
                          <span>Persistence {g.persistence}/5</span>
                          <span>Insight {g.insight}/5</span>
                          <span>Breakthrough {g.breakthrough}/5</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}

          <style>{`
            @media (max-width: 720px) {
              .mode-breakdown-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </>
      )}
    </div>
  );
}

function SkillRow({ skill }: { skill: SkillStat }) {
  const explored = skill.sessions > 0;

  // Depth gauge — based on number of sessions, capped at 5.
  // 0 sessions = "Not started", 1 = "Tried", 3 = "Practising", 5 = "Familiar"
  const depthSteps = 5;
  const depth = Math.min(skill.sessions, depthSteps);
  const depthLabel =
    skill.sessions === 0
      ? "Not started"
      : skill.sessions < 2
      ? "Tried"
      : skill.sessions < 4
      ? "Practising"
      : "Familiar";

  const lastSeen = skill.lastSeenIso
    ? new Date(skill.lastSeenIso).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : null;

  return (
    <li
      style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr) auto",
        alignItems: "center",
        gap: 16,
        padding: "14px 16px",
        background: "var(--bg-elev)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        opacity: explored ? 1 : 0.55,
      }}
    >
      {/* Left — number + title */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: explored ? "var(--violet)" : "var(--ink-faint)",
          }}
        >
          Lesson {skill.number}
        </span>
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 18,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
          }}
        >
          {skill.title}
        </span>
      </div>

      {/* Middle — depth gauge */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <div style={{ display: "flex", gap: 4 }}>
          {Array.from({ length: depthSteps }).map((_, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                height: 6,
                borderRadius: 999,
                background: i < depth ? "var(--violet)" : "rgba(255,255,255,0.08)",
                transition: "background 200ms ease",
              }}
            />
          ))}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--font-mono)",
            fontSize: 10.5,
            letterSpacing: "0.08em",
            color: "var(--ink-muted)",
          }}
        >
          <span>{depthLabel}</span>
          {lastSeen && <span>last · {lastSeen}</span>}
        </div>
      </div>

      {/* Right — sessions + quality */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2, minWidth: 80 }}>
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontSize: 22,
            letterSpacing: "-0.02em",
            color: explored ? "var(--ink)" : "var(--ink-muted)",
            lineHeight: 1,
          }}
        >
          {skill.sessions}
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: "0.06em",
            color: "var(--ink-muted)",
          }}
        >
          {skill.sessions === 1 ? "session" : "sessions"}
        </span>
        {skill.avgQuality !== null && (
          <span
            style={{
              marginTop: 4,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--cyan)",
              letterSpacing: "0.06em",
            }}
          >
            {skill.avgQuality.toFixed(1)}/5 quality
          </span>
        )}
      </div>
    </li>
  );
}

function CounterTile({
  label,
  value,
  valueText,
  accent,
  suffix,
}: {
  label: string;
  value?: number;
  valueText?: string;
  accent: string;
  suffix?: string;
}) {
  return (
    <div
      style={{
        padding: 14,
        background: "var(--surface-2)",
        borderRadius: 10,
        border: "1px solid var(--border)",
      }}
    >
      <div style={{ fontFamily: "var(--font-serif)", fontSize: 30, lineHeight: 1, letterSpacing: "-0.02em", color: accent }}>
        {valueText ?? value}
        {suffix && (
          <span
            style={{
              fontSize: 14,
              color: "var(--ink-muted)",
              marginLeft: 4,
              letterSpacing: 0,
              fontFamily: "var(--font-sans)",
            }}
          >
            {suffix}
          </span>
        )}
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--ink-muted)",
          marginTop: 6,
        }}
      >
        {label}
      </div>
    </div>
  );
}
