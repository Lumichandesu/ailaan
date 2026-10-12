# Ailaan — Next.js Hero Rebuild

A single-viewport, no-scroll hero for Ailaan, the AI-powered flood alert
system for Khyber Pakhtunkhwa. Rebuilt in Next.js (App Router) with a
glassmorphic UI and an embedded live demo of the actual product concept.

## Stack
- Next.js 16 (App Router, Turbopack)
- Tailwind CSS v4
- `geist` (self-hosted Geist Sans + Geist Mono - no Google Fonts network call)
- `lucide-react` for icons (the GitHub mark is a hand-drawn inline SVG,
  since brand logos were removed from recent lucide-react versions)

## What's here
- `app/layout.js` - fonts, metadata, locks page-level scroll
- `app/page.js` - thin wrapper that renders the hero
- `components/Hero.js` - everything: background, header, copy, CTA, and the
  interactive glass demo card (district picker, risk indicator, language
  toggle, text-to-speech playback, WhatsApp subscribe)
- `app/globals.css` - color tokens, glass/pulse/rise utility classes
- `public/logo.webp`, `public/hero-bg.webp` - your provided assets

## Design notes
- **No scroll, both breakpoints:** the hero is locked to `h-dvh` with
  `overflow-hidden` on `<body>`. Below `sm`, the marketing copy compresses
  (shorter headline, hidden trust row) so the interactive demo - the actual
  product - always stays fully visible without scrolling. Tested down to
  360x640.
- **Built for non-literate users:** every district's risk is a color +
  icon (red/amber/green, universal), and the speaker button reads the
  warning aloud via the Web Speech API - no reading required at any step.
- **The CTA *is* the demo:** "Hear a live warning" doesn't link anywhere -
  it triggers the same alert-generation flow as tapping a district chip,
  so the hero's headline promise and its proof are the same action.
- Alert copy and risk levels for the 5 districts are illustrative in the UI
  layer. Real risk levels come from the `/api/flood-status` route handler,
  which queries the Google Flood Forecasting API and falls back to simulated
  data (flagged as such) when that is unavailable.

## Flood status API
`app/api/flood-status/route.js` is a Next.js Route Handler — there is no
separate backend service. It validates the district, applies rate limiting,
caches successful live results, and returns simulated data (flagged
`source: "simulated"`) when Google has no data.

### `POST /api/flood-status`
```json
{ "district": "nowshera", "coordinates": [] }
```
`district` must be one of `nowshera`, `charsadda`, `peshawar`, `swat`, `mardan`.
`coordinates` is accepted for backwards compatibility and ignored.

Response: `{ "district", "risk", "severity", "gaugeLocation", "issuedTime",
"forecastTrend", "hasInundationMap", "source" }`. `source` is
`google-flood-forecasting` (live) or `simulated`. The UI must label simulated
responses rather than present them as a real warning.

Errors: `400` unknown/missing district or malformed JSON, `429` rate limited.

## Configuration
Copy `.env.example` to `.env.local` for local development. All variables are
**server-side**; never prefix them with `NEXT_PUBLIC_`.

| Variable | Purpose |
| --- | --- |
| `GOOGLE_FLOOD_API_KEY` | Enables live data. Restrict the key to the Flood Forecasting API in Google Cloud. |
| `FLOOD_CACHE_SECONDS` | Cache TTL for live results (default 300). Caching is what keeps Google usage low. |
| `UPSTREAM_TIMEOUT_MS` | Google request timeout (default 10000). |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Distributed rate limiting. Without these the limiter is in-memory and per-instance. |
| `RATE_LIMIT_MAX` | Requests per IP per minute (default 30). |
| `GOOGLE_FLOOD_BASE_URL` | Optional upstream override for staging/tests. |

## Deploying to Vercel
1. Import the repo. Vercel detects Next.js; no build config needed.
2. Add the environment variables above under **Settings → Environment Variables**.
   Set `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` — they are required in
   production, not optional (see below).
3. Optionally add Vercel Firewall / WAF rate-limit rules as a second layer.

## Production caveats

Two things behave differently in production than in local development.

### Rate limiting needs Upstash in production

`lib/rateLimit.js` falls back to an in-memory counter when the Upstash variables
are unset. That fallback is fine locally, but on serverless it is **not real
protection**: every function instance has its own memory, so the effective limit
becomes `RATE_LIMIT_MAX × the number of warm instances`. This endpoint spends
Google API quota, so `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are
**required in production**, not recommended.

To confirm the distributed limiter is active after a deploy, send more than
`RATE_LIMIT_MAX` requests within a minute and check for `429`:

```bash
for i in $(seq 1 40); do
  curl -s -o /dev/null -w "%{http_code} " -X POST https://<your-domain>/api/flood-status \
    -H "Content-Type: application/json" -d '{"district":"nowshera"}'
done; echo
```

A Vercel Firewall / WAF rate-limit rule on `/api/flood-status` is worth adding as
a second layer so abuse is blocked before it reaches the function.

### Vercel plan

The project runs on the **Hobby** plan, which is licensed for **non-commercial
use only**. If Ailaan ever takes payment, runs ads, or is otherwise commercial,
the project must move to **Pro**. Hobby also has a lower function-duration cap
(~10 s default); the upstream timeout is `UPSTREAM_TIMEOUT_MS` (default 10 s).

## Run it
```bash
npm install
npm run dev
```


## Build
```bash
npm run build && npm start
```

## License

[MIT](LICENSE) © Jawad Ahmad

