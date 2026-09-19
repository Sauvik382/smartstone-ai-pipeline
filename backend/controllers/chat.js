const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { pineconeIndex } = require("../config/pinecone");
 
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
 
const embeddingsClient = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GEMINI_API_KEY,
  model: "gemini-embedding-001",
});
 
const TARGET_DIMENSION = 768;
 
// ---------------------------------------------------------------------------
// Embedding helpers (kept identical to documentWorker.js — the query vector
// and the stored document vectors MUST go through the same extraction,
// truncation, and normalization path or cosine similarity in Pinecone will
// be comparing vectors that were prepared two different ways).
// ---------------------------------------------------------------------------
 
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
    throw new Error("Embedding array contains NaN values after casting — refusing to search with a corrupt vector.");
  }
 
  return nums;
}
 
function l2Normalize(vec) {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}
 
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
// Controller
// ---------------------------------------------------------------------------
 
const askQuestion = async (req, res) => {
  try {
    const { docId, question } = req.body;
 
    // Grab device ID from header
    const userId = req.headers["x-user-id"] || "anonymous-user";
 
    if (!docId || !question) {
      return res.status(400).json({ error: "Missing document ID or question." });
    }
 
    console.log(`[Chat] 🔎 Searching vectors for question: "${question}"`);
 
    // 1. Convert user's question into vector using active model
    let questionVector;
    try {
      const rawVector = await embeddingsClient.embedQuery(question);
      const extracted = extractEmbeddingArray(rawVector);
      questionVector = enforceDimension(extracted, TARGET_DIMENSION);
    } catch (embedErr) {
      console.error(`[Chat] ❌ Failed to build a valid search vector:`, embedErr.message);
      return res.status(500).json({ error: "AI returned an invalid search vector." });
    }
 
    // 2. Query Pinecone for top matching chunks
    const searchResults = await pineconeIndex.query({
      vector: questionVector,
      topK: 3,
      includeMetadata: true,
      filter: {
        userId: userId,
        docId: String(docId),
      },
    });
 
    // 3. Extract text from matches
    const contextChunks = searchResults.matches
      .map((match) => match.metadata?.text)
      .filter(Boolean)
      .join("\n\n---\n\n");
 
    if (!contextChunks) {
      return res.status(404).json({ answer: "I couldn't find any relevant information in the document to answer that." });
    }
 
    // 4. Build strict grounded prompt
    const prompt = `You are an intelligent document assistant. Use the provided context extracted from the user's document to answer their question. If the answer cannot be found in the context, clearly state that you do not know.
 
DOCUMENT CONTEXT:
${contextChunks}
 
USER QUESTION: ${question}`;
 
    console.log(`[Chat] 🧠 Sending context to Gemini for evaluation...`);
 
    let aiAnswer = "";
 
    try {
      const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });
      const result = await model.generateContent(prompt);
      aiAnswer = result.response.text();
    } catch (primaryError) {
      console.warn(`[Chat] ⚠️ Primary model failed. Switching to fallback model...`);
      const fallbackModel = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });
      const result = await fallbackModel.generateContent(prompt);
      aiAnswer = result.response.text();
    }
 
    res.status(200).json({ answer: aiAnswer });
  } catch (error) {
    console.error("❌ Chat error:", error);
    res.status(500).json({ error: "Failed to generate answer." });
  }
};
 
module.exports = { askQuestion };
 