const { Worker } = require("bullmq");
const Redis = require("ioredis");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse"); 
const { GoogleGenerativeAI } = require("@google/generative-ai");

const Document = require("../models/Document");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const connection = new Redis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const documentWorker = new Worker(
  "document-processing",
  async (job) => {
    console.log(`\n[Worker] 🧑‍🍳 Chef grabbed Job ID: ${job.id}`);
    
    // Bulletproof the path for Render's environment
    const filePath = path.resolve(process.cwd(), job.data.path);
    
    try {
      console.log(`[Worker] 🔍 Extracting text from PDF at ${filePath}...`);
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      const extractedText = pdfData.text;

      console.log(`[Worker] 🧠 Sending ${extractedText.length} characters to AI...`);
      
      const prompt = `Please provide a concise, 3-sentence summary of the following document:\n\n${extractedText}`;
      let aiSummary = "";

      try {
        const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" }); 
        const result = await model.generateContent(prompt);
        aiSummary = result.response.text();
      } catch (primaryError) {
        console.warn(`[Worker] ⚠️ Primary model failed. Switching to fallback model...`);
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
        const result = await fallbackModel.generateContent(prompt);
        aiSummary = result.response.text();
      }

      console.log(`[Worker] ✨ AI Analysis complete!`);
      const savedDoc = new Document({
        filename: job.data.filename,
        originalName: job.data.originalname,
        extractedText: extractedText, 
        aiSummary: aiSummary,        
        jobId: job.id,
        status: "completed"
      });

      await savedDoc.save();
      console.log(`[Worker] 🏆 Success! Document safely filed in the database.`);

      // GUARANTEED CLEANUP: ONLY DELETE ON SUCCESS!
      if (fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) console.error(`[Worker] ⚠️ Failed to delete temp file:`, err);
          else console.log(`[Worker] 🧹 Cleaned up local temp file successfully.`);
        });
      }

      return { status: "success", dbId: savedDoc._id };

    } catch (error) {
      console.error(`[Worker] ❌ Failed to process document:`, error.message);
      throw error; 
    } 
    // Notice: The finally block is GONE!
  },
  { connection },
);

documentWorker.on("failed", (job, err) => {
  console.error(`[Worker] ❌ Job ${job.id} failed: ${err.message}`);
  
  // Check if the job has exhausted all of its allowed retry attempts
  const maxAttempts = job.opts.attempts || 1;
  
  if (job.attemptsMade >= maxAttempts) {
    console.warn(`[Worker] 🚨 Job ${job.id} failed permanently! Cleaning up toxic file...`);
    
    // Safely resolve the path and delete the file to protect server disk space
    const filePath = path.resolve(process.cwd(), job.data.path);
    if (fs.existsSync(filePath)) {
      fs.unlink(filePath, (unlinkErr) => {
        if (unlinkErr) {
          console.error(`[Worker] ⚠️ Failed to delete toxic file:`, unlinkErr);
        } else {
          console.log(`[Worker] 🗑️ Toxic file safely deleted. Server space protected!`);
        }
      });
    }
  }
});

console.log("Chef is awake, equipped with AI, and ready to analyze...");

module.exports = documentWorker;