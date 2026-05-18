import { requestPasswordReset } from "../auth/actions";

export const metadata = {
  title: "Reset your password · CU3E",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; sent?: string }>;
}) {
  const params = await searchParams;
  const sent = params.sent === "1";

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
        <span className="eyebrow">Reset password</span>
        <h1
          className="h-section"
          style={{ marginTop: 12, fontSize: "clamp(28px, 3.4vw, 38px)" }}
        >
          {sent ? (
            <>
              Check your <span className="serif-italic accent">email</span>
            </>
          ) : (
            <>
              Forgot your <span className="serif-italic accent">password?</span>
            </>
          )}
        </h1>

        {sent ? (
          <>
            <p
              style={{
                marginTop: 16,
                color: "var(--ink-soft)",
                fontSize: 14,
                lineHeight: 1.6,
              }}
            >
              If an account exists for that email, we&apos;ve sent a password-reset
              link. Click it within an hour. If it doesn&apos;t arrive in a few
              minutes, check your spam folder.
            </p>
            <a
              href="/login"
              className="btn btn-ghost"
              style={{ marginTop: 24, width: "100%", justifyContent: "center" }}
            >
              Back to log in
            </a>
          </>
        ) : (
          <>
            <p
              style={{
                marginTop: 10,
                color: "var(--ink-soft)",
                fontSize: 14,
              }}
            >
              Type your email below. We&apos;ll send you a link to set a new
              password.
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

            <form
              style={{
                marginTop: 28,
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div>
                <label
                  htmlFor="email"
                  style={{
                    display: "block",
                    fontSize: 12,
                    fontWeight: 500,
                    marginBottom: 8,
                    color: "var(--ink-muted)",
                  }}
                >
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  placeholder="parent@example.com"
                  className="field"
                />
              </div>
              <button
                formAction={requestPasswordReset}
                className="btn btn-violet"
                style={{
                  marginTop: 8,
                  justifyContent: "center",
                  width: "100%",
                }}
              >
                Send reset link
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
              Remembered it?{" "}
              <a
                href="/login"
                style={{ color: "var(--violet)", fontWeight: 600 }}
              >
                Log in
              </a>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
