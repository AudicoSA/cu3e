# CU3E live relay — Face-to-Face with Echo

A small Node server that connects the study-hub to **Gemini 3.8 Live with Live Avatar**. It keeps your Google credentials off the tablet and holds the long-lived WebSocket. Vercel can't hold that socket, and Vertex has no browser-safe tokens.

```
tablet (AvatarTalk.tsx) ──WS──► live-relay ──WS──► gemini-3.8-live (+ avatar)
        ▲                                                     │
        └──────── fMP4 video + captions ◄─────────────────────┘
Next.js /api/avatar-session builds Echo's prompt and signs a 60-second ticket
```

## 1. One-time Google setup (about 10 minutes)

1. Create a Google Cloud project, or reuse one, and turn on billing.
2. In the console, enable the **Gemini Enterprise Agent Platform** (Vertex AI) API.
3. Open **Agent Platform → Studio → Multimodal Live**. Check that `gemini-3.8-live` works there with an avatar, and note the **preset avatar names** it offers.
4. On your PC, install the [gcloud CLI](https://cloud.google.com/sdk/docs/install) and run:
   ```
   gcloud auth application-default login
   gcloud config set project YOUR_PROJECT_ID
   ```

## 2. Run the spike (no app needed)

```bash
cd live-relay
npm install
cp .env.example .env        # fill in LIVE_RELAY_SECRET + GOOGLE_CLOUD_PROJECT (+ AVATAR_NAME)
npm run spike               # or: npm run spike -- "Sê hallo in Afrikaans"
```

This writes `out/avatar.mp4` for you to watch, prints time-to-first-video, bitrate and token usage, and saves every message shape to `out/messages.log`. If it fails, the error and `messages.log` show what the API expects.

Try the three languages:
```bash
npm run spike -- "Say hello to Tatum and ask what she wants to learn"
npm run spike -- "Sê hallo vir Tatum en vra wat sy wil leer"
npm run spike -- "Sawubona Tatum, ufuna ukufundani namuhla?"
```

## 3. Run it with the app locally

Terminal 1:
```bash
cd live-relay && npm start           # listens on :8787
```

In the app's `.env.local`, add:
```
NEXT_PUBLIC_LIVE_RELAY_URL=ws://localhost:8787
LIVE_RELAY_SECRET=<same value as the relay's .env>
# AVATAR_MAX_SESSION_MINUTES=15
```

Terminal 2:
```bash
npm run dev
```

Open `/study-hub`. A teal **camera button** appears above the mic button. Tap it to start **Face-to-Face with Echo**.

To test from the kids' tablet on your home Wi-Fi, use your PC's LAN IP (`ws://192.168.x.x:8787`). Browsers only allow the microphone on `https://` or `localhost`, though, so for tablets you'll want step 4.

## 4. Deploy for the tablets (Cloud Run)

```bash
cd live-relay
gcloud run deploy cu3e-live-relay --source . --region europe-west4 \
  --allow-unauthenticated --timeout 3600 --session-affinity \
  --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=europe-west4,AVATAR_NAME=Kai,ALLOWED_ORIGINS=https://cu3e-hazel.vercel.app \
  --set-env-vars LIVE_RELAY_SECRET=YOUR_SECRET
```

Give the Cloud Run service account the **Vertex AI User** role. Then set `NEXT_PUBLIC_LIVE_RELAY_URL=wss://<cloud-run-url>` and `LIVE_RELAY_SECRET` in Vercel and redeploy.

## Settings (`.env`)

| Var | Default | What it does |
|---|---|---|
| `LIVE_RELAY_SECRET` | *(required)* | Shared with the app. The app uses it to sign tickets. |
| `GOOGLE_GENAI_USE_VERTEXAI` / `GOOGLE_CLOUD_PROJECT` / `GOOGLE_CLOUD_LOCATION` | `europe-west4` | Vertex backend. |
| `GEMINI_API_KEY` | | Alternative backend. Avatar may not be enabled on API keys. |
| `GEMINI_LIVE_MODEL` | `gemini-3.8-live` | |
| `AVATAR_NAME` | `Kai` | Preset avatar id. |
| `AVATAR_IMAGE_PATH` | | Custom avatar image (allowlisted projects; 9:16, at least 704×1280). |
| `AVATAR_ENABLED` | `true` | `false` means Gemini voice only, and the app shows the static owl. |
| `AVATAR_VIDEO_BITRATE_BPS` | | Lower means less data. |
| `SPEECH_LANGUAGE_CODES` | | e.g. `af:af-ZA,zu:zu-ZA`. Only set this if auto-detection misbehaves. |
| `MAX_SESSION_MINUTES` | `15` | Hard cap per call. The ticket's value from the app wins. |
| `MAX_CONCURRENT_SESSIONS` | `3` | |
| `ALLOWED_ORIGINS` | *(any)* | Comma-separated browser origins. |
| `RELAY_DEBUG` | `false` | Log every Gemini message. The first 40 are always logged. |

## Tests

```bash
npm test     # ticket signing + bridge (fake Gemini): media, transcripts, end_session tool, goAway resume
```

## What happens in a call

- The mic is streamed as PCM16 at 16 kHz. Gemini's server-side voice detection handles turn-taking and barge-in, and the relay passes `interrupted` on so the tablet drops Echo's unplayed video.
- **Show homework** sends the camera at 1 frame per second (640 px), with an "Echo can see" badge on screen. Frames are never stored.
- Echo calls the `end_session` tool when the child says goodbye. The call also ends after 45 seconds of silence or at the time cap.
- Transcripts go to `/api/voice-save` and `/api/grade-session`, just like the normal voice calls, so the parent dashboard and Echo's memory include face-to-face calls.
- Google closes the connection roughly every 10 minutes. The relay then reconnects using the session-resumption handle, and the child sees "Echo blinked — reconnecting…".
