# AI Image Understanding & Content Matching Engine

A backend service that processes images with Vision AI, generates structured metadata and text embeddings, ranks relevant images for blog posts, rejects unsafe mismatches, and supports human review.

## Key Features

- 44 real/licensed JPEG images across animals, food, nature, and vehicles.
- Gemini Vision integration with strict Zod validation and an explicit local development provider.
- Low-confidence detection at `confidence < 0.70`.
- Batch processing with progress reporting, retries, cost tracking, and budget protection.
- Deterministic local text embeddings with cosine similarity ranking.
- Mismatch Guard for confidence, category, subject, and similarity threshold checks.
- Human review API with one current decision per suggestion.
- Ten-post Top-1 Precision evaluation benchmark.

## Tech Stack

- Node.js and Express
- PostgreSQL 16 via Docker Compose
- Zod validation
- Google Generative AI SDK
- `pg` database driver

## Project Structure

```
ai-image-matching/
├── data/
│   ├── evaluation/
│   │   └── phase4Dataset.js     # Ten labeled evaluation posts and negatives
│   └── images/                  # 44 licensed corpus images
│       ├── manifest.json        # Sources and licensing information
│       ├── animals/
│       ├── food/
│       ├── nature/
│       └── vehicles/
├── src/
│   ├── db/
│   │   ├── db.js
│   │   ├── downloadCorpus.js
│   │   ├── initDb.js
│   │   ├── populateCorpus.js
│   │   ├── resetStatus.js
│   │   ├── schema.sql
│   │   └── testConnection.js
│   ├── jobs/
│   │   ├── evaluateMatching.js  # Phase 4 benchmark CLI
│   │   └── processImages.js      # Phase 2 batch processing job
│   ├── routes/
│   │   ├── costRoutes.js
│   │   ├── imageRoutes.js
│   │   ├── matchingRoutes.js
│   │   ├── postRoutes.js
│   │   └── reviewRoutes.js
│   └── services/
│       ├── batchProcessor.js
│       ├── costService.js
│       ├── embeddingService.js
│       ├── evaluationService.js
│       ├── imageService.js
│       ├── matchingService.js
│       ├── postService.js
│       ├── reviewService.js
│       ├── schema.js
│       └── visionService.js
├── test/
│   ├── phase2.test.js
│   ├── phase3.test.js
│   └── phase4.test.js
├── .env.example
├── BUILDLOG.md
├── DESIGN.md
├── EVIDENCE.md
├── package.json
└── server.js
```

## Getting Started

### 1. Prerequisites

- Node.js 18 or newer
- Docker Desktop and Docker Compose

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy `.env.example` to `.env` and configure the database and Gemini key when needed:

```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/image_matching
GEMINI_API_KEY=your_gemini_api_key_here
GEMINI_MODEL=gemini-3.6-flash
VISION_PROVIDER=local
REQUIRE_REAL_AI=false
FORCE_RECHECK=false
AI_BUDGET_LIMIT_USD=5.00
```

Use `VISION_PROVIDER=local` for local development and testing. It uses the deterministic local vision provider and local text embeddings, avoiding Gemini free-tier quota limits. Set `VISION_PROVIDER` to the configured real provider and `REQUIRE_REAL_AI=true` for a real-provider verification run. Real-provider failures never fall back to deterministic output.

### 4. Start PostgreSQL

```bash
docker compose up -d
npm run db:init
```

### 5. Download and Process the Corpus

```bash
npm run images:download
npm run images:process
```

To explicitly reprocess already-processed images, set `FORCE_RECHECK=true`. To process a representative subset, set `IMAGE_FILENAMES` to a comma-separated filename list.

### 6. Start the API

```bash
npm run dev
```

### 7. Create and Match a Post

Create a post:

```bash
curl -X POST http://localhost:3000/posts \
  -H "Content-Type: application/json" \
  -d '{"title":"The Secret Life of the Red Fox","content":"Red foxes live in North American woodlands."}'
```

Example response:

```json
{"status":"success","post":{"id":1,"title":"The Secret Life of the Red Fox","content":"Red foxes live in North American woodlands."}}
```

Run matching with the returned post ID:

```bash
curl -X POST http://localhost:3000/posts/1/match \
  -H "Content-Type: application/json" \
  -d '{"limit":5,"similarityThreshold":0.65}'
```

Example response:

```json
{
  "status": "success",
  "result": {
    "match": {
      "imageId": 6,
      "filename": "fox_woodland_1.jpg",
      "similarityScore": 0.78336,
      "guardStatus": "accepted",
      "explanation": "Accepted: semantic similarity passed and subject matches 'fox'."
    },
    "noMatch": false
  }
}
```

### 8. Review Suggestions

List pending suggestions:

```bash
curl http://localhost:3000/suggestions/pending
```

Review a suggestion. Repeating the request updates its current decision:

```bash
curl -X POST http://localhost:3000/suggestions/1/review \
  -H "Content-Type: application/json" \
  -d '{"decision":"approved"}'
```

Example response:

```json
{"status":"success","review":{"id":1,"suggestion_id":1,"decision":"approved"}}
```

### 9. Run Tests and Benchmark

```bash
npm test
npm run test:phase3
npm run test:phase4
npm run evaluate
```

The current benchmark result is 80.00% (8/10), below the 90% target in `DESIGN.md`. Both misses are same-subject, same-category photo-selection ranking differences, not cross-subject or cross-category guard failures.

## API Endpoints

### Health

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health check |

### Image Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/images` | List images with optional category, status, and low-confidence filters |
| `GET` | `/images/:id` | Retrieve one image and its structured metadata |
| `POST` | `/images` | Register one image |
| `POST` | `/images/scan` | Scan and register the image corpus |
| `POST` | `/images/process` | Process pending images with Vision AI |

### Matching and Review Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/posts` | Create a blog post |
| `GET` | `/posts/:id` | Retrieve a blog post |
| `POST` | `/posts/:id/match` | Generate ranked candidates and apply the Mismatch Guard |
| `GET` | `/suggestions/pending` | List suggestions without a review decision |
| `POST` | `/suggestions/:id/review` | Approve or reject a suggestion |

`POST /posts` accepts `{ "title": "...", "content": "..." }` and returns `{ "status": "success", "post": { ... } }`.

`POST /posts/:id/match` accepts `{ "limit": 5, "similarityThreshold": 0.65 }` and returns `{ "status": "success", "result": { "match": { ... }, "noMatch": false, "candidates": [ ... ] } }`.

`GET /suggestions/pending` returns `{ "status": "success", "count": 1, "suggestions": [ ... ] }`.

`POST /suggestions/:id/review` accepts `{ "decision": "approved" }` or `{ "decision": "rejected" }` and returns `{ "status": "success", "review": { "id": 1, "suggestion_id": 1, "decision": "approved" } }`.

### Cost Monitoring

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/costs` | Show AI call counts, token totals, costs, and remaining budget |

## Phase Status

- [x] Phase 1 - Design and Foundation
- [x] Phase 2 - Image Understanding Pipeline. Local acceptance completed; full Gemini verification remains documented as quota-blocked.
- [x] Phase 3 - Matching Engine
- [x] Phase 4 - Production Layer implementation. Benchmark measured 80.00% (8/10), below the 90% design target.
