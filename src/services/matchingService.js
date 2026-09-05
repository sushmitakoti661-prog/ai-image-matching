const pool = require("../db/db");
const {
  SuggestionResultSchema,
  EmbeddingVectorSchema
} = require("./schema");
const {
  buildPostEmbeddingText,
  buildImageEmbeddingText,
  getOrCreateEmbedding
} = require("./embeddingService");
const { getPostById } = require("./postService");
const { getAllImages } = require("./imageService");

const DEFAULT_SIMILARITY_THRESHOLD = 0.65;
const LOW_CONFIDENCE_THRESHOLD = 0.70;
const CATEGORY_SUBJECTS = {
  animals: ["fox", "wolf", "dog", "cat", "lion", "animal"],
  food: ["pizza", "pasta", "sushi", "burger", "taco", "salad", "cake", "food"],
  nature: ["mountain", "desert", "forest", "ocean", "waterfall", "lake", "nature"],
  vehicles: ["car", "motorcycle", "airplane", "ship", "boat", "train", "bicycle", "vehicle"]
};
const POST_SUBJECT_ALIASES = [
  { phrase: "sports car", category: "vehicles", subject: "sports_car" },
  { phrase: "golden retriever", category: "animals", subject: "dog" }
];

function containsTerm(text, term) {
  const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escapedTerm}(?:s)?\\b`).test(text);
}

function parseStoredVector(vector) {
  const parsed = typeof vector === "string" ? JSON.parse(vector) : vector;
  return EmbeddingVectorSchema.parse(parsed);
}

function cosineSimilarity(firstVector, secondVector) {
  const first = parseStoredVector(firstVector);
  const second = parseStoredVector(secondVector);

  if (first.length !== second.length) {
    throw new Error("Cannot compare embeddings with different dimensions");
  }

  let dotProduct = 0;
  let firstMagnitude = 0;
  let secondMagnitude = 0;

  for (let index = 0; index < first.length; index++) {
    dotProduct += first[index] * second[index];
    firstMagnitude += first[index] * first[index];
    secondMagnitude += second[index] * second[index];
  }

  if (firstMagnitude === 0 || secondMagnitude === 0) {
    throw new Error("Cannot compare zero-magnitude embeddings");
  }

  const similarity = dotProduct / (Math.sqrt(firstMagnitude) * Math.sqrt(secondMagnitude));
  return Math.max(-1, Math.min(1, similarity));
}

function inferPostSignals(post) {
  const text = `${post.title} ${post.content}`.toLowerCase();
  const alias = POST_SUBJECT_ALIASES.find((candidate) => text.includes(candidate.phrase));
  if (alias) {
    return { category: alias.category, subject: alias.subject };
  }

  const category = Object.keys(CATEGORY_SUBJECTS).find((candidate) => {
    return containsTerm(text, candidate) || CATEGORY_SUBJECTS[candidate].some((subject) => containsTerm(text, subject));
  }) || null;
  const subject = category
    ? CATEGORY_SUBJECTS[category].find((candidate) => containsTerm(text, candidate)) || null
    : null;

  return { category, subject };
}

function guardCandidate({ postSignals, image, similarityScore, similarityThreshold }) {
  const confidence = Number(image.confidence);

  if (!Number.isFinite(confidence) || image.low_confidence || confidence < LOW_CONFIDENCE_THRESHOLD) {
    return {
      guardStatus: "rejected",
      explanation: `Rejected: Candidate image has low detection confidence (< ${LOW_CONFIDENCE_THRESHOLD.toFixed(2)}).`
    };
  }

  if (postSignals.category && image.category !== postSignals.category) {
    return {
      guardStatus: "rejected",
      explanation: `Category mismatch: expected ${postSignals.category}, detected ${image.category}.`
    };
  }

  if (postSignals.subject && image.subject !== postSignals.subject) {
    return {
      guardStatus: "rejected",
      explanation: `Animal category/subject mismatch: expected ${postSignals.subject}, detected ${image.subject}`
    };
  }

  if (similarityScore < similarityThreshold) {
    return {
      guardStatus: "rejected",
      explanation: `No confident match: similarity score (${similarityScore.toFixed(4)}) is below the threshold (${similarityThreshold.toFixed(2)}).`
    };
  }

  return {
    guardStatus: "accepted",
    explanation: postSignals.subject
      ? `Accepted: semantic similarity passed and subject matches '${postSignals.subject}'.`
      : "Accepted: semantic similarity and confidence thresholds passed."
  };
}

async function saveSuggestion({ postId, imageId, similarityScore, guardStatus, explanation }) {
  const result = await pool.query(
    `INSERT INTO suggestions (post_id, image_id, similarity_score, guard_status, explanation)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [postId, imageId, similarityScore, guardStatus, explanation]
  );
  return result.rows[0];
}

async function rankImagesForPost(postOrId, options = {}) {
  const post = typeof postOrId === "object" ? postOrId : await getPostById(postOrId);
  if (!post) {
    throw new Error("Post not found");
  }

  const similarityThreshold = options.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD;
  const limit = options.limit ?? 10;
  const postSignals = inferPostSignals(post);
  const postEmbedding = await getOrCreateEmbedding({
    entityType: "post",
    entityId: post.id,
    text: buildPostEmbeddingText(post, postSignals)
  });
  const postVector = parseStoredVector(postEmbedding.vector);
  const images = await getAllImages({ status: "processed" });
  const candidates = [];

  for (const image of images) {
    if (!image.caption || !image.subject || !image.category) {
      continue;
    }

    const imageEmbedding = await getOrCreateEmbedding({
      entityType: "image",
      entityId: image.id,
      text: buildImageEmbeddingText(image)
    });
    const similarityScore = cosineSimilarity(postVector, imageEmbedding.vector);
    const guard = guardCandidate({
      postSignals,
      image,
      similarityScore,
      similarityThreshold
    });
    const result = SuggestionResultSchema.parse({
      imageId: image.id,
      filename: image.filename,
      similarityScore,
      guardStatus: guard.guardStatus,
      explanation: guard.explanation
    });

    await saveSuggestion({
      postId: post.id,
      imageId: image.id,
      similarityScore: result.similarityScore,
      guardStatus: result.guardStatus,
      explanation: result.explanation
    });
    candidates.push(result);
  }

  candidates.sort((first, second) => second.similarityScore - first.similarityScore);
  const accepted = candidates.filter((candidate) => candidate.guardStatus === "accepted");

  return {
    post,
    postSignals,
    match: accepted[0] || null,
    noMatch: accepted.length === 0,
    candidates: candidates.slice(0, limit)
  };
}

module.exports = {
  DEFAULT_SIMILARITY_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
  cosineSimilarity,
  inferPostSignals,
  guardCandidate,
  saveSuggestion,
  rankImagesForPost
};
