import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import aiRoutes from "./routes/ai.routes.js";

// ✅ dotenv sabse pehle load
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// ✅ test route
app.get("/", (req, res) => {
  res.send("🚀 Smart AI Backend running successfully");
});

// ✅ AI routes
app.use("/api/ai", aiRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Smart AI Backend running on http://localhost:${PORT}`);
});
