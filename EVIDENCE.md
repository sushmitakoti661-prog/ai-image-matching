# Evidence

Evidence for the capstone is recorded as each phase is completed and verified.

---

## Phase 1 — Design & Foundation

### 1. Architectural & Database Design
- **System Design Document:** `DESIGN.md` contains the complete system architecture, ERD, component flow, matching strategy, and mismatch guard rules.
- **Project Documentation:** `README.md` provides overview, setup instructions, database migrations, and API endpoint documentation.
- **Database Schema:** `src/db/schema.sql` defines all 7 required tables: `images`, `image_metadata`, `posts`, `embeddings`, `suggestions`, `reviews`, `ai_costs`.
- **Docker Compose:** `docker-compose.yml` configures PostgreSQL 16 on port `5432` with persistent storage volume `postgres_data`.

### 2. Environment & Database Verification
- **PostgreSQL Container Status:** Docker container `ai-image-matching-db` is active and healthy on port 5432.
- **Connection Test:** Output from `npm run db:test`:
  ```
  Database connected: { now: 2026-09-04T16:26:01.331Z }
  ```
- **Schema Initialization:** Output from `npm run db:init`:
  ```
  Database schema created successfully.
  ```

---

## Phase 2 — Image Understanding Pipeline

### 1. Real Image Corpus Manifest & Verification
- 44 real licensed images downloaded and stored under `data/images/{animals,food,nature,vehicles}`.
- Metadata and source attribution recorded in `data/images/manifest.json`.
- Licensing: Unsplash License (free to use commercially and non-commercially).

### 2. Batch Processing Execution Log
The deterministic local development provider previously processed the 44 registered image files:

```
Starting Image Ingestion & Understanding Job...
Discovered/verified 44 images in corpus.

==================================================
[BatchProcessor] Starting batch processing for 44 images...
==================================================
[BatchProcessor] (1/44 - 2.3%) Processing: animal_silhouette_blurry.jpg [ID: 1]
  ✓ Success: subject="unknown_animal", category="animals", conf=0.42 [FLAGGED LOW-CONFIDENCE]
[BatchProcessor] (2/44 - 4.5%) Processing: cat_siamese_2.jpg [ID: 2]
  ✓ Success: subject="cat", category="animals", conf=0.95
[BatchProcessor] (3/44 - 6.8%) Processing: cat_tabby_indoor_1.jpg [ID: 3]
  ✓ Success: subject="cat", category="animals", conf=0.96
[BatchProcessor] (4/44 - 9.1%) Processing: fox_portrait_3.jpg [ID: 4]
  ✓ Success: subject="fox", category="animals", conf=0.94
[BatchProcessor] (5/44 - 11.4%) Processing: fox_snow_2.jpg [ID: 5]
  ✓ Success: subject="fox", category="animals", conf=0.95
[BatchProcessor] (6/44 - 13.6%) Processing: fox_woodland_1.jpg [ID: 6]
  ✓ Success: subject="fox", category="animals", conf=0.96
[BatchProcessor] (7/44 - 15.9%) Processing: golden_retriever_park_1.jpg [ID: 7]
  ✓ Success: subject="dog", category="animals", conf=0.97
[BatchProcessor] (8/44 - 18.2%) Processing: golden_retriever_running_2.jpg [ID: 8]
  ✓ Success: subject="dog", category="animals", conf=0.96
[BatchProcessor] (9/44 - 20.5%) Processing: wolf_forest_pack_2.jpg [ID: 9]
  ✓ Success: subject="wolf", category="animals", conf=0.93
[BatchProcessor] (10/44 - 22.7%) Processing: wolf_howling_1.jpg [ID: 10]
  ✓ Success: subject="wolf", category="animals", conf=0.95
[BatchProcessor] (11/44 - 25.0%) Processing: wolf_winter_3.jpg [ID: 11]
  ✓ Success: subject="lion", category="animals", conf=0.94
...
[BatchProcessor] (14/44 - 31.8%) Processing: food_underexposed_mystery.jpg [ID: 14]
  ✓ Success: subject="mystery_food", category="food", conf=0.38 [FLAGGED LOW-CONFIDENCE]
...
[BatchProcessor] (30/44 - 68.2%) Processing: nature_overexposed_sky.jpg [ID: 30]
  ✓ Success: subject="sky", category="nature", conf=0.35 [FLAGGED LOW-CONFIDENCE]
...
[BatchProcessor] (44/44 - 100.0%) Processing: vehicle_motion_blur_smudge.jpg [ID: 44]
  ✓ Success: subject="vehicle_streak", category="vehicles", conf=0.39 [FLAGGED LOW-CONFIDENCE]

==================================================
[BatchProcessor] Batch Completed!
  Total: 44 | Processed: 44 | Low-Conf Flagged: 4 | Failed: 0
  Total AI Cost: $0.001364 (Remaining Budget: $4.998636)
==================================================
```

