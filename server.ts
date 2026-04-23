import express from "express";
import { GoogleGenAI } from "@google/genai";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import fs from "fs";

const __filename = fileURLToPath(import.meta.env?.url || import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize Gemini (Server-side)
  const apiKey = process.env.GEMINI_API_KEY;
  const ai = apiKey ? new GoogleGenAI(apiKey) : null;

  // API Route for Digitization
  app.post("/api/digitize", async (req, res) => {
    if (!ai) {
      return res.status(500).json({ error: "Gemini API key not configured on server" });
    }

    try {
      const { image, schema } = req.body;
      const model = ai.getGenerativeModel({ model: "gemini-1.5-flash" });

      const result = await model.generateContent([
        { text: "This is a photo of a community survey or field report. Extract the key data into a structured JSON format. Identify the 'Primary Need', 'Location', 'Severity (1-5)', and 'Citizen Comment'. Be precise." },
        { inlineData: { data: image, mimeType: 'image/jpeg' } }
      ]);

      res.json({ text: result.response.text() });
    } catch (error: any) {
      console.error("AI Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
