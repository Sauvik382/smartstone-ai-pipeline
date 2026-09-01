const { Worker } = require("bullmq");
const Redis = require("ioredis");
const fs = require("fs");
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
    const filePath = job.data.path;
    
    try {
      console.log(`[Worker] 🔍 Extracting text from PDF...`);
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      const extractedText = pdfData.text;

      console.log(`[Worker] 🧠 Sending ${extractedText.length} characters to AI...`);
      
      const prompt = `Please provide a concise, 3-sentence summary of the following document:\n\n${extractedText}`;
      let aiSummary = "";

      try {
        console.log(`[Worker] Trying primary model (gemini-3.7-flash)...`);
        const model = genAI.getGenerativeModel({ model: "gemini-3.7-flash" }); 
        const result = await model.generateContent(prompt);
        aiSummary = result.response.text();
      } catch (primaryError) {
        console.warn(`[Worker] ⚠️ Primary model failed or is busy. Switching to fallback model (gemini-3.5-flash)...`);
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
        const result = await fallbackModel.generateContent(prompt);
        aiSummary = result.response.text();
      }

      console.log(`[Worker] ✨ AI Analysis complete!`);
      
      console.log(`[Worker] 💾 Saving results to MongoDB Vault...`);
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

      return { 
          status: "success", 
          file: job.data.filename,
          summary: aiSummary,
          dbId: savedDoc._id 
      };

    } catch (error) {
      console.error(`[Worker] ❌ Failed to process document:`, error);
      throw error; 
    } finally {
      // GUARANTEED CLEANUP: Deletes the local temp file whether success or failure
      if (filePath && fs.existsSync(filePath)) {
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error(`[Worker] ⚠️ Failed to delete local temp file at ${filePath}:`, err);
          } else {
            console.log(`[Worker] 🧹 Cleaned up local temp file successfully.`);
          }
        });
      }
    }
  },
  { connection },
);

documentWorker.on("failed", (job, err) => {
  console.error(`[Worker] ❌ Job ${job.id} failed: ${err.message}`);
});

console.log("Chef is awake, equipped with AI, and ready to analyze...");

module.exports = documentWorker;