# System Design: AI Image Understanding & Content Matching Engine

## 1. Executive Summary & Problem Statement

Modern content publishing platforms require relevant, high-quality images to accompany articles. However, naive semantic matching often introduces critical mismatches—for example, pairing a blog post about a red fox with a wolf image due to visual or contextual closeness in animal taxonomy, or pairing unrelated stock photos when no truly relevant image exists.

The **AI Image Understanding & Content Matching Engine** provides an automated, reliable backend that:
1. Understands images using Vision AI and extracts strictly validated structured metadata (subject, category, attributes, caption, confidence).
2. Flags ambiguous or low-confidence images before they pollute downstream systems.
3. Generates high-dimensional vector embeddings for both image descriptions and blog posts.
4. Ranks candidate images using cosine similarity combined with a deterministic **Mismatch Guard** that enforces domain-specific rules (e.g., rejecting wolves for fox articles) and rejects unsuitable candidates with a clean `"No confident match"` fallback.
5. Provides human-in-the-loop review capabilities (Approve / Reject) to record feedback.
6. Measures end-to-end performance using a labeled evaluation benchmark dataset measuring Top-1 Precision.

---

## 2. System Architecture

The project adheres to a clean, decoupled **Layered Architecture**:

```
                  ┌────────────────────────┐
                  │    HTTP Client / UI    │
                  └───────────┬────────────┘
                              │ JSON / REST
                              ▼
                  ┌────────────────────────┐
                  │     Express Routes     │
                  │ (HTTP, Params, Status) │
                  └───────────┬────────────┘
                              │
                              ▼
                  ┌────────────────────────┐
                  │    Service Layer       │
                  │  - Vision AI Service   │
                  │  - Embedding Service   │
                  │  - Matching Service    │
                  │  - Mismatch Guard      │
                  │  - Evaluation Service  │
                  └───────┬────────┬───────┘
                          │        │
           ┌──────────────┘        └──────────────┐
           ▼                                      ▼
┌─────────────────────┐                ┌─────────────────────┐
│  AI Providers / SDK │                │   Database Client   │
│  (Gemini / OpenAI)  │                │  (PostgreSQL Pool)  │
└─────────────────────┘                └──────────┬──────────┘
                                                  │
                                                  ▼
                                       ┌─────────────────────┐
                                       │ Docker PostgreSQL16 │
                                       └─────────────────────┘
```

### Key Architectural Principles
- **Separation of Concerns:** Route handlers only handle request parsing, parameter extraction, and HTTP responses. All business logic, AI calls, and database operations reside in dedicated services.
- **Strict Input & Output Validation:** All incoming HTTP payloads and all raw AI outputs are validated against Zod schemas before being processed or persisted. Unvalidated AI output is never trusted.
- **Cost & Budget Safety:** Every AI call records prompt/completion token metrics and cost estimates into `ai_costs`. An active budget guard halts automated batch calls if the budget limit is exceeded.
- **Graceful Rejection:** When confidence or similarity thresholds are not met, the system produces explicit, human-readable explanations rather than returning incorrect matches.

---

## 3. Database Design

PostgreSQL 16 (running via Docker) serves as the persistent data store.

### Entity Relationship Diagram (ERD)

