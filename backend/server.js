import express from "express";
import multer from "multer";
import fs from "fs";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import fetch from "node-fetch";
import { Document, Packer, Paragraph, TextRun } from "docx";
import dotenv from "dotenv";
import bodyParser from "body-parser";

dotenv.config();
const app = express();
const upload = multer({ dest: "uploads/" });

app.use(bodyParser.json());

// HuggingFace API Helper
async function callHFModel(model, input) {
  const response = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.HF_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ inputs: input }),
  });
  return await response.json();
}

// AI Resume Rewrite
async function analyzeAndRewrite(text) {
  const result = await callHFModel(
    "bigscience/bloom-560m",
    `Rewrite this resume in professional ATS-optimized format:\n${text}`
  );
  return result[0]?.generated_text || text;
}

// POST: Analyze resume
app.post("/analyze", upload.single("resume"), async (req, res) => {
  try {
    const filePath = req.file.path;
    let resumeText = "";

    // Parse PDF
    if (req.file.originalname.endsWith(".pdf")) {
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      resumeText = pdfData.text;
    }
    // Parse DOCX
    else if (req.file.originalname.endsWith(".docx")) {
      const docData = await mammoth.extractRawText({ path: filePath });
      resumeText = docData.value;
    }

    fs.unlinkSync(filePath); // Clean up temp file

    // Rewrite Resume
    const improvedResume = await analyzeAndRewrite(resumeText);
    res.json({ improvedResume });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error processing resume" });
  }
});

// POST: Download improved resume
app.post("/download", async (req, res) => {
  try {
    const { content } = req.body;
    const doc = new Document({
      sections: [
        {
          children: content.split("\n").map(
            (line) => new Paragraph({ children: [new TextRun(line)] })
          ),
        },
      ],
    });

    const buffer = await Packer.toBuffer(doc);
    const fileName = `resume_${Date.now()}.docx`;
    fs.writeFileSync(fileName, buffer);

    res.download(fileName, "optimized_resume.docx", () => {
      fs.unlinkSync(fileName);
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Download error" });
  }
});

// Start locally
app.listen(3000, () => console.log("✅ Backend running on http://localhost:3000"));

export default app; // Required for Vercel
