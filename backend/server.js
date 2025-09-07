import express from "express";
import multer from "multer";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import fetch from "node-fetch";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const app = express();
app.use(express.json());

const upload = multer({ dest: "/tmp" }); // Vercel temp folder

app.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    let text = "";

    // Handle PDF
    if (req.file?.mimetype === "application/pdf") {
      const dataBuffer = fs.readFileSync(req.file.path);
      const parsed = await pdfParse(dataBuffer);
      text = parsed.text;
    }

    // Handle DOCX
    if (
      req.file?.mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ path: req.file.path });
      text = result.value;
    }

    // Call Hugging Face API
    const response = await fetch(
      "https://api-inference.huggingface.co/models/distilbert-base-uncased",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ inputs: text }),
      }
    );

    const data = await response.json();

    res.json({
      message: "Resume analyzed successfully",
      insights: data,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Analysis failed" });
  }
});

// ⛔️ Vercel me app.listen nahi chahiye
export default app;
