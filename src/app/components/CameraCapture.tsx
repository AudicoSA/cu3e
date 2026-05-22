"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Full-screen camera viewfinder for snapping a homework photo on the kiosk
// tablet. Targets the rear camera (facingMode: environment) so the kid can
// point at a worksheet on a desk. After a capture we show a preview with
// "Use this" / "Retake" — only on confirm does the photo bubble up via
// onCapture as a JPEG File that slots into the existing handleFileUpload
// pipeline (same path as a dragged-in PDF).
//
// Stream is torn down on unmount and on capture-confirm to release the
// camera light immediately.

type Props = {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
};

export default function CameraCapture({ open, onClose, onCapture }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const [starting, setStarting] = useState(false);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      for (const t of streamRef.current.getTracks()) t.stop();
      streamRef.current = null;
    }
  }, []);

  const startStream = useCallback(async () => {
    setError(null);
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Camera unavailable: ${msg}`);
    } finally {
      setStarting(false);
    }
  }, []);

  // Lifecycle: start stream when the modal opens; stop on close / unmount.
  useEffect(() => {
    if (!open) return;
    void startStream();
    return () => {
      stopStream();
    };
  }, [open, startStream, stopStream]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (preview) {
          setPreview(null);
          void startStream();
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, preview, startStream]);

  const snap = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        // Pause the live stream while previewing — don't keep the camera
        // light on when we don't need it.
        stopStream();
        setPreview({ url: URL.createObjectURL(blob), blob });
      },
      "image/jpeg",
      0.92
    );
  }, [stopStream]);

  const accept = useCallback(() => {
    if (!preview) return;
    const file = new File([preview.blob], `homework-${Date.now()}.jpg`, { type: "image/jpeg" });
    URL.revokeObjectURL(preview.url);
    setPreview(null);
    onCapture(file);
    onClose();
  }, [preview, onCapture, onClose]);

  const retake = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
    void startStream();
  }, [preview, startStream]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Take a photo of your homework"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 250,
        background: "#000",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Viewfinder area */}
      <div
        style={{
          flex: 1,
          position: "relative",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.url}
            alt="Captured homework"
            style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
          />
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: "scaleX(1)",
            }}
          />
        )}

        {/* Alignment frame — guides the kid to fill the viewfinder with the
            worksheet. Hidden on preview. */}
        {!preview && !starting && !error && (
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: "10% 6%",
              border: "2px dashed rgba(255,255,255,0.45)",
              borderRadius: 16,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Top hint / status bar */}
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            right: 24,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            color: "#fff",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ opacity: 0.85 }}>
            {error ? "Couldn't open camera" : preview ? "Looks right?" : starting ? "Opening camera…" : "Fit the page inside the frame"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close camera"
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 999,
              padding: "8px 14px",
              color: "#fff",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            Close
          </button>
        </div>

        {error && (
          <div
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              padding: "16px 22px",
              background: "rgba(0,0,0,0.7)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 12,
              color: "#fff",
              fontSize: 13,
              maxWidth: 320,
              textAlign: "center",
              lineHeight: 1.55,
            }}
          >
            {error}
            <div style={{ marginTop: 10 }}>
              <button
                type="button"
                onClick={() => void startStream()}
                className="btn btn-violet"
                style={{ fontSize: 13 }}
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div
        style={{
          padding: 28,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(10px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 28,
        }}
      >
        {preview ? (
          <>
            <button
              type="button"
              onClick={retake}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 999,
                padding: "12px 22px",
                color: "#fff",
                cursor: "pointer",
                fontSize: 15,
                fontWeight: 500,
              }}
            >
              Retake
            </button>
            <button
              type="button"
              onClick={accept}
              style={{
                background: "var(--violet)",
                border: "none",
                borderRadius: 999,
                padding: "14px 28px",
                color: "#fff",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 600,
                letterSpacing: "0.01em",
                boxShadow: "0 8px 24px rgba(138,107,255,0.45)",
              }}
            >
              Use this photo
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={snap}
            disabled={starting || !!error}
            aria-label="Take photo"
            style={{
              width: 78,
              height: 78,
              borderRadius: 999,
              border: "4px solid rgba(255,255,255,0.85)",
              background: "#fff",
              cursor: starting || error ? "not-allowed" : "pointer",
              opacity: starting || error ? 0.4 : 1,
              padding: 0,
              boxShadow: "0 0 0 6px rgba(255,255,255,0.18)",
              transition: "transform 120ms ease",
            }}
            onMouseDown={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.94)")}
            onMouseUp={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
            onTouchStart={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(0.94)")}
            onTouchEnd={(e) => ((e.currentTarget as HTMLButtonElement).style.transform = "scale(1)")}
          />
        )}
      </div>

      {/* Hidden canvas used for the capture-to-blob step */}
      <canvas ref={canvasRef} style={{ display: "none" }} />
    </div>
  );
}
