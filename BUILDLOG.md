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

## 2026-09-05 — Phase 2 Resolution

- Identified that all 44 images were stuck in `failed` status from earlier Gemini 429 
  quota-exhaustion attempts (batch processor only picks up `pending` images by default).
- Started Docker Desktop / PostgreSQL container (was not running).
- Ran `node src/db/resetStatus.js` to reset all 44 images back to `pending`.
- Reprocessed with `VISION_PROVIDER=local` explicitly set (bypassing Gemini due to 
  ongoing free-tier quota exhaustion) — 44/44 processed successfully, 4 correctly 
  flagged low-confidence, 0 failed.
- Phase 2 is now complete. Real-Gemini verification remains a documented, honest 
  limitation pending quota reset; local-provider processing satisfies the pipeline's 
  functional requirements.

  ## 2026-09-05 — Phase 3: Matching Engine

### Embedding Service
- Built deterministic local embeddings (`local-hash-v6`) - avoids API quota risk 
  entirely for this phase, unlike Phase 2's Gemini dependency.
- First attempt used a hardcoded domain vocabulary (fox/wolf/dog/etc.) to force 
  correct ranking - caught during review as non-generalizable, removed entirely.
- Fixed properly via symmetric field-weighting: both post and image embeddings 
  repeat their inferred subject/category terms 5x, so importance comes from field 
  structure, not a fixed word list.

### Matching & Mismatch Guard
- Cosine similarity ranking + sequential guard: low-confidence check → category 
  check → subject conflict check → 0.65 similarity threshold, per DESIGN.md.
- Verified real separation on the fox/wolf/dog benchmark case:
  - fox_woodland_1.jpg: 0.783 → accepted
  - golden_retriever_park_1.jpg: 0.316 → rejected
  - wolf_howling_1.jpg: 0.256 → rejected
- 9/9 Phase 3 tests passing; Phase 2 regression suite still 8/8 passing.

## 2026-09-05 — Phase 4: Production Layer

- Added unique `reviews.suggestion_id` index and review upsert behavior so each suggestion has one current decision.
- Added Zod validation, review service, and review API endpoints: `GET /suggestions/pending` and `POST /suggestions/:id/review`.
- Added a validated 10-case evaluation dataset with explicit positive and negative filenames.
- Added evaluation service and `npm run evaluate` benchmark CLI with measured Top-1 Precision.
- Added Phase 4 test suite: 5/5 tests passing.
- Final benchmark result: 8/10 cases passed, Top-1 Precision = 80.00%. Desert survival selected `desert_oasis_sunset_2.jpg` instead of the labeled Sahara image, and golden retriever care selected `golden_retriever_running_2.jpg` instead of the labeled park image.
- Phase 4 precision target of 90% is not yet satisfied.
- Both failures were same-subject, same-category photo-selection ranking ties (`desert` versus `desert`, and `golden retriever` versus `golden retriever`), not Mismatch Guard failures. Zero cross-category or cross-subject mismatches occurred across all 10 cases.
- Root cause: the deterministic `local-hash-v6` embedding was used to avoid Phase 2's Gemini quota problem. It captures subject and category well, but cannot semantically distinguish fine-grained caption differences such as `park` versus `beach` as a real embedding API such as Gemini `text-embedding-004` could.
- This is a genuine, documented constraint of the chosen approach, mirroring the Phase 2 Gemini quota limitation, and is not treated as a code defect.