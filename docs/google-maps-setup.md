# Google Maps API Setup

This document describes how to configure Google Maps API keys for the Fahrdienst application, including required APIs, key restrictions, and budget alerts.

## Required APIs

Enable the following APIs in the [Google Cloud Console](https://console.cloud.google.com/apis/library):

| API | Used for |
|-----|----------|
| Maps JavaScript API | Interactive maps in the browser (dashboard map, ride detail) |
| Maps Static API | Static map images (dashboard overview, order sheets) |
| Geocoding API | Converting addresses to coordinates (server-side, `geocodeAddress`) |
| Places API | Address autocomplete (if implemented in future) |
| Directions API | Route calculation and distance estimation (if implemented in future) |

**Minimum required**: Maps Static API + Geocoding API (these are used today).

## API Keys

The application uses two separate API keys:

### 1. Client Key (Browser)

- **Env variable**: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
- **Used in**: Browser-rendered maps, `<img>` tags for static maps
- **Restriction type**: HTTP referrer

### 2. Server Key

- **Env variable**: `GOOGLE_MAPS_SERVER_API_KEY`
- **Used in**: Server-side geocoding (`src/lib/maps/geocode.ts`), server components
- **Restriction type**: IP address
- **Important**: This key must NEVER be exposed to the client. It is only used in Server Components and Server Actions.

## Setting Up HTTP Referrer Restrictions (Client Key)

1. Go to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your client API key
3. Under **Application restrictions**, select **HTTP referrers (web sites)**
4. Add the following referrer patterns:

```
https://your-domain.ch/*
https://*.vercel.app/*
http://localhost:3000/*
```

5. Under **API restrictions**, select **Restrict key** and enable only:
   - Maps JavaScript API
   - Maps Static API
6. Click **Save**

## Setting Up IP Restrictions (Server Key)

1. Go to [Google Cloud Console > Credentials](https://console.cloud.google.com/apis/credentials)
2. Click on your server API key
3. Under **Application restrictions**, select **IP addresses (web servers, cron jobs, etc.)**
4. Add the IP addresses of your deployment:
   - For Vercel: Add Vercel's outbound IP ranges (see [Vercel docs](https://vercel.com/docs/security/deployment-protection))
   - For local development: Add your development machine's public IP
5. Under **API restrictions**, select **Restrict key** and enable only:
   - Geocoding API
   - Directions API (if used)
6. Click **Save**

**Note**: Vercel uses dynamic IPs for serverless functions. If IP restriction is impractical, rely on API restrictions (limiting which APIs the key can access) and budget alerts as the primary safeguards.

## Environment Variables

### Local Development (`.env.local`)

```env
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIza...   # Client key (HTTP referrer restricted)
GOOGLE_MAPS_SERVER_API_KEY=AIza...         # Server key (IP restricted)
```

### Vercel Deployment

Set both variables in the Vercel dashboard under **Settings > Environment Variables**:

- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` — available in all environments
- `GOOGLE_MAPS_SERVER_API_KEY` — available in all environments, NOT prefixed with `NEXT_PUBLIC_`

## Setting Up Budget Alerts

1. Go to [Google Cloud Console > Billing > Budgets & alerts](https://console.cloud.google.com/billing/budgets)
2. Click **Create budget**
3. Configure:
   - **Name**: `Google Maps API Budget`
   - **Scope**: Select the project used for Fahrdienst
   - **Amount**: Set a monthly budget (e.g., CHF 50)
   - **Thresholds**: Add alerts at 50%, 80%, and 100% of budget
4. Under **Notifications**:
   - Enable email notifications to billing admins
   - Optionally connect a Pub/Sub topic for programmatic alerts
5. Click **Finish**

### Additional Safety: Quota Limits

For extra protection, set per-day quota limits on each API:

1. Go to [APIs & Services > Enabled APIs](https://console.cloud.google.com/apis/dashboard)
2. Click on each Maps API
3. Go to **Quotas & System Limits**
4. Set a reasonable daily request limit, for example:
   - Geocoding API: 1,000 requests/day
   - Maps Static API: 5,000 requests/day

## Cost Reference

As of 2024, Google Maps Platform pricing (pay-as-you-go):

| API | Price per 1,000 requests |
|-----|-------------------------|
| Maps Static API | $2.00 |
| Geocoding API | $5.00 |
| Maps JavaScript API | $7.00 |
| Directions API | $5.00–10.00 |

Google provides a $200/month free tier. For a small dispatch operation, this should cover normal usage.

## Troubleshooting

| Symptom | Likely cause |
|---------|-------------|
| Maps show "For development purposes only" watermark | API key has no billing account, or Maps JavaScript API is not enabled |
| Geocoding returns `REQUEST_DENIED` | Server key is missing or IP restriction blocks the request |
| Static maps show broken image | Client key is missing or HTTP referrer restriction blocks the domain |
| `OVER_QUERY_LIMIT` errors | Daily quota exceeded — increase quota or wait until reset |
