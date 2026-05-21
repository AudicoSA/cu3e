"use client";

import { useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export type ParentNotification = {
  id: string;
  kind: "breakthrough" | "milestone" | "streak";
  title: string;
  body: string | null;
  created_at: string;
  seen_at: string | null;
};

type Props = {
  initial: ParentNotification[];
};

// Surfaces fresh breakthroughs / strong sessions at the top of the dashboard.
// Server passes the initial list (last 14 days, not dismissed); from there the
// client manages dismiss state via the Supabase browser client (RLS on
// parent_notifications already restricts to parent_id = auth.uid()).
export default function NotificationsBanner({ initial }: Props) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [items, setItems] = useState<ParentNotification[]>(initial);

  if (items.length === 0) return null;

  const dismiss = async (id: string) => {
    // Optimistic remove
    setItems((cur) => cur.filter((n) => n.id !== id));
    const { error } = await supabase
      .from("parent_notifications")
      .update({ dismissed_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.warn("[notifications] dismiss failed:", error.message);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {items.map((n) => (
        <div
          key={n.id}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            padding: 16,
            background:
              "linear-gradient(135deg, rgba(78,216,235,0.10), rgba(138,107,255,0.08))",
            border: "1px solid rgba(78,216,235,0.30)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--cyan)",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: "var(--cyan)",
                  boxShadow: "0 0 0 4px rgba(78,216,235,0.18)",
                }}
              />
              {n.kind === "breakthrough" ? "Breakthrough" : n.kind === "milestone" ? "Milestone" : "Streak"}
            </div>
            <div
              style={{
                marginTop: 6,
                fontFamily: "var(--font-serif)",
                fontSize: 20,
                letterSpacing: "-0.01em",
                lineHeight: 1.25,
              }}
            >
              {n.title}
            </div>
            {n.body && (
              <p
                style={{
                  marginTop: 6,
                  fontSize: 13.5,
                  color: "var(--ink-soft)",
                  lineHeight: 1.5,
                }}
              >
                {n.body}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => dismiss(n.id)}
            aria-label="Dismiss notification"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--ink-muted)",
              fontSize: 13,
              cursor: "pointer",
              padding: "4px 8px",
              whiteSpace: "nowrap",
            }}
          >
            Dismiss
          </button>
        </div>
      ))}
    </div>
  );
}
