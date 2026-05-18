import type { Metadata } from "next";
import { DM_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import Image from "next/image";
import { createClient } from "@/utils/supabase/server";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});
const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains-mono",
});

export const metadata: Metadata = {
  title: "CU3E — The AI tutor that won't do your kid's homework",
  description:
    "CU3E turns your child's actual schoolwork into real thinking — and quietly raises them to be fluent with the tools that will define their adult lives. Aligned with CAPS, Common Core, GCSE & IB.",
  // Limited beta — don't index until we're ready for a public launch.
  robots: { index: false, follow: false },
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthed = Boolean(user);

  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable}`}
    >
      <body>
        <header className="nav">
          <div className="nav-inner">
            <a href="/" className="brand" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <span className="brand-mark">
                <Image src="/echo.png" alt="" fill sizes="30px" style={{ objectFit: "cover" }} />
              </span>
              CU3E
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 9.5,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--cyan)",
                  border: "1px solid rgba(78,216,235,0.4)",
                  borderRadius: 4,
                  padding: "1px 6px",
                  marginLeft: 4,
                  fontWeight: 500,
                }}
              >
                Beta
              </span>
            </a>

            <nav className="nav-links">
              {isAuthed ? (
                <>
                  <a href="/study-hub">Study Hub</a>
                  <a href="/skills">AI Skills</a>
                  <a href="/dashboard">Dashboard</a>
                  <a href="/pricing">Pricing</a>
                </>
              ) : (
                <>
                  <a href="/#modes">How it works</a>
                  <a href="/#outcomes">Outcomes</a>
                  <a href="/#parents">For parents</a>
                  <a href="/pricing">Pricing</a>
                  <a href="/#faq">FAQ</a>
                </>
              )}
            </nav>

            <div className="flex-row">
              {isAuthed ? (
                <a href="/dashboard" className="btn btn-violet">
                  Open dashboard
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </a>
              ) : (
                <>
                  <a
                    href="/login"
                    style={{ fontSize: 14, color: "var(--ink-muted)", padding: "8px 12px" }}
                  >
                    Log in
                  </a>
                  <a href="/register" className="btn btn-violet">
                    Start free trial
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </a>
                </>
              )}
            </div>
          </div>
        </header>

        <main>{children}</main>

        <footer className="site-footer">
          <div className="container">
            <div className="row">
              <div className="flex-row">
                <span className="brand">
                  <span className="brand-mark">
                    <Image src="/echo.png" alt="" fill sizes="30px" style={{ objectFit: "cover" }} />
                  </span>
                  CU3E
                </span>
                <span className="muted" style={{ marginLeft: 16 }}>
                  Limited beta · sharing welcome · public launch later.
                </span>
              </div>
              <div className="links">
                <a href="/pricing">Pricing</a>
                <a href="/#faq">FAQ</a>
                <a href="/privacy">Privacy</a>
                {!isAuthed && <a href="/login">Log in</a>}
                <span className="muted">© {new Date().getFullYear()}</span>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
