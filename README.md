# AI Image Understanding & Content Matching Engine

A production-grade backend service that processes images using Vision AI, generates structured metadata and vector embeddings, semantically ranks candidates for blog posts, enforces a deterministic **Mismatch Guard** (preventing false associations such as pairing wolves with fox articles), and supports human-in-the-loop review.

---

## 🚀 Key Features

- **Vision AI Ingestion & Structuring:** Converts raw images into validated structured metadata (subject, category, attributes, caption, confidence) with strict **Zod** validation.
- **Low-Confidence Safeguards:** Detects and flags ambiguous or low-confidence visual representations before downstream matching.
- **Semantic Vector Matching:** Generates embeddings for blog posts and image captions, computing cosine similarity for accurate ranking.
- **Deterministic Mismatch Guard:** Eliminates false positives by evaluating entity compatibility, category constraints, and similarity thresholds with human-readable rejection reasons.
- **Human-in-the-Loop Review:** API endpoints to record reviewer decisions (`approved` / `rejected`).
- **Cost & Budget Tracking:** Per-call token metering, cost estimation, and budget enforcement.
- **Automated Precision Benchmark:** Validates matching quality on a labeled 10-post evaluation dataset.

---

## 🛠 Tech Stack

- **Runtime:** Node.js (v20+)
- **Web Framework:** Express.js
- **Database:** PostgreSQL 16 (via Docker Compose)
- **Validation:** Zod
- **Database Driver:** `pg` (node-postgres)
- **Process Management / Dev:** Nodemon, Dotenv

---

## 📂 Project Structure

```
ai-image-matching/
├── data/
│   └── images/               # Image corpus (animals, food, nature, vehicles)
│       ├── animals/
│       ├── food/
│       ├── nature/
│       └── vehicles/
├── src/
│   ├── db/
│   │   ├── db.js             # PostgreSQL connection pool
│   │   ├── initDb.js         # Schema migration script
│   │   ├── schema.sql        # Database schema definitions
│   │   └── testConnection.js # Database connectivity test
│   ├── jobs/                 # Batch processing & queue jobs
│   ├── routes/               # Express route handlers
│   └── services/             # Business logic (Vision, Embeddings, Matching, Guards)
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
Ensure database credentials match your Docker configuration:
```env
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/image_matching
GEMINI_API_KEY=your_api_key_here
AI_BUDGET_LIMIT_USD=5.00
```

### 4. Start PostgreSQL with Docker
```bash
docker compose up -d
```

### 5. Initialize the Database Schema
```bash
npm run db:init
```

To verify database connectivity:
```bash
npm run db:test
```

### 6. Start the API Server
Development mode (with hot-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Health check verification:
```bash
curl http://localhost:3000/health
```

---

## 📡 Planned API Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Service health status check |
| `POST` | `/images` | Register an image in the system |
| `POST` | `/images/process` | Batch-process pending images with Vision AI |
| `POST` | `/posts` | Create a new blog post |
| `GET` | `/posts/:id/images` | Match and rank images for a given post with Mismatch Guard |
| `POST` | `/suggestions/:id/review` | Submit human reviewer decision (`approved`/`rejected`) |

---

## 🧩 Phases & Roadmap

- **Phase 1 — Design & Foundation:** Architecture, database schema, mismatch guard specifications, dataset planning, and verified base environment. *(Current)*
- **Phase 2 — Image Understanding:** Vision AI pipeline, Zod schema validation, low-confidence tagging, cost tracking, and batch processing.
- **Phase 3 — Matching Engine:** Text embeddings, cosine similarity ranking, Mismatch Guard rules, and "No confident match" fallbacks.
- **Phase 4 — Production Layer:** Human review workflow, 10-post evaluation benchmark, Top-1 precision reporting, and final evidence validation.
