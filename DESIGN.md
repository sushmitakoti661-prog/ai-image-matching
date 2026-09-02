# AI Image Understanding & Content Matching Engine

## 1. Problem

The system will understand a library of images and match relevant images to blog posts.

For example, a blog post about a red fox should rank a fox image highly, while a wolf image should be rejected even if the semantic similarity is relatively high.

The system should prefer safe rejection when there is no confident match.

## 2. Main Flow

Images
→ Vision AI
→ Structured image metadata
→ Image embeddings

Blog posts
→ Text embeddings

Post + image embeddings
→ Similarity ranking
→ Mismatch guard
→ Suggested image or "No confident match"

Human reviewer
→ Approve / Reject suggestion

## 3. Image Metadata

Each processed image will contain:

- subject
- category
- attributes
- caption
- confidence
- low-confidence flag

AI output will be validated before being stored. Invalid model output will never be trusted.

## 4. Matching Strategy

The matching engine will:

1. Generate an embedding for the image description.
2. Generate an embedding for the blog post.
3. Calculate semantic similarity.
4. Rank candidate images.
5. Run the mismatch guard.
6. Return the best valid suggestion.

The mismatch guard will consider:

- category/tag compatibility
- similarity threshold
- image confidence

If no candidate clears the required thresholds, the API will return:

`No confident match`

## 5. Database

PostgreSQL will store:

- images
- image metadata
- embeddings
- posts
- suggestions
- reviews

Indexes will be added to fields used for lookups.

## 6. API

Planned endpoints:

- `GET /health`
- `POST /images`
- `POST /images/process`
- `POST /posts`
- `GET /posts/:id/images`
- `POST /suggestions/:id/review`

The API will validate incoming data and return clear error responses.

## 7. Background Processing

Vision processing and embedding generation will run through background jobs.

Jobs will support:

- batching
- retries
- progress tracking
- per-call cost tracking

## 8. Evaluation

A labeled evaluation dataset containing at least 10 posts will be used to measure top-1 precision.

The evaluation result will be recorded in the README.

## 9. Initial Dataset

The initial image corpus will contain at least 40 images across at least 4 categories.

Images will come from free/licensed sources.

## 10. Non-Goals

A full public-facing UI is not required.

The project will focus on the backend API, AI pipeline, matching engine, mismatch guard, persistence, evaluation, and review workflow.