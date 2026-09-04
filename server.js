require("dotenv").config();
const express = require("express");

const imageRoutes = require("./src/routes/imageRoutes");
const costRoutes = require("./src/routes/costRoutes");

const app = express();

app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "ai-image-understanding-content-matching",
    timestamp: new Date().toISOString()
  });
});

// Mount routes
app.use("/images", imageRoutes);
app.use("/costs", costRoutes);

const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = app;