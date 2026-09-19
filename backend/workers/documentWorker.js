const { Worker } = require("bullmq");
const Redis = require("ioredis");
const fs = require("fs");
const path = require("path");
const pdfParse = require("pdf-parse"); 
const { GoogleGenerativeAI } = require("@google/generative-ai");

const { RecursiveCharacterTextSplitter } = require("@langchain/textsplitters");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { pineconeIndex } = require("../config/pinecone");

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
    const currentUserId = job.data.userId || "anonymous-user";
    
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

      // 🧹 AUTO-CLEANUP CHECK: If total summaries reach 50, wipe everything
      const totalDocs = await Document.countDocuments();
      if (totalDocs >= 50) {
        console.log(`[Worker] ⚠️ Limit of 50 summaries reached! Wiping all records...`);
        await Document.deleteMany({});
        console.log(`[Worker] 🗑️ Database cleaned successfully.`);
      }

      const savedDoc = new Document({
        filename: job.data.filename,
        originalName: job.data.originalname,
        extractedText: extractedText, 
        aiSummary: aiSummary,         
        jobId: job.id,
        status: "completed",
        userId: currentUserId
      });

      await savedDoc.save();
      console.log(`[Worker] 🏆 Success! Document safely filed in the database.`);

      console.log(`[Worker] 🔪 Slicing document into manageable chunks...`);
      
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200, 
      });

      const chunks = await splitter.createDocuments([extractedText]);
      const chunkTexts = chunks.map(chunk => chunk.pageContent);
      console.log(`[Worker] 🧩 Created ${chunkTexts.length} chunks. Generating embeddings...`);

      const embeddingsClient = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GEMINI_API_KEY,
        model: "gemini-embedding-001",
      });

      const vectors = await embeddingsClient.embedDocuments(chunkTexts);
      
      if (!vectors || vectors.length === 0) {
        throw new Error("Gemini AI returned no embedding vectors.");
      }

      const pineconeRecords = vectors.map((vectorItem, index) => {
        // 🛡️ THE FIX: Deep extraction to guarantee a raw JavaScript array, not an object
        let rawArray = vectorItem;
        if (!Array.isArray(vectorItem)) {
          rawArray = vectorItem.values || vectorItem.embedding || [];
        }

        const standardArray = Array.from(rawArray);
        
        if (standardArray.length === 0) {
          throw new Error(`AI returned an empty or invalid vector for chunk ${index}.`);
        }

        // 🛡️ Enforce exactly 768 dimensions for Pinecone
        const dimensionSafeVector = standardArray.length > 768 ? standardArray.slice(0, 768) : standardArray;

        return {
          id: `${savedDoc._id.toString()}-chunk-${index}`, 
          values: dimensionSafeVector,
          metadata: {
            text: chunkTexts[index], 
            userId: currentUserId,   
            docId: savedDoc._id.toString(), 
          }
        };
      });

      console.log(`[Worker] 🚀 Uploading ${pineconeRecords.length} vectors to Pinecone...`);
      await pineconeIndex.upsert(pineconeRecords);
      console.log(`[Worker] 🌲 Successfully embedded and stored in Pinecone!`);

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
  },
  { connection },
);

documentWorker.on("failed", (job, err) => {
  console.error(`[Worker] ❌ Job ${job.id} failed: ${err.message}`);
  
  const maxAttempts = job.opts.attempts || 1;
  
  if (job.attemptsMade >= maxAttempts) {
    console.warn(`[Worker] 🚨 Job ${job.id} failed permanently! Cleaning up toxic file...`);
    
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