```
┌──────────────────┐           1:1           ┌──────────────────────┐
│      images      ├─────────────────────────┤    image_metadata    │
│──────────────────│                         │──────────────────────│
│ id (PK)          │                         │ id (PK)              │
│ filename         │                         │ image_id (FK->images)│
│ path             │                         │ subject              │
│ status           │                         │ category             │
│ created_at       │                         │ attributes (JSONB)   │
└────────┬─────────┘                         │ caption              │
         │                                   │ confidence           │
         │ 1:N                               │ low_confidence       │
         ▼                                   │ created_at           │
┌──────────────────┐                         └──────────────────────┘
│   suggestions    │
│──────────────────│
│ id (PK)          │
│ post_id (FK)     │◄─────────┐ 1:N
│ image_id (FK)    │          │
│ similarity_score │   ┌──────┴───────────┐
│ guard_status     │   │      posts       │
│ explanation      │   │──────────────────│
│ created_at       │   │ id (PK)          │
└────────┬─────────┘   │ title            │
         │             │ content          │
         │ 1:N         │ created_at       │
         ▼             └──────────────────┘
┌──────────────────┐
│     reviews      │                         ┌──────────────────────┐
│──────────────────│                         │      embeddings      │
│ id (PK)          │                         │──────────────────────│
│ suggestion_id(FK)│                         │ id (PK)              │
│ decision         │                         │ entity_type          │
│ created_at       │                         │ entity_id            │
└──────────────────┘                         │ vector (JSONB)       │
                                             │ model                │
┌──────────────────┐                         │ created_at           │
│     ai_costs     │                         └──────────────────────┘
│──────────────────│
│ id (PK)          │
│ operation        │
│ entity_type      │
│ entity_id        │
│ model            │
│ prompt_tokens    │
│ completion_tokens│
│ estimated_cost   │
│ created_at       │
└──────────────────┘
```

### Table Definitions & Purpose

1. **`images`**: Tracks physical/local image files, file paths, ingestion state (`pending`, `processed`, `failed`), and timestamps.
2. **`image_metadata`**: Holds structured extraction results from Vision AI:
   - `subject` (VARCHAR/TEXT): Primary entity (e.g., `fox`, `wolf`, `pizza`, `sports_car`).
   - `category` (VARCHAR/TEXT): Top-level taxonomic grouping (`animals`, `food`, `nature`, `vehicles`).
   - `attributes` (JSONB): Key visual properties (e.g., `{"color": "orange", "setting": "snow", "pose": "standing"}`).
   - `caption` (TEXT): Comprehensive descriptive text used for embedding generation.
   - `confidence` (NUMERIC(4,3)): AI detection confidence score (0.000 to 1.000).
   - `low_confidence` (BOOLEAN): Flagged `true` if `confidence < 0.70` or if subject ambiguity is detected.
3. **`posts`**: Stores blog posts with `title` and `content`.
4. **`embeddings`**: Stores normalized vector embeddings for both images (`entity_type = 'image'`) and blog posts (`entity_type = 'post'`) alongside the model identifier.
5. **`suggestions`**: Stores computed matching results between posts and images, including the cosine `similarity_score`, `guard_status` (`accepted`, `rejected`, `no_match`), and a human-readable `explanation`.
6. **`reviews`**: Persists human reviewer actions (`decision`: `approved` or `rejected`) on generated suggestions.
7. **`ai_costs`**: Logs individual AI operations, token usage, and calculated USD expenditure.

---

## 4. Image Understanding Pipeline (Phase 2)

```
Image File ──► Vision AI (Prompt + Schema) ──► Raw JSON Output
                                                     │
                                                     ▼
                                            Zod Schema Validation
                                            (Parse & Validate)
                                            ├── Fail ──► Reject & Retry / Mark Failed
                                            └── Pass ──► Confidence Check
                                                              ├── < 0.70 ──► Flag low_confidence = true
                                                              └── >= 0.70 ─► Flag low_confidence = false
                                                              │
                                                              ▼
                                                    Save to image_metadata
                                                    Log Token / Cost to ai_costs
```

### Structured Output Schema (Zod)

```javascript
const ImageMetadataSchema = z.object({
  subject: z.string().min(1).max(100),
  category: z.enum(["animals", "food", "nature", "vehicles", "other"]),
  attributes: z.record(z.string(), z.any()),
  caption: z.string().min(10).max(500),
  confidence: z.number().min(0.0).max(1.0)
});
```

### Low-Confidence & Failure Handling
- If the Vision model returns malformed JSON or missing fields, the job rejects the output, increments the retry counter (up to 3 retries with exponential backoff), and logs the error.
- If `confidence < 0.70`, the record is inserted with `low_confidence = true`. Images flagged with low confidence are excluded or strictly penalized by the downstream matching engine.

---

