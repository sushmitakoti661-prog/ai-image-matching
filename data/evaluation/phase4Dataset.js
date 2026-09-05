const { z } = require("zod");

const EvaluationCaseSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  content: z.string().min(1),
  expectedFilename: z.string().min(1).optional(),
  expectedNoMatch: z.boolean().optional().default(false),
  negativeFilenames: z.array(z.string()).default([])
}).refine((item) => item.expectedNoMatch !== Boolean(item.expectedFilename), {
  message: "Each case must define either expectedFilename or expectedNoMatch"
});

const Phase4EvaluationDataset = [
  {
    id: "fox-ecology",
    title: "The Secret Life of the Red Fox",
    content: "Red fox ecology, woodland habitat, behavior, and winter survival.",
    expectedFilename: "fox_woodland_1.jpg",
    negativeFilenames: ["wolf_howling_1.jpg"]
  },
  {
    id: "wolf-conservation",
    title: "Grey Wolf Conservation",
    content: "Wolf packs, wilderness habitat, and grey wolf conservation efforts.",
    expectedFilename: "wolf_howling_1.jpg",
    negativeFilenames: ["fox_woodland_1.jpg"]
  },
  {
    id: "italian-pizza",
    title: "How to Bake Italian Pizza",
    content: "Neapolitan pizza dough, tomato sauce, mozzarella, and basil.",
    expectedFilename: "pizza_margherita_1.jpg",
    negativeFilenames: ["pasta_carbonara_1.jpg"]
  },
  {
    id: "japanese-sushi",
    title: "Japanese Sushi Masterclass",
    content: "Sushi preparation, nigiri technique, salmon, tuna, and rice.",
    expectedFilename: "sushi_nigiri_combo_1.jpg",
    negativeFilenames: ["pizza_margherita_1.jpg"]
  },
  {
    id: "alpine-hiking",
    title: "Alpine Hiking Expedition",
    content: "Mountain trails, snow-covered peaks, altitude, and alpine hiking.",
    expectedFilename: "mountain_alpine_sunrise_1.jpg",
    negativeFilenames: ["desert_sahara_dunes_1.jpg"]
  },
  {
    id: "desert-survival",
    title: "Desert Survival and Sand Dunes",
    content: "Sahara desert travel, sand dunes, heat, water, and survival.",
    expectedFilename: "desert_sahara_dunes_1.jpg",
    negativeFilenames: ["forest_autumn_trail_1.jpg"]
  },
  {
    id: "sports-car-engineering",
    title: "Sports Car Engineering",
    content: "High-performance sports cars, aerodynamics, engines, and racetracks.",
    expectedFilename: "car_sports_red_coupe_1.jpg",
    negativeFilenames: ["motorcycle_vintage_cafe_1.jpg"]
  },
  {
    id: "vintage-motorcycle",
    title: "Vintage Motorcycle Restoration",
    content: "Restoring a classic motorcycle, cafe racer parts, engines, and frames.",
    expectedFilename: "motorcycle_vintage_cafe_1.jpg",
    negativeFilenames: ["car_sports_red_coupe_1.jpg"]
  },
  {
    id: "quantum-computing",
    title: "Quantum Computing Algorithms",
    content: "Qubits, quantum gates, quantum error correction, and algorithms.",
    expectedNoMatch: true,
    negativeFilenames: []
  },
  {
    id: "golden-retriever-care",
    title: "Golden Retriever Pet Care",
    content: "Golden retriever nutrition, exercise, training, and family care.",
    expectedFilename: "golden_retriever_park_1.jpg",
    negativeFilenames: ["cat_tabby_indoor_1.jpg"]
  }
].map((item) => EvaluationCaseSchema.parse(item));

module.exports = {
  EvaluationCaseSchema,
  Phase4EvaluationDataset
};
