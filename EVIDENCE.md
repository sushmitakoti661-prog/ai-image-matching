# Evidence

Evidence for the capstone will be added as each major phase is completed.

---

## Phase 1 — Design & Foundation

### 1. Architectural & Database Design
- **System Design Document:** `DESIGN.md` contains the complete system architecture, ERD, component flow, matching strategy, and mismatch guard rules.
- **Project Documentation:** `README.md` provides overview, setup instructions, database migrations, and API endpoint documentation.
- **Database Schema:** `src/db/schema.sql` defines all 7 required tables:
  - `images`
  - `image_metadata`
  - `posts`
  - `embeddings`
  - `suggestions`
  - `reviews`
  - `ai_costs`
- **Docker Compose:** `docker-compose.yml` configures PostgreSQL 16 on port `5432` with persistent storage volume `postgres_data`.

### 2. Environment & Database Verification
- **PostgreSQL Container Status:** Docker container `ai-image-matching-db` is active and healthy on port 5432.
- **Connection Test:** Output from `npm run db:test` / `node src/db/testConnection.js`:
  ```
  Database connected: { now: 2026-09-04T16:26:01.331Z }
  ```
- **Schema Initialization:** Output from `npm run db:init` / `node src/db/initDb.js`:
  ```
  Database schema created successfully.
  ```

### 3. Image Corpus & Git Configuration
- **Image Directory Structure:** `data/images/` contains 4 target category subdirectories:
  - `data/images/animals/`
  - `data/images/food/`
  - `data/images/nature/`
  - `data/images/vehicles/`
- **`.gitignore` Verification:** Verified that `.gitignore` explicitly retains the image corpus and does not ignore `data/images/`.

### 4. API Specification & Guard Rules
- Defined complete API endpoint request/response contracts for `/health`, `/images`, `/images/process`, `/posts`, `/posts/:id/images`, and `/suggestions/:id/review`.
- Formulated Mismatch Guard rules with explicit human-readable rejection messages (including Fox vs Wolf entity mismatch and similarity cutoffs).
- Formulated 10-post evaluation plan for measuring Top-1 precision.

---

## Phase 2 — Image Understanding

Evidence to add:
- Batch processing execution log
- Validated structured image metadata in database
- Low-confidence flagged image example (< 0.70)
- AI token and cost tracking records in `ai_costs`

---

## Phase 3 — Matching Engine

Evidence to add:
- Fox blog post ranking a fox image first
- Wolf image candidate rejected with human-readable explanation
- Unrelated post producing "No confident match"

---

## Phase 4 — Production Layer

Evidence to add:
- Human review API execution log (`approved`/`rejected`)
- 10-post evaluation dataset run
- Top-1 Precision calculation ($\ge 90\%$)
- Final API end-to-end demonstrations