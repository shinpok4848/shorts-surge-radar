# MY CHANNEL PULSE — Personal Multi-Channel OAuth Architecture

## Goal

Provide a private, single-user creator desk for the owner's own YouTube channels. It diagnoses each channel, produces original 60-second CapCut work packs, and uploads or schedules finished videos, without receiving account passwords, storing API keys, or running a backend.

## Data flow

```text
Public GitHub Pages shell
  └─ Google Identity Services popup (per channel)
       └─ short-lived OAuth access token (memory only, keyed by channelId)
            ├─ YouTube Data API
            │    ├─ channels.list(mine)
            │    ├─ uploads playlist + all video details
            │    ├─ related winner search
            │    ├─ market trend search
            │    └─ resumable videos.insert upload
            └─ YouTube Analytics API
                 ├─ 365-day video metrics
                 └─ traffic source report

Optional Studio CSV
  └─ parsed and merged in browser memory only

CapCut work pack
  └─ SRT/TXT/CSV/JSON generated and zipped fully in the browser
```

There is no application server, operator API key, password database, refresh-token database, or Client Secret.

## Access controls

### Control 1: Google test-user allowlist

The OAuth consent screen stays in Testing mode. Only the owner's Google emails are registered as Test users, so other accounts cannot authorize the client.

### Control 2: explicit account chooser per channel

Every connection forces `prompt=select_account consent`, so the owner deliberately picks which Google account or brand channel to attach. Each connection produces an independent in-memory session keyed by channel ID.

### Control 3: no persisted tokens or channel data

Access tokens live in module-scoped maps only. Nothing is written to cookies, Local Storage, IndexedDB, logs, repository files, or analytics. Reload and disconnect discard tokens, datasets, CapCut drafts, and uploads. CSV contents and diagnosis results also stay in the current browser tab.

## Public-shell boundary

GitHub Pages is a public static host. Anyone can load the login shell or read the public source, but source files contain no password, API key, Client Secret, token, or channel analytics. Google OAuth (Testing test-user allowlist) protects real data. To also hide the login shell, place the same static build behind an identity-aware host such as Cloudflare Access; that is independent of the data boundary above.

## OAuth scopes

- `youtube.readonly`: channel metadata, uploads, authenticated public search
- `yt-analytics.readonly`: owner Analytics reports
- `youtube.upload`: resumable video upload and scheduling on the owner's channel

No edit, delete, revenue, or account-management scope is requested.

## CapCut production model

- Seeds come from the owner's <=60s videos or <=60s market videos.
- The draft is newly written from public topic/structure signals. Exact third-party transcripts, footage, and audio are never copied or downloaded.
- The owner edits the draft or pastes rights-owned text and must confirm rights before export.
- Export is a standard ZIP: UTF-8 SRT timed under 60s, voiceover TXT, shot-list CSV, YouTube metadata TXT+JSON, and a reference/rights note. CapCut Desktop/Web import the SRT; no proprietary CapCut project file is fabricated.

## Upload and scheduling model

- The owner selects a finished local video file; it uploads directly from the browser to the active channel via the resumable protocol.
- Uploads default to `privacyStatus=private`.
- Scheduled publication sets `status.publishAt` and is gated behind a minimum lead time and an explicit audit-completed confirmation, because unaudited API projects created after 2020-07-28 are restricted to private uploads.
- Made-for-kids and synthetic-media declarations map to `selfDeclaredMadeForKids` and `containsSyntheticMedia`.

## Metrics and trust

- Owner API metrics are labeled measured.
- Title/thumbnail heuristics are labeled inferred.
- Missing data stays unavailable rather than becoming zero.
- Studio CSV can add impressions, CTR, and content-type evidence.
- A video at or below 180 seconds is a Shorts candidate until Studio content type verifies it.

## Build-time configuration

`public/app-config.json` contains only public identifiers:

```json
{
  "googleOAuthClientId": "",
  "appLabel": "MY CHANNEL PULSE"
}
```

The build embeds this JSON in `docs/index.html`. Secret values are prohibited.
