import express from "express";
import { generateGeminiResponse } from "../services/gemini.service.js";

const router = express.Router();

router.post("/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const reply = await generateGeminiResponse(message);

    res.json({ reply });
  } catch (err) {
    console.error("AI Route Error:", err.message);
    res.status(500).json({ error: "AI service failed" });
  }
});

export default router;
