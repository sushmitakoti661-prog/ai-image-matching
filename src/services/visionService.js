const fs = require("fs");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { ImageMetadataSchema } = require("./schema");
const { checkBudgetGuard, recordAiCost } = require("./costService");

const LOW_CONFIDENCE_THRESHOLD = 0.70;
const IMAGE_MIME_TYPES = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp"
};

// Deterministic catalog reserved strictly for local development and offline unit tests
const LOCAL_DEV_KNOWLEDGE = {
  // Animals
  "fox_woodland_1.jpg": {
    subject: "fox",
    category: "animals",
    attributes: { species: "vulpes_vulpes", fur_color: "red-orange", habitat: "temperate_woodland", pose: "alert_standing" },
    caption: "A sharp, vibrant red fox standing alert amidst lush green woodland ferns.",
    confidence: 0.96
  },
  "fox_snow_2.jpg": {
    subject: "fox",
    category: "animals",
    attributes: { species: "vulpes_vulpes", fur_color: "red-orange", habitat: "snowy_winter", pose: "sitting" },
    caption: "A red fox with a bushy tail sitting in deep white winter snow.",
    confidence: 0.95
  },
  "fox_portrait_3.jpg": {
    subject: "fox",
    category: "animals",
    attributes: { species: "vulpes_vulpes", fur_color: "orange_white", lighting: "golden_hour", pose: "close_up_portrait" },
    caption: "Detailed close-up portrait of a red fox with bright amber eyes in warm sunlight.",
    confidence: 0.94
  },
  "wolf_howling_1.jpg": {
    subject: "wolf",
    category: "animals",
    attributes: { species: "canis_lupus", fur_color: "grey", habitat: "rocky_ridge", pose: "howling" },
    caption: "A majestic grey wolf howling from a rocky cliff against an overcast sky.",
    confidence: 0.95
  },
  "wolf_forest_pack_2.jpg": {
    subject: "wolf",
    category: "animals",
    attributes: { species: "canis_lupus", fur_color: "silver_grey", habitat: "dense_pine_forest", pose: "pack_prowling" },
    caption: "Grey wolves prowling quietly through a dense northern coniferous pine forest.",
    confidence: 0.93
  },
  "wolf_winter_3.jpg": {
    subject: "lion",
    category: "animals",
    attributes: { species: "panthera_leo", habitat: "wild_savanna", pose: "alert_portrait" },
    caption: "A large predatory wild lion portrait in natural daylight.",
    confidence: 0.94
  },
  "cat_tabby_indoor_1.jpg": {
    subject: "cat",
    category: "animals",
    attributes: { species: "felis_catus", coat_pattern: "brown_tabby", setting: "indoor_living_room", pose: "resting" },
    caption: "A domestic brown tabby cat resting comfortably on an indoor rug.",
    confidence: 0.96
  },
  "cat_siamese_2.jpg": {
    subject: "cat",
    category: "animals",
    attributes: { species: "felis_catus", breed: "domestic_shorthair", eye_color: "green", setting: "indoor" },
    caption: "A curious domestic cat looking directly at the camera indoors.",
    confidence: 0.95
  },
  "golden_retriever_park_1.jpg": {
    subject: "dog",
    category: "animals",
    attributes: { species: "canis_familiaris", breed: "golden_retriever", setting: "sunny_park", pose: "sitting_smiling" },
    caption: "A friendly golden retriever sitting happily on green lawn in a sunny community park.",
    confidence: 0.97
  },
  "golden_retriever_running_2.jpg": {
    subject: "dog",
    category: "animals",
    attributes: { species: "canis_familiaris", breed: "golden_retriever", setting: "beach", pose: "running_fetch" },
    caption: "A golden retriever joyfully sprinting outdoors across sandy ground.",
    confidence: 0.96
  },
  "animal_silhouette_blurry.jpg": {
    subject: "unknown_animal",
    category: "animals",
    attributes: { issue: "motion_blur", clarity: "degraded", visibility: "silhouette_only" },
    caption: "An ambiguous, blurry dark silhouette of an unidentified animal in heavy mist.",
    confidence: 0.42 // Low-confidence trigger (< 0.70)
  },

  // Food
  "pizza_margherita_1.jpg": {
    subject: "pizza",
    category: "food",
    attributes: { cuisine: "italian", style: "neapolitan", toppings: ["fresh_mozzarella", "basil", "tomato_sauce"] },
    caption: "Authentic wood-fired Neapolitan Margherita pizza with bubbling mozzarella and fresh basil leaves.",
    confidence: 0.97
  },
  "pizza_pepperoni_2.jpg": {
    subject: "pizza",
    category: "food",
    attributes: { cuisine: "american_italian", style: "crispy_crust", toppings: ["crispy_pepperoni", "melted_cheese"] },
    caption: "Hot baked pepperoni pizza with crispy cup pepperoni slices and stringy golden cheese.",
    confidence: 0.96
  },
  "pasta_carbonara_1.jpg": {
    subject: "pasta",
    category: "food",
    attributes: { cuisine: "roman_italian", pasta_type: "spaghetti", ingredients: ["guanciale", "pecorino", "egg_yolk"] },
    caption: "Creamy traditional Roman spaghetti carbonara garnished with crisp guanciale and cracked black pepper.",
    confidence: 0.95
  },
  "pasta_bolognese_2.jpg": {
    subject: "pasta",
    category: "food",
    attributes: { cuisine: "italian", pasta_type: "tagliatelle", sauce: "slow_cooked_ragu" },
    caption: "Rich slow-simmered beef ragù served over fresh tagliatelle pasta with shaved parmesan.",
    confidence: 0.96
  },
  "sushi_nigiri_combo_1.jpg": {
    subject: "sushi",
    category: "food",
    attributes: { cuisine: "japanese", varieties: ["salmon_nigiri", "tuna_nigiri", "tamago"], sides: ["wasabi", "pickled_ginger"] },
    caption: "Artful Japanese sushi platter featuring fresh salmon and yellowfin tuna nigiri with wasabi.",
    confidence: 0.97
  },
  "sushi_maki_rolls_2.jpg": {
    subject: "sushi",
    category: "food",
    attributes: { cuisine: "japanese", type: "maki_roll", fillings: ["avocado", "cucumber", "toasted_sesame"] },
    caption: "Precision-cut avocado and cucumber maki sushi rolls sprinkled with toasted sesame seeds.",
    confidence: 0.95
  },
  "burger_artisan_beef_1.jpg": {
    subject: "burger",
    category: "food",
    attributes: { style: "gourmet", patty: "angus_beef", bun: "toasted_brioche", layers: ["cheddar", "lettuce", "tomato"] },
    caption: "Gourmet grilled Angus beef burger on toasted brioche with melted sharp cheddar and crisp lettuce.",
    confidence: 0.96
  },
  "tacos_street_carne_1.jpg": {
    subject: "taco",
    category: "food",
    attributes: { cuisine: "mexican", tortilla: "corn", filling: "carne_asada", garnishes: ["cilantro", "diced_onions", "lime"] },
    caption: "Authentic Mexican street tacos filled with seasoned grilled carne asada, fresh cilantro, and lime wedges.",
    confidence: 0.95
  },
  "dessert_chocolate_lava_1.jpg": {
    subject: "chocolate_cake",
    category: "food",
    attributes: { dessert_type: "lava_cake", accompaniments: ["vanilla_ice_cream", "fresh_raspberries"] },
    caption: "Decadent warm chocolate lava cake with molten center paired with vanilla bean ice cream.",
    confidence: 0.97
  },
  "salad_mediterranean_1.jpg": {
    subject: "salad",
    category: "food",
    attributes: { style: "greek_mediterranean", ingredients: ["kalamata_olives", "feta_cheese", "cucumbers", "olive_oil"] },
    caption: "Crisp Mediterranean Greek salad with cubed feta cheese, Kalamata olives, and ripe cherry tomatoes.",
    confidence: 0.96
  },
  "food_underexposed_mystery.jpg": {
    subject: "mystery_food",
    category: "food",
    attributes: { issue: "extreme_underexposure", clarity: "unrecognizable" },
    caption: "A very dark, heavily underexposed image of an indistinguishable plate of food.",
    confidence: 0.38 // Low-confidence trigger (< 0.70)
  },

  // Nature
  "mountain_alpine_sunrise_1.jpg": {
    subject: "mountain",
    category: "nature",
    attributes: { landscape_type: "alpine_range", features: ["snow_covered_peaks", "golden_alpenglow"] },
    caption: "Dramatic snow-capped alpine mountain peaks glowing under early morning golden sunrise light.",
    confidence: 0.98
  },
  "mountain_rocky_ridge_2.jpg": {
    subject: "mountain",
    category: "nature",
    attributes: { landscape_type: "granite_ridge", atmosphere: "crisp_blue_sky" },
    caption: "Rugged granite mountain ridge and sheer cliff faces under a vibrant clear blue sky.",
    confidence: 0.96
  },
  "desert_sahara_dunes_1.jpg": {
    subject: "desert",
    category: "nature",
    attributes: { landscape_type: "sand_dunes", features: ["wind_ripples", "shadow_crests"] },
    caption: "Sweeping golden Sahara desert sand dunes with rhythmic wind-carved ripple patterns.",
    confidence: 0.97
  },
  "desert_oasis_sunset_2.jpg": {
    subject: "desert",
    category: "nature",
    attributes: { landscape_type: "desert_oasis", features: ["palm_grove", "dusk_colors"] },
    caption: "Serene desert oasis surrounded by palm trees as the sun dips below orange sand dunes.",
    confidence: 0.95
  },
  "forest_autumn_trail_1.jpg": {
    subject: "forest",
    category: "nature",
    attributes: { season: "autumn", features: ["golden_canopy", "fallen_leaves_pathway"] },
    caption: "Winding hiking path blanketed in amber and red fallen leaves through a golden autumn forest.",
    confidence: 0.97
  },
  "forest_redwood_mist_2.jpg": {
    subject: "forest",
    category: "nature",
    attributes: { ecosystem: "coastal_redwoods", atmosphere: "morning_fog_rays" },
    caption: "Towering ancient coastal redwood trees with sunbeams piercing through morning coastal fog.",
    confidence: 0.96
  },
  "ocean_tropical_beach_1.jpg": {
    subject: "ocean",
    category: "nature",
    attributes: { coastal_type: "tropical_beach", features: ["turquoise_water", "white_sand", "palm_fronds"] },
    caption: "Idyllic tropical coastline with crystal-clear turquoise ocean waves gently lapping white sand.",
    confidence: 0.98
  },
  "ocean_cliff_waves_2.jpg": {
    subject: "ocean",
    category: "nature",
    attributes: { coastal_type: "rocky_coast", features: ["crashing_surf", "dramatic_spray"] },
    caption: "Powerful ocean waves crashing against jagged sea cliffs throwing white sea spray into the air.",
    confidence: 0.96
  },
  "waterfall_cascade_jungle_1.jpg": {
    subject: "waterfall",
    category: "nature",
    attributes: { setting: "tropical_rainforest", features: ["multi_tier_cascade", "emerald_pool"] },
    caption: "Lush tropical multi-tiered waterfall cascading into a clear emerald rainforest plunge pool.",
    confidence: 0.97
  },
  "lake_reflection_serene_1.jpg": {
    subject: "lake",
    category: "nature",
    attributes: { setting: "glacial_lake", features: ["glassy_surface", "pine_reflection"] },
    caption: "Still glacial mountain lake creating a mirror reflection of surrounding evergreen pines.",
    confidence: 0.96
  },
  "nature_overexposed_sky.jpg": {
    subject: "sky",
    category: "nature",
    attributes: { issue: "heavy_overexposure", whiteout: true },
    caption: "Heavily overexposed, washed-out sky with no discernable landscape horizon or cloud detail.",
    confidence: 0.35 // Low-confidence trigger (< 0.70)
  },

  // Vehicles
  "car_sports_red_coupe_1.jpg": {
    subject: "sports_car",
    category: "vehicles",
    attributes: { vehicle_type: "coupe", color: "gloss_red", setting: "asphalt_racetrack" },
    caption: "A sleek high-performance red sports coupe accelerating on a paved professional racetrack.",
    confidence: 0.97
  },
  "car_supercar_yellow_2.jpg": {
    subject: "sports_car",
    category: "vehicles",
    attributes: { vehicle_type: "supercar", color: "bright_yellow", design: "aerodynamic_carbon_trim" },
    caption: "A modern exotic yellow supercar parked on an urban avenue showcasing aerodynamic body lines.",
    confidence: 0.96
  },
  "motorcycle_vintage_cafe_1.jpg": {
    subject: "motorcycle",
    category: "vehicles",
    attributes: { style: "vintage_cafe_racer", finish: "matte_black_chrome", engine: "twin_cylinder" },
    caption: "Custom vintage cafe racer motorcycle with polished chrome accents and brown leather seat.",
    confidence: 0.96
  },
  "motorcycle_sportbike_blue_2.jpg": {
    subject: "motorcycle",
    category: "vehicles",
    attributes: { style: "supersport", color: "metallic_blue", setting: "mountain_curves" },
    caption: "Modern blue supersport motorcycle leaning into a paved mountain switchback turn.",
    confidence: 0.95
  },
  "airplane_commercial_jet_1.jpg": {
    subject: "airplane",
    category: "vehicles",
    attributes: { type: "commercial_airliner", propulsion: "twin_turbofan", setting: "cruising_altitude" },
    caption: "Commercial twin-engine passenger airliner soaring smoothly above a sea of white clouds.",
    confidence: 0.97
  },
  "airplane_light_cessna_2.jpg": {
    subject: "airplane",
    category: "vehicles",
    attributes: { type: "single_engine_propeller", setting: "grass_airstrip" },
    caption: "Single-engine propeller light aircraft parked on the taxiway of a rural airfield.",
    confidence: 0.95
  },
  "ship_cargo_container_1.jpg": {
    subject: "cargo_ship",
    category: "vehicles",
    attributes: { vessel_type: "container_vessel", load: "multitude_shipping_containers", setting: "open_ocean" },
    caption: "Enormous ocean-going container cargo ship stacked high with colorful shipping containers.",
    confidence: 0.96
  },
  "ship_sailboat_yacht_2.jpg": {
    subject: "sailboat",
    category: "vehicles",
    attributes: { vessel_type: "sailing_yacht", sails: "white_spinnaker", setting: "sunny_harbor" },
    caption: "Graceful luxury sailing yacht with full white sails catching wind in a sun-drenched coastal bay.",
    confidence: 0.96
  },
  "train_high_speed_bullet_1.jpg": {
    subject: "bullet_train",
    category: "vehicles",
    attributes: { train_type: "high_speed_electric", setting: "elevated_viaduct" },
    caption: "Streamlined aerodynamic high-speed bullet train traveling along an elevated concrete viaduct.",
    confidence: 0.97
  },
  "bicycle_road_racing_1.jpg": {
    subject: "bicycle",
    category: "vehicles",
    attributes: { bike_type: "carbon_road_bike", setting: "alpine_pass" },
    caption: "Lightweight carbon-fiber road racing bicycle resting against a guardrail on an alpine pass.",
    confidence: 0.95
  },
  "vehicle_motion_blur_smudge.jpg": {
    subject: "vehicle_streak",
    category: "vehicles",
    attributes: { issue: "severe_motion_smudge", unrecognizable_model: true },
    caption: "Unidentifiable blurred streak of light and color from a fast-moving vehicle at night.",
    confidence: 0.39 // Low-confidence trigger (< 0.70)
  }
};

