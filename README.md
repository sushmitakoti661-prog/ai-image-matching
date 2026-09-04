# AI Image Understanding & Content Matching Engine

A backend service that processes images using Vision AI, generates structured metadata and vector embeddings, semantically ranks candidates for blog posts, enforces a deterministic **Mismatch Guard** (preventing false associations such as pairing wolves with fox articles), and supports human-in-the-loop review.

---

## 🚀 Key Features

- **Real Image Corpus & Ingestion:** 44 free/licensed JPEG images across 4 categories (`animals`, `food`, `nature`, `vehicles`) with verified Unsplash licenses documented in `data/images/manifest.json`.
- **Vision AI Ingestion & Structuring:** Converts raw images into validated structured metadata (subject, category, attributes, caption, confidence) with strict **Zod** validation.
- **Provider Architecture:** Seamlessly executes via **Google Gemini Vision API** (`gemini-1.5-flash`) when configured with `GEMINI_API_KEY`, while providing a decoupled local mock engine (`vision-local-dev`) for offline testing.
- **Low-Confidence Safeguards:** Automatically detects and flags ambiguous, blurred, or low-confidence visual representations (`confidence < 0.70`).
- **Batch Processing & Retries:** Robust background batch processing engine with exponential backoff retries and real-time progress tracking.
- **Cost & Budget Safety:** Tracks token usage per model call, logs USD costs in `ai_costs`, and enforces active budget limits.
- **Semantic Vector Matching:** Generates embeddings for blog posts and image captions, computing cosine similarity for accurate ranking. *(Phase 3)*
- **Deterministic Mismatch Guard:** Eliminates false positives by evaluating entity compatibility, category constraints, and similarity thresholds. *(Phase 3)*
- **Human-in-the-Loop Review:** API endpoints to record reviewer decisions (`approved` / `rejected`). *(Phase 4)*
- **Automated Precision Benchmark:** Validates matching quality on a labeled 10-post evaluation dataset. *(Phase 4)*

---

## 🛠 Tech Stack

- **Runtime:** Node.js (v20+)
- **Web Framework:** Express.js
- **Database:** PostgreSQL 16 (via Docker Compose)
- **Validation:** Zod
- **Vision AI:** Google Generative AI SDK (`gemini-1.5-flash`) with decoupled local test provider
- **Database Driver:** `pg` (node-postgres)
- **Process Management / Dev:** Nodemon, Dotenv

---

## 📂 Project Structure

```
ai-image-matching/
├── data/
│   └── images/               # Real image corpus (44 licensed images + manifest.json)
│       ├── manifest.json     # Manifest documenting sources, URLs, and Unsplash licenses
│       ├── animals/          # Fox, wolf, cat, dog, blurry animal test cases
│       ├── food/             # Pizza, pasta, sushi, burger, underexposed food test cases
│       ├── nature/           # Mountain, desert, forest, ocean, overexposed sky test cases
│       └── vehicles/         # Sports car, motorcycle, airplane, motion-blurred test cases
├── src/
│   ├── db/
│   │   ├── db.js             # PostgreSQL connection pool
│   │   ├── downloadCorpus.js # Downloads 44 real licensed images from Unsplash
│   │   ├── initDb.js         # Schema migration script
│   │   ├── schema.sql        # Database schema definitions
│   │   └── testConnection.js # Database connectivity test
│   ├── jobs/
│   │   └── processImages.js  # CLI batch processing job
│   ├── routes/
│   │   ├── costRoutes.js     # Cost tracking & budget endpoints
│   │   └── imageRoutes.js    # Image ingestion, scanning, processing & query endpoints
│   └── services/
│       ├── batchProcessor.js # Batch processing engine with retries & progress tracking
│       ├── costService.js    # Token cost calculation & budget guard
│       ├── imageService.js   # Image DB queries & metadata persistence
│       ├── schema.js         # Zod schemas for validation
│       └── visionService.js  # Vision AI integration (Gemini API & local test provider)
├── test/
│   └── phase2.test.js        # Automated test suite for Phase 2
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore configuration
├── BUILDLOG.md               # Chronological development log
├── capstone.yaml             # Capstone project manifest
├── DESIGN.md                 # Full architectural and technical specification
├── docker-compose.yml        # PostgreSQL Docker configuration
├── EVIDENCE.md               # Proof-of-work and verification records
├── package.json              # Project dependencies and npm scripts
├── README.md                 # Project documentation & run guide
└── server.js                 # Express application entrypoint
```

---

## ⚙️ Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher)
- [Docker](https://www.docker.com/) & Docker Compose

### 2. Clone & Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Configure your `.env`:
```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/image_matching
GEMINI_API_KEY=your_gemini_api_key_here
REQUIRE_REAL_AI=false
FORCE_RECHECK=false
AI_BUDGET_LIMIT_USD=5.00
```

### 4. Start PostgreSQL with Docker
```bash
docker compose up -d
```

### 5. Initialize Database & Download Real Image Corpus
```bash
npm run db:init
npm run images:download
```

### 6. Run Image Understanding Batch Job
```bash
npm run images:process
```

Set `REQUIRE_REAL_AI=true` for a verification run that must use Gemini and fail when Gemini is unavailable. Set `FORCE_RECHECK=true` when already-processed images must be sent through the provider again. The local provider is reserved for offline development and tests.

### 7. Run Test Suite
```bash
npm test
```

### 8. Start API Server
```bash
npm run dev
```

---

## 📡 API Endpoints

### Image Endpoints (`/images`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/images` | List all images (supports `?category=animals`, `?low_confidence=true`, `?status=processed`) |
| `GET` | `/images/:id` | Get single image with full structured metadata |
| `POST` | `/images` | Register an individual image |
| `POST` | `/images/scan` | Scan `data/images/` directory and register all files |
| `POST` | `/images/process` | Trigger batch Vision AI processing for pending images |

### Cost & Monitoring Endpoints (`/costs`)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/costs` | Get token counts, cumulative AI cost, and remaining budget |

---

## 🧩 Phases & Roadmap

- [x] **Phase 1 — Design & Foundation:** Architecture, database schema, mismatch guard specifications, dataset planning, and verified base environment.
- [ ] **Phase 2 — Image Understanding:** Real licensed image corpus, Vision AI integration (Gemini API & local test provider), Zod schema validation, low-confidence tagging, cost tracking, and batch processing. Local acceptance passes; full Gemini corpus verification is blocked by the current project quota.
- [ ] **Phase 3 — Matching Engine:** Text embeddings, cosine similarity ranking, Mismatch Guard rules, and "No confident match" fallbacks.
- [ ] **Phase 4 — Production Layer:** Human review workflow, 10-post evaluation benchmark, Top-1 precision reporting, and final evidence validation.
