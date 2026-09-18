# ROMANCE PULSE — Personal OAuth Architecture

## Goal

Provide a private-data dashboard for the single YouTube channel `@낭만구조대` without receiving account passwords, storing API keys, or running a backend.

## Data flow

```text
Public GitHub Pages shell
  └─ Google Identity Services popup
       └─ short-lived OAuth access token (memory only)
            ├─ YouTube Data API
            │    ├─ channels.list(mine)
            │    ├─ uploads playlist + all video details
            │    ├─ related winner search
            │    └─ market trend search
            └─ YouTube Analytics API
                 ├─ 365-day video metrics
                 └─ traffic source report

Optional Studio CSV
  └─ parsed and merged in browser memory only
```

There is no application server, operator API key, password database, refresh-token database, or Client Secret.

## Access controls

### Control 1: Google test-user allowlist

The OAuth consent screen remains in Testing mode. Only the channel owner's Google email is registered as a Test user, so other Google accounts cannot authorize the client.

### Control 2: target channel verification

After authorization, the app retrieves `channels.list(mine=true)` and compares the returned channel with runtime configuration:

- If `targetChannelId` is set, the exact immutable `UC...` ID must match.
- Otherwise the NFC-normalized, percent-decoded custom handle must equal `@낭만구조대`.

A mismatch revokes the token, clears state, and renders no channel data.

### Control 3: no persisted tokens or channel data

The access token is held in a module variable. It is not written to cookies, Local Storage, IndexedDB, logs, repository files, or analytics. Reload and logout discard it. CSV contents and diagnosis results also remain in the current browser tab.

## Public-shell boundary

GitHub Pages is a public static host. Anyone can load the login shell or inspect the public source, but source files contain no password, API key, Client Secret, token, or channel analytics. Google and the target-channel check protect actual data.

If hiding even the login shell becomes a requirement, move the same static build behind an identity-aware host such as Cloudflare Access. That is separate from protecting YouTube data and is not required for the current single-user data boundary.

## OAuth scopes

- `youtube.readonly`: own channel metadata, uploads and authenticated public search
- `yt-analytics.readonly`: owner Analytics reports

No upload, edit, delete, revenue, or account-management scope is requested.

## Metrics and trust

- Owner API metrics are labeled measured.
- Title/thumbnail heuristics are labeled inferred.
- Missing data remains unavailable rather than becoming zero.
- Studio CSV can add impressions, CTR and content-type evidence.
- A video at or below 180 seconds is only a Shorts candidate until Studio content type verifies it.

## Session behavior

1. User opens the public shell.
2. User explicitly clicks the Google login button.
3. Google displays account and consent UI; the app never sees a password.
4. App retrieves and verifies the channel before rendering any dashboard.
5. API calls reuse the in-memory access token until expiry.
6. Expiry prompts a new Google authorization; logout calls token revocation.

## Build-time configuration

`public/app-config.json` contains only public identifiers:

```json
{
  "googleOAuthClientId": "",
  "targetChannelHandle": "@낭만구조대",
  "targetChannelId": ""
}
```

The build embeds this JSON in `docs/index.html`. Secret values are prohibited.
