import { signup } from "../auth/actions";

export default async function Register({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  return (
    <div className="container" style={{ maxWidth: 480, padding: "80px 0" }}>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: 40,
        }}
      >
        <span className="eyebrow">Get started</span>
        <h1 className="h-section" style={{ marginTop: 12, fontSize: "clamp(28px, 3.4vw, 38px)" }}>
          Create your <span className="serif-italic accent">CU3E</span> account
        </h1>
        <p style={{ marginTop: 10, color: "var(--ink-soft)", fontSize: 14 }}>
          Parent account first — you&apos;ll add your child after.
        </p>

        {params.error && (
          <div
            style={{
              marginTop: 20,
              borderRadius: 10,
              border: "1px solid rgba(239,68,68,0.4)",
              background: "rgba(239,68,68,0.08)",
              color: "#fca5a5",
              padding: "10px 14px",
              fontSize: 13,
            }}
          >
            {params.error}
          </div>
        )}

        <form style={{ marginTop: 28, display: "flex", flexDirection: "column", gap: 16 }}>
          <Field id="parentName" label="Your name" type="text" name="parentName" placeholder="Jane Doe" />
          <Field id="email" label="Email" type="email" name="email" placeholder="parent@example.com" />
          <Field id="password" label="Password" type="password" name="password" placeholder="At least 8 characters" />

          <button
            formAction={signup}
            className="btn btn-violet"
            style={{ marginTop: 8, justifyContent: "center", width: "100%" }}
          >
            Create account
          </button>
        </form>

        <p
          style={{
            marginTop: 24,
            textAlign: "center",
            color: "var(--ink-muted)",
            fontSize: 14,
          }}
        >
          Already have an account?{" "}
          <a href="/login" style={{ color: "var(--violet)", fontWeight: 600 }}>
            Log in
          </a>
        </p>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  type,
  name,
  placeholder,
}: {
  id: string;
  label: string;
  type: string;
  name: string;
  placeholder: string;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontSize: 12,
          fontWeight: 500,
          marginBottom: 8,
          color: "var(--ink-muted)",
        }}
      >
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required
        placeholder={placeholder}
        className="field"
      />
    </div>
  );
}