## 5. Matching Strategy & Mismatch Guard (Phase 3)

### Matching Workflow
1. **Embedding Generation**: Compute text embeddings for the blog post (concatenating `title` and `content`) and all candidate images (using structured `caption` + `subject` + `attributes`).
2. **Cosine Similarity Computation**:
   $$\text{sim}(\vec{u}, \vec{v}) = \frac{\vec{u} \cdot \vec{v}}{\|\vec{u}\|_2 \|\vec{v}\|_2}$$
3. **Candidate Ranking**: Rank all active candidate images descending by cosine similarity score.
4. **Mismatch Guard Filtering**: Pass top candidates through sequential guard filters.
5. **Final Output Determination**: If a candidate clears all guard checks and meets the minimum similarity threshold ($\ge 0.65$), it is returned as the accepted suggestion. Otherwise, the engine returns `"No confident match"`.

### Mismatch Guard Rules

| Rule Name | Condition | Action | Explanation Message |
| :--- | :--- | :--- | :--- |
| **Low-Confidence Guard** | Candidate image has `low_confidence == true` | Reject | `Rejected: Candidate image has low detection confidence (< 0.70).` |
| **Category Compatibility Guard** | Candidate image category does not match inferred post domain | Reject | `Rejected: Category mismatch between post domain '{post_category}' and image category '{image_category}'.` |
| **Entity / Subject Conflict Guard** | Post focuses on specific subject (e.g. `fox`) and candidate subject is conflicting species/entity (e.g. `wolf`) | Reject | `Rejected: Entity mismatch. Post subject is '{post_subject}' but image contains '{image_subject}'.` |
| **Similarity Threshold Cutoff** | Best candidate cosine similarity score $< 0.65$ | No Match | `No confident match: Top similarity score ({score}) is below the confidence threshold (0.65).` |

### Key Benchmark Scenario: Fox vs Wolf
- **Post:** *"The Secret Life of the Red Fox in North American Woodlands"*
- **Candidate 1 (Red Fox in Snow):** Similarity = 0.88 | Subject = `fox` $\rightarrow$ **Accepted & Ranked #1**.
- **Candidate 2 (Grey Wolf in Forest):** Similarity = 0.74 | Subject = `wolf` $\rightarrow$ **Rejected by Entity Conflict Guard** with explanation: `"Rejected: Entity mismatch. Post subject is 'fox' but candidate image subject is 'wolf'."`
- **Candidate 3 (Sports Car):** Similarity = 0.21 $\rightarrow$ **Rejected by Similarity & Category Guard**.

---

## 6. Dataset Plan

### Image Corpus (40+ Images across 4+ Categories)

The corpus will consist of 44 curated images distributed across 4 core categories:

1. **`animals` (12 images):**
   - Red fox (close-up, woodland, snow)
   - Grey wolf (forest pack, howling, profile)
   - Domestic cat (indoor, garden)
   - Golden retriever (park, running)
   - Ambiguous / blurred animal (intentional low-confidence test case)
2. **`food` (10 images):**
   - Neapolitan pizza (wood-fired oven)
   - Artisan pasta (carbonara, bolognese)
   - Fresh sushi platter (salmon, tuna)
   - Berry smoothie bowl (breakfast)
   - Distant/underexposed food item (low-confidence test case)
3. **`nature` (11 images):**
   - Mountain landscape (Alpine peaks at sunrise)
   - Ocean sunset (waves, beach)
   - Autumn forest trail (golden leaves)
   - Desert sand dunes (Sahara)
   - Overexposed cloudy sky (low-confidence test case)
4. **`vehicles` (11 images):**
   - Red sports car (race track)
   - Vintage motorcycle (cafe racer)
   - Commercial airplane (in flight)
   - Cargo ship at sea
   - Motion-blurred vehicle (low-confidence test case)

---

## 7. Evaluation & Benchmark Strategy (Phase 4)

### Evaluation Dataset (10+ Ground-Truth Posts)
We will maintain a labeled dataset of at least 10 blog posts with designated ground-truth matching image IDs and negative test cases:

