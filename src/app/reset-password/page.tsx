import { updatePassword } from "../auth/actions";
import { createClient } from "@/utils/supabase/server";

export const metadata = {
  title: "Set a new password · CU3E",
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="container" style={{ maxWidth: 480, padding: "80px 32px" }}>
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          padding: 40,
        }}
      >
        <span className="eyebrow">Set new password</span>
        <h1 className="h-section" style={{ marginTop: 12, fontSize: "clamp(28px, 3.4vw, 38px)" }}>
          Pick a new <span className="serif-italic accent">password.</span>
        </h1>

        {!user ? (
          <>
            <p style={{ marginTop: 16, color: "var(--ink-soft)", fontSize: 14, lineHeight: 1.6 }}>
              This reset link is invalid or has expired. Request a new one and
              click the email within an hour.
            </p>
            <a
              href="/forgot-password"
              className="btn btn-violet"
              style={{ marginTop: 24, width: "100%", justifyContent: "center" }}
            >
              Get a new reset link
            </a>
          </>
        ) : (
          <>
            <p style={{ marginTop: 10, color: "var(--ink-soft)", fontSize: 14 }}>
              Type a new password. At least 8 characters.
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
              <div>
                <label
                  htmlFor="password"
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 8,
                    color: "var(--ink-muted)",
                  }}
                >
                  New password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  placeholder="At least 8 characters"
                  className="field"
                />
              </div>
              <button
                formAction={updatePassword}
                className="btn btn-violet"
                style={{ marginTop: 8, justifyContent: "center", width: "100%" }}
              >
                Save new password
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
