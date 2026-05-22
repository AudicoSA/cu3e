"use client";

// Floating "talk to Echo" button pinned to the bottom-right of the chat
// area. Always visible regardless of scroll position — the existing header
// button gets pushed out of view as the chat grows, which made voice mode
// hard for kids to find mid-session. The FAB stays put.
//
// Tap → fires onPress (study-hub opens VoiceTalk). Disabled when no child
// is selected; hidden entirely when the voice modal is already open.

type Props = {
  onPress: () => void;
  disabled?: boolean;
  hidden?: boolean;
};

export default function TalkToEchoFab({ onPress, disabled, hidden }: Props) {
  if (hidden) return null;
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label="Talk to Echo by voice"
      style={{
        position: "fixed",
        right: 20,
        bottom: 20,
        zIndex: 50,
        width: 64,
        height: 64,
        borderRadius: 999,
        border: "none",
        background:
          "radial-gradient(circle at 30% 30%, var(--violet) 0%, #5a3fd6 60%, #3b2599 100%)",
        color: "#fff",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        boxShadow:
          "0 10px 30px rgba(138, 107, 255, 0.45), 0 2px 6px rgba(0, 0, 0, 0.3)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "transform 180ms ease, box-shadow 180ms ease",
      }}
      onMouseDown={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.94)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
      onTouchStart={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(0.94)";
      }}
      onTouchEnd={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
      }}
    >
      {/* Soft pulse behind the icon when idle so it draws the eye without being noisy */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          inset: -6,
          borderRadius: 999,
          border: "1px solid rgba(138, 107, 255, 0.5)",
          animation: disabled ? "none" : "fabPulse 2.4s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <svg
        width="26"
        height="26"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
      <style>{`
        @keyframes fabPulse {
          0%, 100% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.18); opacity: 0; }
        }
      `}</style>
    </button>
  );
}
