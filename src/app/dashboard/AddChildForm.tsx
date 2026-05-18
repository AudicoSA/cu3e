"use client";

import { useState } from "react";
import { addChild } from "../auth/actions";

export default function AddChildForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          marginTop: 16,
          width: "100%",
          padding: "12px 0",
          borderRadius: 12,
          border: "1px dashed var(--border-strong)",
          background: "transparent",
          fontSize: 14,
          color: "var(--ink-muted)",
          fontFamily: "var(--font-sans)",
          transition: "border-color 150ms ease, color 150ms ease, background 150ms ease",
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.color = "var(--ink)";
          e.currentTarget.style.borderColor = "var(--violet)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.color = "var(--ink-muted)";
          e.currentTarget.style.borderColor = "var(--border-strong)";
        }}
      >
        + Add child profile
      </button>
    );
  }

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    await addChild(formData);
    setIsPending(false);
    setIsOpen(false);
  }

  return (
    <div
      style={{
        marginTop: 16,
        background: "var(--bg-elev)",
        border: "1px solid rgba(78,216,235,0.4)",
        borderRadius: 12,
        padding: 20,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <h3
          style={{
            fontFamily: "var(--font-serif)",
            fontWeight: 400,
            fontSize: 20,
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          New child profile
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            color: "var(--ink-muted)",
            background: "transparent",
            border: "none",
            fontSize: 16,
          }}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="First name" name="firstName" placeholder="Jane" required />
        <Field label="Age" name="age" type="number" min={3} max={18} placeholder="12" required />
        <Field label="School" name="school" placeholder="Springfield Elementary" />
        <Field label="Grade" name="grade" placeholder="Grade 6" />

        <div>
          <label
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 500,
              marginBottom: 6,
              color: "var(--ink-muted)",
            }}
          >
            AI tutor persona
          </label>
          <select
            name="tutorName"
            className="field"
            style={{ background: "var(--surface)" }}
          >
            <option value="Echo">Echo · the owl (default)</option>
            <option value="Professor Byte">Professor Byte · robot</option>
            <option value="Nova">Nova · space explorer</option>
            <option value="Atlas">Atlas · history guide</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="btn btn-violet"
          style={{
            marginTop: 8,
            justifyContent: "center",
            width: "100%",
            opacity: isPending ? 0.5 : 1,
          }}
        >
          {isPending ? "Saving…" : "Save profile"}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required,
  min,
  max,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 500,
          marginBottom: 6,
          color: "var(--ink-muted)",
        }}
      >
        {label}
      </label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        className="field"
      />
    </div>
  );
}
