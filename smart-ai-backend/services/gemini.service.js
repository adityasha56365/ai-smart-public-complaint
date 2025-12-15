import dotenv from "dotenv";
import axios from "axios";

// ✅ dotenv yahin bhi load karo
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

if (!API_KEY) {
  console.error("❌ ENV DEBUG:", process.env);
  throw new Error("❌ GEMINI_API_KEY missing in .env file");
}

// ✅ working model
const MODEL = "gemini-2.5-flash";

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1/models/${MODEL}:generateContent?key=${API_KEY}`;

export async function generateGeminiResponse(userMessage) {
  try {
    const response = await axios.post(
      GEMINI_URL,
      {
        contents: [
          {
            parts: [{ text: userMessage }],
          },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return response.data.candidates[0].content.parts[0].text;
  } catch (error) {
    console.error(
      "🔥 Gemini API Error:",
      error.response?.data || error.message
    );
    throw new Error("Gemini API failed");
  }
}
