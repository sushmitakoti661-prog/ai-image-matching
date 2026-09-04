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
- Expanded `DESIGN.md` with:
  - Complete layered architecture diagram (Routes -> Services -> Database / AI Client).
  - Entity Relationship Diagram (ERD) covering all 7 database tables.
  - Image understanding pipeline specifications with Zod validation and low-confidence criteria.
  - Comprehensive Mismatch Guard rules (Entity conflict e.g. Fox vs Wolf, Category mismatch, Low-confidence guard, Similarity cutoff threshold).
  - Dataset plan covering 40+ images across 4 categories (`animals`, `food`, `nature`, `vehicles`) with deliberate low-confidence test cases.
  - Evaluation strategy with 10+ ground-truth labeled posts for Top-1 Precision measurement.
  - Full API endpoint contracts, Zod schemas, and HTTP status codes.

### Setup & Developer Tooling
- Created comprehensive `README.md` with setup guide, quickstart steps, API docs, and phase roadmap.
- Configured npm scripts (`start`, `dev`, `db:init`, `db:test`) in `package.json`.
- Updated `server.js` with dynamic port handling, health check endpoint, and clean exports.
- Verified `.gitignore` properly preserves `data/images/`.
- Updated `.env.example` with complete configuration keys.