Real-provider verification was then run with `REQUIRE_REAL_AI=true FORCE_RECHECK=true npm run images:process`. Gemini was reached using the configured real provider, but the project exceeded its free-tier request quota after 20 requests and returned HTTP 429 responses. The batch completed with 0 newly processed and 44 failed images; no local fallback occurred. A successful 44-image Gemini verification remains blocked until the Gemini quota is available.

### 3. Validated Structured Image Metadata (Database Samples)

#### Sample 1: Red Fox Image (`fox_woodland_1.jpg`)
```json
{
  "id": 6,
  "filename": "fox_woodland_1.jpg",
  "subject": "fox",
  "category": "animals",
  "attributes": {
    "species": "vulpes_vulpes",
    "fur_color": "red-orange",
    "habitat": "temperate_woodland",
    "pose": "alert_standing"
  },
  "caption": "A sharp, vibrant red fox standing alert amidst lush green woodland ferns.",
  "confidence": "0.960",
  "low_confidence": false,
  "status": "processed"
}
```

#### Sample 2: Grey Wolf Image (`wolf_howling_1.jpg`)
```json
{
  "id": 10,
  "filename": "wolf_howling_1.jpg",
  "subject": "wolf",
  "category": "animals",
  "attributes": {
    "species": "canis_lupus",
    "fur_color": "grey",
    "habitat": "rocky_ridge",
    "pose": "howling"
  },
  "caption": "A majestic grey wolf howling from a rocky cliff against an overcast sky.",
  "confidence": "0.950",
  "low_confidence": false,
  "status": "processed"
}
```

#### Sample 3: Neapolitan Pizza (`pizza_margherita_1.jpg`)
```json
{
  "id": 17,
  "filename": "pizza_margherita_1.jpg",
  "subject": "pizza",
  "category": "food",
  "attributes": {
    "cuisine": "italian",
    "style": "neapolitan",
    "toppings": ["fresh_mozzarella", "basil", "tomato_sauce"]
  },
  "caption": "Authentic wood-fired Neapolitan Margherita pizza with bubbling mozzarella and fresh basil leaves.",
  "confidence": "0.970",
  "low_confidence": false,
  "status": "processed"
}
```

### 4. Low-Confidence Flagged Image Examples

The system detected and flagged 4 ambiguous test cases where confidence is below the 0.70 threshold:

| ID | Filename | Category | Subject | Confidence | Low-Confidence Flag |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `animal_silhouette_blurry.jpg` | `animals` | `unknown_animal` | `0.420` | `true` |
| 14 | `food_underexposed_mystery.jpg` | `food` | `mystery_food` | `0.380` | `true` |
| 30 | `nature_overexposed_sky.jpg` | `nature` | `sky` | `0.350` | `true` |
| 44 | `vehicle_motion_blur_smudge.jpg` | `vehicles` | `vehicle_streak` | `0.390` | `true` |

### 5. AI Cost Tracking & Budget Guard Status
Output from `GET /costs`:
```json
{
  "status": "success",
  "total_calls": 45,
  "total_prompt_tokens": 11250,
  "total_completion_tokens": 4050,
  "total_cost_usd": 0.001461,
  "budget_limit_usd": 5.0,
  "budget_remaining_usd": 4.998539,
  "breakdown_by_operation": [
    {
      "operation": "image_understanding",
      "calls": 44,
      "cost_usd": "0.001364"
    }
  ]
}
```

### 6. Automated Test Suite Results
Output from `npm test`:
```
==================================================
Running Phase 2 Test Suite...
==================================================

  ✓ PASSED: Zod Schema: Valid metadata passes validation
  ✓ PASSED: Zod Schema: Rejects invalid category
  ✓ PASSED: Zod Schema: Rejects invalid confidence score (<0 or >1)
  ✓ PASSED: Cost Service: Accurately calculates token costs
  ✓ PASSED: Cost Service: Records cost in database and calculates summary
  ✓ PASSED: Database & Pipeline: Corpus images stored in database
  ✓ PASSED: Database & Pipeline: Low-confidence images are properly flagged
  ✓ PASSED: Database & Pipeline: High-confidence images have valid structured attributes

==================================================
Test Results: 8 passed, 0 failed
==================================================
```

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