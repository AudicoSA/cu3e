"use client";

import { useTransition, useState } from "react";
import { setChildLanguage } from "../auth/actions";

// Tiny per-child language toggle on the dashboard child card. Lets a parent
// flip an existing child's preferred language without re-creating them via
// the Add Child form. Optimistically updates the visible value, fires the
// server action, then revalidates the dashboard.

export default function ChildLanguagePicker({
  childId,
  current,
}: {
  childId: string;
  current: string | null;
}) {
  const [value, setValue] = useState<string>(current ?? "en");
  const [pending, startTransition] = useTransition();

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value;
        setValue(next); // optimistic
        startTransition(async () => {
          const result = await setChildLanguage(childId, next);
          // Only revert on error; success path triggers revalidatePath
          if (result && "error" in result) {
            setValue(current ?? "en");
            console.warn("[language] update failed:", result.error);
          }
        });
      }}
      aria-label="Echo's language for this child"
      style={{
        marginTop: 4,
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 6,
        color: "var(--ink-soft)",
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        letterSpacing: "0.04em",
        padding: "2px 6px",
        cursor: pending ? "wait" : "pointer",
        opacity: pending ? 0.6 : 1,
      }}
    >
      <option value="en">Echo · English</option>
      <option value="af">Echo · Afrikaans</option>
      <option value="zu">Echo · isiZulu</option>
    </select>
  );
}
