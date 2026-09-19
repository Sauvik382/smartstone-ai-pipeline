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
 
const TARGET_DIMENSION = 768;
 
// ---------------------------------------------------------------------------
// Embedding helpers
// ---------------------------------------------------------------------------
 
/**
 * Normalizes any shape an embeddings client might return (raw array,
 * TypedArray, { values: [...] }, { embedding: [...] }, { embedding: { values } })
 * into a plain array of JS numbers. Throws instead of silently returning [].
 */
function extractEmbeddingArray(raw) {
  let arr = raw;
 
  if (!Array.isArray(arr)) {
    if (ArrayBuffer.isView(arr)) {
      arr = Array.from(arr);
    } else if (arr && Array.isArray(arr.values)) {
      arr = arr.values;
    } else if (arr && Array.isArray(arr.embedding)) {
      arr = arr.embedding;
    } else if (arr && arr.embedding && Array.isArray(arr.embedding.values)) {
      arr = arr.embedding.values;
    } else {
      arr = [];
    }
  }
 
  const nums = Array.from(arr, Number);
 
  if (nums.length === 0) {
    throw new Error("Embedding extraction produced an empty array — check the embeddings client response shape.");
  }
  if (nums.some((n) => Number.isNaN(n))) {
    throw new Error("Embedding array contains NaN values after casting — refusing to send a corrupt vector to Pinecone.");
  }
 
  return nums;
}
 
/**
 * L2-normalizes a vector. Required any time you truncate a Matryoshka
 * (MRL) embedding like gemini-embedding-001, since Google only guarantees
 * pre-normalized output at the model's native dimension (3072). A truncated
 * vector that isn't renormalized will distort Pinecone's cosine similarity
 * scores even though nothing "errors out."
 */
function l2Normalize(vec) {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}
 
/**
 * Enforces exactly TARGET_DIMENSION on an embedding vector.
 * - Longer vectors are truncated then renormalized (valid for MRL models).
 * - Shorter vectors throw, since that means the wrong model/config was used,
 *   not something safe to zero-pad.
 */
function enforceDimension(vec, targetDim = TARGET_DIMENSION) {
  if (vec.length === targetDim) return vec;
 
  if (vec.length > targetDim) {
    return l2Normalize(vec.slice(0, targetDim));
  }
 
  throw new Error(
    `Embedding vector has ${vec.length} dimensions, expected ${targetDim}. ` +
      `This usually means the embedding model/config changed — do not pad it, fix the source.`
  );
}
 
// ---------------------------------------------------------------------------
// Pinecone upsert helper
// ---------------------------------------------------------------------------
 
/**
 * Tries the current @pinecone-database/pinecone upsert signature first,
 * then falls back to older shapes some SDK versions expect. This is a
 * stopgap for SDK-version drift, NOT a substitute for pinning your
 * @pinecone-database/pinecone version in package.json — do that too.
 */
async function upsertWithFallback(index, records) {
  if (!Array.isArray(records) || records.length === 0) {
    throw new Error("Refusing to call Pinecone upsert with an empty/invalid records array.");
  }
 
  const attempts = [
    { label: "upsert(records)", run: () => index.upsert(records) },
    { label: "upsert({ upsertRequest: { vectors: records } })", run: () => index.upsert({ upsertRequest: { vectors: records } }) },
    { label: "upsert({ vectors: records })", run: () => index.upsert({ vectors: records }) },
  ];
 
  let lastErr;
  for (const attempt of attempts) {
    try {
      const result = await attempt.run();
      console.log(`[Worker] ✅ Pinecone upsert succeeded using ${attempt.label}`);
      return result;
    } catch (err) {
      lastErr = err;
      console.warn(`[Worker] ⚠️ Upsert format "${attempt.label}" failed: ${err.message}`);
    }
  }
 
  throw new Error(`All Pinecone upsert formats failed. Last error: ${lastErr?.message}`);
}
 
// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------
 
const documentWorker = new Worker(
  "document-processing",
  async (job) => {
    console.log(`\n[Worker] 🧑‍🍳 Chef grabbed Job ID: ${job.id}`);
 
    const filePath = path.resolve(process.cwd(), job.data.path);
    const currentUserId = job.data.userId || "anonymous-user";
 
    try {
      console.log(`[Worker] 🔍 Extracting text from PDF at ${filePath}...`);
      const dataBuffer = fs.readFileSync(filePath);
      const pdfData = await pdfParse(dataBuffer);
      const extractedText = pdfData.text;
 
      if (!extractedText || extractedText.trim().length === 0) {
        throw new Error("PDF text extraction returned empty content — nothing to summarize or embed.");
      }
 
      console.log(`[Worker] 🧠 Sending ${extractedText.length} characters to AI...`);
 
      const prompt = `Please provide a concise, 3-sentence summary of the following document:\n\n${extractedText}`;
      let aiSummary = "";
 
      try {
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
        const result = await model.generateContent(prompt);
        aiSummary = result.response.text();
      } catch (primaryError) {
        console.warn(`[Worker] ⚠️ Primary model failed. Switching to fallback model...`);
        const fallbackModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
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
        status: "completed",
        userId: currentUserId,
      });
 
      await savedDoc.save();
      console.log(`[Worker] 🏆 Success! Document safely filed in the database.`);
 
      console.log(`[Worker] 🔪 Slicing document into manageable chunks...`);
 
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      });
 
      const chunks = await splitter.createDocuments([extractedText]);
      const chunkTexts = chunks.map((chunk) => chunk.pageContent);
 
      if (chunkTexts.length === 0) {
        throw new Error("Text splitter produced 0 chunks — refusing to call the embeddings API with nothing.");
      }
 
      console.log(`[Worker] 🧩 Created ${chunkTexts.length} chunks. Generating embeddings...`);
 
      const embeddingsClient = new GoogleGenerativeAIEmbeddings({
        apiKey: process.env.GEMINI_API_KEY,
        model: "gemini-embedding-001",
      });
 
      const rawVectors = await embeddingsClient.embedDocuments(chunkTexts);
 
      if (!rawVectors || rawVectors.length === 0) {
        throw new Error("Gemini AI returned no embedding vectors.");
      }
      if (rawVectors.length !== chunkTexts.length) {
        throw new Error(
          `Embedding count (${rawVectors.length}) does not match chunk count (${chunkTexts.length}) — refusing to build a mismatched metadata mapping.`
        );
      }
 
      const pineconeRecords = rawVectors.map((vectorItem, index) => {
        const extracted = extractEmbeddingArray(vectorItem);
        const dimensionSafeVector = enforceDimension(extracted, TARGET_DIMENSION);
 
        return {
          id: `${savedDoc._id.toString()}-chunk-${index}`,
          values: dimensionSafeVector,
          metadata: {
            text: chunkTexts[index],
            userId: currentUserId,
            docId: savedDoc._id.toString(),
          },
        };
      });
 
      console.log(`[Worker] 🚀 Uploading ${pineconeRecords.length} vectors to Pinecone...`);
      await upsertWithFallback(pineconeIndex, pineconeRecords);
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
  { connection }
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