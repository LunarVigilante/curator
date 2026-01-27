# API Developer Guide

## Base URL

All API endpoints are versioned under `/api/v1/`.

## Authentication

Most endpoints require authentication via Supabase Auth session cookies. The middleware automatically validates sessions.

| Endpoint Type | Auth Required | Rate Limit |
|--------------|---------------|------------|
| AI (`/api/v1/ai/*`) | ✅ Yes | 10 req/min |
| Admin (`/api/v1/admin/*`) | ✅ Admin only | 60 req/min |
| Public | ❌ No | 10 req/min |

## Rate Limiting

Rate limits are enforced per-user (authenticated) or per-IP (anonymous) using Upstash Redis.

**Response headers on rate limit:**
- `X-RateLimit-Limit`: Max requests allowed
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: Reset timestamp
- `Retry-After`: Seconds until reset

**Rate limit exceeded response:**
```json
{ "error": "Too many requests. Please try again later.", "code": "RATE_LIMITED" }
```

## Error Responses

All errors follow a consistent format:

```json
{
  "error": "Human-readable message",
  "code": "ERROR_CODE"
}
```

**Standard Error Codes:**
- `BAD_REQUEST` (400)
- `UNAUTHORIZED` (401)
- `FORBIDDEN` (403)
- `NOT_FOUND` (404)
- `RATE_LIMITED` (429)
- `VALIDATION_ERROR` (400)
- `INTERNAL_ERROR` (500)

## AI Endpoints

### POST /api/v1/ai/generate-tags

Generate 5-8 relevant tags for an item.

**Request:**
```json
{
  "title": "The Matrix",
  "type": "movie",
  "description": "Optional context"
}
```

### POST /api/v1/ai/generate-description

Generate a curator-style description.

**Request:**
```json
{
  "title": "The Matrix",
  "type": "movie",
  "context": "Optional additional context"
}
```

### POST /api/v1/ai/generate-details

Generate both description and tags.

### POST /api/v1/ai/enrich-metadata

Fetch metadata from external providers (TMDB, OMDB, etc).

**Request:**
```json
{
  "itemId": "uuid",
  "title": "The Matrix",
  "force": false
}
```

### POST /api/v1/ai/regenerate-description

Full AI-powered description regeneration with embeddings.

**Request:**
```json
{
  "itemId": "uuid",
  "title": "The Matrix",
  "type": "movie",
  "includeTags": true
}
```

### POST /api/v1/ai/cluster

Cluster items by similarity.

**Request:**
```json
{
  "itemIds": ["uuid1", "uuid2"],
  "numClusters": 5
}
```

## Public Endpoints

### GET /api/v1/image-proxy?url={encoded_url}

Proxy external images to avoid CORS issues.

### GET /api/v1/invites/check?code={code}

Validate an invite code before registration.

### GET /api/v1/setup/check

Check if initial setup is required.

## Admin Endpoints

### GET /api/v1/admin/invites

List all invite codes.

### POST /api/v1/admin/invites

Create a new invite code.

### DELETE /api/v1/admin/invites?id={id}

Delete an invite.

### POST /api/v1/admin/users

Create a new user (admin only).

### POST /api/v1/admin/llm/models

Fetch available LLM models for a provider.

## Environment Variables

```env
# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Axiom (logging)
NEXT_PUBLIC_AXIOM_DATASET=curator
NEXT_PUBLIC_AXIOM_TOKEN=your-token
```
