const fs = require("fs");
const path = require("path");

// Minimal valid JPEG binary buffer
const minimalJpeg = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
  0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
  0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
  0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
  0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
  0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
  0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
  0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F,
  0x00, 0xBF, 0x80, 0xFF, 0xD9
]);

const dataset = {
  animals: [
    "fox_woodland_1.jpg",
    "fox_snow_2.jpg",
    "fox_portrait_3.jpg",
    "wolf_howling_1.jpg",
    "wolf_forest_pack_2.jpg",
    "wolf_winter_3.jpg",
    "cat_tabby_indoor_1.jpg",
    "cat_siamese_2.jpg",
    "golden_retriever_park_1.jpg",
    "golden_retriever_running_2.jpg",
    "animal_silhouette_blurry.jpg"
  ],
  food: [
    "pizza_margherita_1.jpg",
    "pizza_pepperoni_2.jpg",
    "pasta_carbonara_1.jpg",
    "pasta_bolognese_2.jpg",
    "sushi_nigiri_combo_1.jpg",
    "sushi_maki_rolls_2.jpg",
    "burger_artisan_beef_1.jpg",
    "tacos_street_carne_1.jpg",
    "dessert_chocolate_lava_1.jpg",
    "salad_mediterranean_1.jpg",
    "food_underexposed_mystery.jpg"
  ],
  nature: [
    "mountain_alpine_sunrise_1.jpg",
    "mountain_rocky_ridge_2.jpg",
    "desert_sahara_dunes_1.jpg",
    "desert_oasis_sunset_2.jpg",
    "forest_autumn_trail_1.jpg",
    "forest_redwood_mist_2.jpg",
    "ocean_tropical_beach_1.jpg",
    "ocean_cliff_waves_2.jpg",
    "waterfall_cascade_jungle_1.jpg",
    "lake_reflection_serene_1.jpg",
    "nature_overexposed_sky.jpg"
  ],
  vehicles: [
    "car_sports_red_coupe_1.jpg",
    "car_supercar_yellow_2.jpg",
    "motorcycle_vintage_cafe_1.jpg",
    "motorcycle_sportbike_blue_2.jpg",
    "airplane_commercial_jet_1.jpg",
    "airplane_light_cessna_2.jpg",
    "ship_cargo_container_1.jpg",
    "ship_sailboat_yacht_2.jpg",
    "train_high_speed_bullet_1.jpg",
    "bicycle_road_racing_1.jpg",
    "vehicle_motion_blur_smudge.jpg"
  ]
};

function populateImages() {
  const baseDir = path.join(__dirname, "../../data/images");
  let totalCreated = 0;

  for (const [category, files] of Object.entries(dataset)) {
    const categoryDir = path.join(baseDir, category);
    if (!fs.existsSync(categoryDir)) {
      fs.mkdirSync(categoryDir, { recursive: true });
    }

    for (const filename of files) {
      const filePath = path.join(categoryDir, filename);
      fs.writeFileSync(filePath, minimalJpeg);
      totalCreated++;
    }
  }

  console.log(`Successfully generated ${totalCreated} image files across 4 categories.`);
}

populateImages();
