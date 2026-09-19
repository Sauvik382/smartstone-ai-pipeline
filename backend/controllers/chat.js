// backend/controllers/chat.js
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { GoogleGenerativeAIEmbeddings } = require("@langchain/google-genai");
const { pineconeIndex } = require("../config/pinecone");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingsClient = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GEMINI_API_KEY,
  model: "text-embedding-004", 
});

const askQuestion = async (req, res) => {
  try {
    const { docId, question } = req.body;
    
    // We grab the same exact device ID we used during upload
    const userId = req.headers['x-user-id'] || "anonymous-user";

    if (!docId || !question) {
      return res.status(400).json({ error: "Missing document ID or question." });
    }

    console.log(`[Chat] 🔎 Searching vectors for question: "${question}"`);

    // 1. Convert the user's question into a mathematical vector
    const questionVector = await embeddingsClient.embedQuery(question);

    // 2. Query Pinecone for the top 3 most relevant chunks
    const searchResults = await pineconeIndex.query({
      vector: questionVector,
      topK: 3, 
      includeMetadata: true,
      filter: {
        userId: userId,
        docId: docId 
      }
    });

    // 3. Extract the actual paragraph text from the Pinecone match results
    const contextChunks = searchResults.matches.map(match => match.metadata.text).join("\n\n---\n\n");

    if (!contextChunks) {
      return res.status(404).json({ answer: "I couldn't find any relevant information in the document to answer that." });
    }

    // 4. Construct the prompt by merging document context and user question
    const prompt = `You are an intelligent document assistant. Use the provided context extracted from the user's document to answer their question. If the answer cannot be found in the context, clearly state that you do not know.

DOCUMENT CONTEXT:
${contextChunks}

USER QUESTION: ${question}`;

    console.log(`[Chat] 🧠 Sending context to Gemini for evaluation...`);
    
    let aiAnswer = "";

    // 🛡️ Primary Model + Fallback Model Logic
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