/**
 * Check whether real Gemini Vision API is configured with a valid key.
 */
function isRealGeminiConfigured() {
  const key = process.env.GEMINI_API_KEY;
  return Boolean(key && key.trim() !== "" && key !== "your_gemini_api_key_here");
}

/**
 * Perform Vision AI analysis on an image file.
 * Uses real Google Gemini Vision API when GEMINI_API_KEY is present.
 * Distinguishes clearly between real Vision AI and local dev mock engine.
 */
async function analyzeImage(imageRecord, options = {}) {
  const { id: imageId, filename, path: relPath } = imageRecord;
  const filePath = path.isAbsolute(relPath) ? relPath : path.join(process.cwd(), relPath);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Image file not found on disk at: ${filePath}`);
  }

  // Budget guard check
  await checkBudgetGuard(0.001);

  const realGeminiAvailable = isRealGeminiConfigured();
  const forceLocal = process.env.VISION_PROVIDER === "local";
  const requireRealAi = process.env.REQUIRE_REAL_AI === "true";

  if (requireRealAi && !realGeminiAvailable) {
    throw new Error("Configuration Error: REQUIRE_REAL_AI is true but no valid GEMINI_API_KEY is configured in .env");
  }

  if (requireRealAi && forceLocal) {
    throw new Error("Configuration Error: REQUIRE_REAL_AI is true but VISION_PROVIDER is set to local");
  }

  let rawOutput = null;
  let modelName = "vision-local-dev";
  let promptTokens = 250;
  let completionTokens = 90;
  let providerUsed = "local_dev_mock";

  if (!forceLocal && realGeminiAvailable) {
    providerUsed = "gemini_vision_api";
    modelName = process.env.GEMINI_MODEL || "gemini-3.6-flash";

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: modelName });

    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString("base64");
    const mimeType = IMAGE_MIME_TYPES[path.extname(filePath).toLowerCase()];

    if (!mimeType) {
      throw new Error(`Unsupported image type for Gemini Vision: ${path.extname(filePath)}`);
    }

    const prompt = `You are an expert Vision AI system for content matching. Analyze this image and output ONLY a raw, strictly valid JSON object matching this schema:
{
  "subject": "primary subject name (e.g. fox, wolf, dog, cat, pizza, pasta, sushi, mountain, desert, sports_car, unknown_animal)",
  "category": "must be one of: animals | food | nature | vehicles | other",
  "attributes": { "key": "value" },
  "caption": "A concise 1-2 sentence description of visual contents",
  "confidence": 0.95 (number between 0.0 and 1.0; MUST be below 0.70 if the image is blurry, ambiguous, heavily underexposed, or overexposed)
}
Return strictly raw JSON.`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType
        }
      }
    ]);

    const text = result.response.text().trim();
    const cleaned = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    rawOutput = JSON.parse(cleaned);

    // Normalize category to lowercase
    if (rawOutput.category) {
      rawOutput.category = rawOutput.category.toLowerCase().trim();
    }

    if (result.response.usageMetadata) {
      promptTokens = result.response.usageMetadata.promptTokenCount || promptTokens;
      completionTokens = result.response.usageMetadata.candidatesTokenCount || completionTokens;
    }
  }

  // Local development mock provider (only when real AI is not required and not available)
  if (!rawOutput) {
    providerUsed = "local_dev_mock";
    modelName = "vision-local-dev";

    if (LOCAL_DEV_KNOWLEDGE[filename]) {
      rawOutput = LOCAL_DEV_KNOWLEDGE[filename];
    } else {
      const cleanName = filename.replace(/\.[^/.]+$/, "").replace(/_\d+$/, "");
      const isBlurry = /blur|smudge|overexposed|mystery|ambiguous/i.test(filename);
      const inferredCategory = relPath.includes("animals") ? "animals"
        : relPath.includes("food") ? "food"
        : relPath.includes("nature") ? "nature"
        : relPath.includes("vehicles") ? "vehicles"
        : "other";

      rawOutput = {
        subject: cleanName.replace(/_/g, " "),
        category: inferredCategory,
        attributes: { auto_detected: true, filename },
        caption: `An image depicting ${cleanName.replace(/_/g, " ")}.`,
        confidence: isBlurry ? 0.45 : 0.92
      };
    }
  }

  // Strict Zod Validation — Rejects invalid model outputs
  const parsed = ImageMetadataSchema.parse(rawOutput);

  // Low-confidence determination
  const lowConfidence = parsed.confidence < LOW_CONFIDENCE_THRESHOLD;

  // Record AI cost
  const costRecord = await recordAiCost({
    operation: "image_understanding",
    entityType: "image",
    entityId: imageId,
    model: modelName,
    promptTokens,
    completionTokens
  });

  return {
    metadata: parsed,
    lowConfidence,
    model: modelName,
    provider: providerUsed,
    cost: costRecord
  };
}

module.exports = {
  analyzeImage,
  isRealGeminiConfigured,
  LOW_CONFIDENCE_THRESHOLD,
  LOCAL_DEV_KNOWLEDGE
};
