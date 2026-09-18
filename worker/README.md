# Channel Pulse public audit API

Cloudflare Worker reference backend for public channel audits, related-video benchmarks, and market trends.

## Why a backend is required

The operator's YouTube Data API key must not be embedded in GitHub Pages. This Worker keeps it in a server-side secret, validates input, restricts browser origins, batches requests, and caches public responses.

## Deploy

```bash
cd worker
wrangler secret put YOUTUBE_API_KEY
wrangler deploy
```

Then copy the resulting Worker URL into `public/app-config.json` as `publicApiBaseUrl`, rebuild, and push the generated `docs/` output.

## Endpoints

- `GET /health`
- `GET /api/channel?url=https://youtube.com/@handle`
- `GET /api/benchmarks?query=topic&channelId=UC...&region=KR`
- `GET /api/trends?query=topic&region=KR&hours=168`

Public responses are cached for 15 minutes. `MAX_UPLOADS` defaults to 1,000 and can be set up to 2,000.
