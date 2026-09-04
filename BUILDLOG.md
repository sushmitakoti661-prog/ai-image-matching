# Build Log

## 2026-09-02

### Project Setup
- Created the Node.js + Express project.
- Installed Express, Zod, PostgreSQL driver (`pg`), dotenv, and Nodemon.
- Added project folder structure (`src/db`, `src/jobs`, `src/routes`, `src/services`, `data/images`).
- Added `.gitignore`.
- Configured PostgreSQL with Docker Compose.
- Verified PostgreSQL is running in Docker.
- Verified Node.js connection to PostgreSQL.

### Database
- Created `images` table.
- Created `image_metadata` table.
- Created `posts` table.
- Created `embeddings` table.
- Created `suggestions` table.
- Created `reviews` table.
- Added indexes for common lookups.

### Design
- Created initial `DESIGN.md`.
- Defined the image understanding pipeline.
- Defined semantic matching and mismatch guard.
- Defined planned API endpoints.
- Defined background processing and evaluation approach.

---

## 2026-09-04 — Phase 1: Design & Foundation

### Database & Schema Enhancements
- Added `ai_costs` table to `src/db/schema.sql` to support token-level cost tracking and budget guard enforcement.
- Ran `node src/db/initDb.js` and confirmed database schema migration executed cleanly against the PostgreSQL container.
- Ran `node src/db/testConnection.js` and confirmed active connection to Docker PostgreSQL 16.

### Architectural & System Design Finalization
- Expanded `DESIGN.md` with layered architecture, ERD, Zod schemas, mismatch guard rules, 44-image corpus plan, and 10-post evaluation plan.
- Created `README.md` and updated `.env.example`.
- Verified `.gitignore` retains `data/images/`.

---

## 2026-09-04 — Phase 2: Image Understanding Pipeline

### Real Licensed Image Corpus
- Created `src/db/downloadCorpus.js` and downloaded **44 actual licensed JPEG images** from Unsplash across 4 categories:
  - `animals` (11 images: Red foxes in snow/woodland/portrait, grey wolves in howling/forest/winter, tabby/siamese cats, golden retrievers, and a blurry silhouette test case)
  - `food` (11 images: Margherita & pepperoni pizza, pasta carbonara & bolognese, sushi nigiri & maki rolls, artisan burger, street tacos, chocolate lava cake, greek salad, and underexposed mystery dish)
  - `nature` (11 images: Alpine sunrise, rocky ridge, Sahara sand dunes, desert oasis, autumn forest trail, redwood mist, tropical ocean, cliff waves, rainforest waterfall, alpine lake, and overexposed sky)
  - `vehicles` (11 images: Red sports coupe, yellow supercar, vintage cafe motorcycle, blue sportbike, commercial jet, light cessna, container cargo ship, luxury sailboat, bullet train, road bicycle, and night motion blur streak)
- Saved `data/images/manifest.json` documenting every file's direct URL, description, and Unsplash License terms.

### Vision AI Engine & Strict Validation
- Built `src/services/schema.js` defining `ImageMetadataSchema` with Zod (`subject`, `category`, `attributes`, `caption`, `confidence`).
- Implemented `src/services/visionService.js` with direct Google Gemini Vision API (`gemini-1.5-flash`) support when `GEMINI_API_KEY` is present, while maintaining a clean decoupled `vision-local-dev` fallback for offline development and testing.
- Ensured API keys are never exposed in log outputs or database entries.
- Enforced automatic low-confidence detection (`low_confidence = true` when `confidence < 0.70`).

### AI Cost Metering & Budget Enforcement
- Built `src/services/costService.js` with per-token pricing calculation, active database persistence to `ai_costs`, and active budget guard check against `AI_BUDGET_LIMIT_USD`.

### Batch Processing & Background Execution
- Built `src/services/batchProcessor.js` supporting batch limits, real-time progress logging, and exponential backoff retries.
- Built `src/jobs/processImages.js` CLI runner.
- Processed the 44 images through the pipeline: 44/44 succeeded, 4 correctly flagged as low-confidence.

### REST API & Automated Test Suite
- Built `src/routes/imageRoutes.js` and `src/routes/costRoutes.js`.
- Mounted routes into `server.js`.
- Created automated test suite `test/phase2.test.js` (8/8 tests passing).

### Phase 2 Verification Update — 2026-09-04
- Enforced `REQUIRE_REAL_AI=true` so `VISION_PROVIDER=local` cannot override a real-provider verification run.
- Added extension-based MIME detection for JPEG, PNG, and WebP images sent to Gemini.
- Added `FORCE_RECHECK=true` support to the image job for explicit full-corpus reprocessing.
- Made the image job exit nonzero when a batch has failures.
- Verified the real Gemini request path was selected with a configured key. The 44-image recheck was blocked by the project Gemini free-tier quota (`429`, limit 20 requests); no local fallback occurred.
- Existing offline/database acceptance suite remains 8/8 passing.
- Added an explicit `IMAGE_FILENAMES` allowlist for representative real-provider verification without changing normal batch behavior.
- Attempted the four-image representative run (`fox_woodland_1.jpg`, `wolf_howling_1.jpg`, `golden_retriever_park_1.jpg`, and `animal_silhouette_blurry.jpg`) with `REQUIRE_REAL_AI=true`; all four Gemini requests returned `429 Too Many Requests` because the free-tier quota remained exhausted. No metadata or cost records were created from failed calls, and no local fallback occurred.
- A trial with `gemini-2.5-flash` was rejected by Gemini with `404 Not Found` because that model is unavailable to this account; the configured `gemini-3.6-flash` run was then restored and remained quota-blocked.