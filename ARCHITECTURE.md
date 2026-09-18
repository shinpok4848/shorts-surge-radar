# Channel Pulse — Hybrid Channel Diagnosis Architecture

## Product goal

Turn SHORTS PULSE from a trend list into an action-oriented YouTube channel diagnosis product. A creator can begin with only a channel URL, deepen the analysis by connecting the channel through Google OAuth, and complement unavailable reach metrics with a local YouTube Studio CSV import.

## Data modes and trust

| Mode | Authentication | Data available | Data not claimed |
|---|---|---|---|
| Public quick audit | Channel URL; operator API key in server secret | Public uploads, titles, descriptions, tags, duration, published time, views, likes, comments | Impressions, CTR, retention, traffic sources, subscriber conversion |
| Owner deep audit | Google OAuth (`youtube.readonly`, `yt-analytics.readonly`) | Owned channel uploads plus views, watch time, average duration/percentage, engagement, subscriber gains/losses and traffic sources when supported | Metrics not returned by the API or still processing |
| Studio CSV | Local browser file parsing | Exported columns such as impressions, CTR, watch time, average view duration/percentage, subscribers and content type | Any column absent from the uploaded export |
| Demo | None | Fully labeled sample dataset for product exploration | Real channel performance |

Every score and recommendation carries a data basis: `measured`, `public`, `inferred`, or `unavailable`. Missing metrics are never displayed as zero.

## Deployment topology

```text
GitHub Pages frontend
  ├─ channel URL ───────────────► serverless public API
  │                                ├─ YouTube Data API v3
  │                                ├─ API key in server secret
  │                                └─ CDN cache + CORS allowlist
  ├─ Google OAuth access token ─► YouTube Data API + Analytics API
  │   (token remains in memory)
  └─ Studio CSV ────────────────► local parser; file never uploaded
```

The public API reference implementation lives in `worker/` and targets Cloudflare Workers. GitHub Pages cannot safely hold an operator API key or an OAuth refresh token.

## Public API contract

### `GET /api/channel?url=<channel-url>`

Accepts a YouTube `/channel/UC…`, `/@handle`, `/user/name`, raw channel ID, or `@handle`. Returns a channel profile and upload metadata. The server follows the channel uploads playlist and batches video detail requests. Responses are cached for 15 minutes.

### `GET /api/benchmarks?query=<topic>&channelId=<id>&region=KR`

Returns related public videos ordered by view count, excluding the audited channel. Called lazily for a selected video to reduce quota consumption.

### `GET /api/trends?query=<topic>&region=KR&hours=168`

Returns current market candidates for the secondary Market Radar tab.

## Diagnosis model

1. Normalize metrics within the same content format (video vs Shorts candidate).
2. Compare views per active day against the channel median.
3. Use measured CTR and retention when available; otherwise use metadata heuristics and label them inferred.
4. Score packaging, retention, reach, engagement, conversion, and consistency separately.
5. Generate evidence-led diagnoses before recommendations.
6. Prioritize topic, packaging and opening/retention. Tags remain a low-impact supporting field.

## Format classification

The YouTube Data API does not expose a reliable `isShort` field or video aspect ratio. Public/API-only data classifies uploads up to 180 seconds as `Shorts candidate`. A CSV content-type column can upgrade this to `verified`. The UI always exposes that confidence.

## Privacy and security

- OAuth access tokens are held in memory and discarded on reload/disconnect.
- Studio CSV files are parsed only in the browser and are never sent to a server.
- The public YouTube API key is stored only as a Worker secret.
- Server responses include restrictive CORS headers and cache public responses.
- Recommendations distinguish observed evidence from inference.
