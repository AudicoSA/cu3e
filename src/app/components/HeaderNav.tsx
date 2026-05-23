"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  isAuthed: boolean;
};

// Renders the header's right-side: nav links + auth buttons.
// Desktop: inline links. Mobile (≤880px): hamburger → full-screen overlay.
// `isAuthed` is resolved server-side in layout.tsx and passed in.
export default function HeaderNav({ isAuthed }: Props) {
  const [open, setOpen] = useState(false);
  // Track client mount so we can safely call createPortal (which needs
  // document, only available client-side).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close on Esc + on route change (navigation)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const closeOnNav = () => setOpen(false);

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => {
    const linkStyle = mobile
      ? {
          fontFamily: "var(--font-serif)",
          fontSize: 28,
          color: "var(--ink)",
          padding: "16px 0",
          display: "block",
          borderBottom: "1px solid var(--border)",
          letterSpacing: "-0.01em",
        }
      : {};
    return isAuthed ? (
      <>
        <a href="/study-hub" style={linkStyle} onClick={closeOnNav}>Study Hub</a>
        <a href="/skills" style={linkStyle} onClick={closeOnNav}>AI Skills</a>
        <a href="/dashboard" style={linkStyle} onClick={closeOnNav}>Dashboard</a>
        <a href="/pricing" style={linkStyle} onClick={closeOnNav}>Pricing</a>
      </>
    ) : (
      <>
        <a href="/#modes" style={linkStyle} onClick={closeOnNav}>How it works</a>
        <a href="/#outcomes" style={linkStyle} onClick={closeOnNav}>Outcomes</a>
        <a href="/parents" style={linkStyle} onClick={closeOnNav}>For parents</a>
        <a href="/pricing" style={linkStyle} onClick={closeOnNav}>Pricing</a>
        <a href="/#faq" style={linkStyle} onClick={closeOnNav}>FAQ</a>
      </>
    );
  };

  return (
    <>
      {/* Desktop nav — hidden ≤880px by globals.css */}
      <nav className="nav-links">
        <NavLinks />
      </nav>

      {/* Desktop auth buttons — hidden ≤880px via media query below */}
      <div className="flex-row desktop-auth">
        {isAuthed ? (
          <a href="/dashboard" className="btn btn-violet">
            Open dashboard
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
          </a>
        ) : (
          <>
            <a href="/login" style={{ fontSize: 14, color: "var(--ink-muted)", padding: "8px 12px" }}>
              Log in
            </a>
            <a href="/register" className="btn btn-violet">
              Start free trial
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
            </a>
          </>
        )}
      </div>

      {/* Hamburger — visible ≤880px */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="mobile-hamburger"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Mobile overlay menu — rendered via React Portal at <body> root.
          IMPORTANT: must NOT live inside <header class="nav"> because .nav
          has backdrop-filter set, which makes it a containing block for
          position: fixed descendants — meaning a "fixed inset:0" overlay
          inside .nav gets clipped to the nav strip, not the viewport.
          Portal escapes that entirely. */}
      {open && mounted && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "#07080d",
            display: "flex",
            flexDirection: "column",
            padding: "20px 24px 32px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginBottom: 24,
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              style={{
                background: "transparent",
                border: "1px solid var(--border-strong)",
                color: "var(--ink)",
                width: 44,
                height: 44,
                borderRadius: 12,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <nav style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <NavLinks mobile />
          </nav>

          <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
            {isAuthed ? (
              <a
                href="/dashboard"
                className="btn btn-violet btn-lg"
                style={{ justifyContent: "center" }}
                onClick={closeOnNav}
              >
                Open dashboard
              </a>
            ) : (
              <>
                <a
                  href="/login"
                  className="btn btn-ghost btn-lg"
                  style={{ justifyContent: "center" }}
                  onClick={closeOnNav}
                >
                  Log in
                </a>
                <a
                  href="/register"
                  className="btn btn-violet btn-lg"
                  style={{ justifyContent: "center" }}
                  onClick={closeOnNav}
                >
                  Start free trial
                </a>
              </>
            )}
          </div>
        </div>,
        document.body
      )}

      <style>{`
        .mobile-hamburger {
          display: none;
          width: 44px;
          height: 44px;
          background: transparent;
          border: 1px solid var(--border-strong);
          border-radius: 12px;
          color: var(--ink);
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        @media (max-width: 880px) {
          .desktop-auth { display: none !important; }
          .mobile-hamburger { display: inline-flex; }
        }
      `}</style>
    </>
  );
}