1. **Post 1 (Fox Ecology):** Target = Fox image | Negative = Wolf image
2. **Post 2 (Wolf Conservation):** Target = Wolf image | Negative = Fox image
3. **Post 3 (Italian Pizza Baking):** Target = Pizza image | Negative = Pasta image
4. **Post 4 (Japanese Sushi Masterclass):** Target = Sushi image | Negative = Pizza image
5. **Post 5 (Alpine Hiking Expedition):** Target = Mountain image | Negative = Desert image
6. **Post 6 (Desert Survival & Dunes):** Target = Desert image | Negative = Forest image
7. **Post 7 (Sports Car Engineering):** Target = Sports car image | Negative = Motorcycle image
8. **Post 8 (Vintage Motorcycle Restoration):** Target = Motorcycle image | Negative = Car image
9. **Post 9 (Unrelated topic - Quantum Computing):** Target = `No confident match` (no valid image in corpus)
10. **Post 10 (Domestic Pet Care - Golden Retriever):** Target = Golden retriever image | Negative = Cat image

### Metric: Top-1 Precision
$$\text{Top-1 Precision} = \frac{\text{Number of Posts with Correct Top-1 Suggestion}}{\text{Total Evaluated Posts}}$$

The target Top-1 Precision is $\ge 90\%$.

---

## 8. API Specification

### 1. Health Check
- **Endpoint:** `GET /health`
- **Response `200 OK`:**
  ```json
  {
    "status": "ok",
    "service": "ai-image-understanding-content-matching",
    "timestamp": "2026-09-04T16:26:01.331Z"
  }
  ```

### 2. Image Ingestion & Batch Processing
- **Endpoint:** `POST /images`
  - **Body:** `{ "filename": "fox_snow.jpg", "path": "data/images/animals/fox_snow.jpg" }`
  - **Response `201 Created`:** Returns created image record with `status: "pending"`.
- **Endpoint:** `POST /images/process`
  - **Body (Optional):** `{ "batchSize": 10, "forceRecheck": false }`
  - **Response `200 OK`:** Returns processing summary (processed count, flagged low-confidence count, token cost).

### 3. Post Ingestion
- **Endpoint:** `POST /posts`
  - **Body:** `{ "title": "The Elusive Red Fox", "content": "An in-depth article about red foxes in winter..." }`
  - **Response `201 Created`:** Returns created post with ID.

### 4. Image Matching for Post
- **Endpoint:** `GET /posts/:id/images`
  - **Query Params:** `?limit=5`
  - **Response `200 OK`:**
    ```json
    {
      "postId": 1,
      "postTitle": "The Elusive Red Fox",
      "status": "matched",
      "topMatch": {
        "imageId": 12,
        "filename": "fox_snow.jpg",
        "similarityScore": 0.8845,
        "guardStatus": "accepted",
        "explanation": "High semantic relevance; subject matches 'fox'."
      },
      "candidates": [
        {
          "imageId": 12,
          "filename": "fox_snow.jpg",
          "similarityScore": 0.8845,
          "guardStatus": "accepted",
          "explanation": "Matched post subject 'fox'."
        },
        {
          "imageId": 15,
          "filename": "wolf_forest.jpg",
          "similarityScore": 0.7412,
          "guardStatus": "rejected",
          "explanation": "Rejected: Entity mismatch. Post subject is 'fox' but candidate image subject is 'wolf'."
        }
      ]
    }
    ```

### 5. Human Review
- **Endpoint:** `POST /suggestions/:id/review`
  - **Body:** `{ "decision": "approved" }` (or `"rejected"`)
  - **Response `200 OK`:** `{ "id": 1, "suggestionId": 1, "decision": "approved", "createdAt": "..." }`

---

## 9. Non-Goals & Boundaries
- No public user-facing frontend or CSS dashboard is required.
- External dependencies are kept minimal (Node.js, Express, PostgreSQL, Zod, pg, dotenv).
- All AI keys and sensitive configuration remain strictly in `.env`.